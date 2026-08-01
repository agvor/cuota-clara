#!/usr/bin/env python3
"""Convierte un plan de pagos PDF de Select.Pdf al CSV de CuotaClara.

No requiere paquetes de Python externos. El extractor está pensado para el
formato tabular del PDF proporcionado por la entidad: cuota, amortización a
capital, intereses, pólizas y otros. No interpreta ni confirma pagos; prepara
un archivo que siempre debe revisarse en la previsualización de la aplicación.
"""

from __future__ import annotations

import argparse
import csv
import re
import unicodedata
import zlib
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path


CSV_HEADERS = [
    "id",
    "date",
    "total_amount",
    "interest_amount",
    "principal_amount",
    "extra_principal_amount",
    "insurance_amount",
    "fee_amount",
    "notes",
]


@dataclass(frozen=True)
class TextItem:
    """Texto posicionado extraído de una operación de texto del PDF."""

    x: float
    y: float
    text: str


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Convierte un plan de pagos PDF de la entidad al CSV de pagos de "
            "CuotaClara. Por defecto incluye cuotas con fecha hasta hoy."
        )
    )
    parser.add_argument("input_pdf", type=Path, help="PDF de plan de pagos.")
    parser.add_argument("output_csv", type=Path, help="Ruta del CSV que se creará.")
    parser.add_argument(
        "--until",
        type=parse_until_date,
        default=date.today(),
        metavar="AAAA-MM-DD",
        help="Incluye cuotas hasta esta fecha inclusive (por defecto: hoy).",
    )
    return parser.parse_args()


def parse_until_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("Use la fecha AAAA-MM-DD.") from error


def extract_pdf_objects(pdf: bytes) -> dict[int, bytes]:
    """Obtiene objetos indirectos no comprimidos, suficientes para este PDF."""

    objects: dict[int, bytes] = {}
    for match in re.finditer(rb"(\d+) 0 obj(.*?)endobj", pdf, re.DOTALL):
        objects[int(match.group(1))] = match.group(2)
    return objects


def extract_stream(object_body: bytes) -> bytes | None:
    match = re.search(rb"stream\r?\n(.*?)\r?\nendstream", object_body, re.DOTALL)
    if match is None:
        return None

    stream = match.group(1)
    if b"/FlateDecode" not in object_body:
        return stream
    try:
        return zlib.decompress(stream)
    except zlib.error:
        return None


def unicode_map(cmap_stream: bytes) -> dict[int, str]:
    """Lee los rangos ToUnicode usados por las fuentes Type0 del documento."""

    mapping: dict[int, str] = {}
    for start, end, destination in re.findall(
        rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>",
        cmap_stream,
    ):
        start_code, end_code = int(start, 16), int(end, 16)
        destination_code = int(destination, 16)
        for offset in range(end_code - start_code + 1):
            mapping[start_code + offset] = chr(destination_code + offset)
    return mapping


def extract_font_maps(objects: dict[int, bytes]) -> dict[str, dict[int, str]]:
    font_maps: dict[str, dict[int, str]] = {}
    for object_body in objects.values():
        if b"/Subtype /Type0" not in object_body:
            continue
        name = re.search(rb"/Name /([^\s/]+)", object_body)
        to_unicode = re.search(rb"/ToUnicode (\d+) 0 R", object_body)
        if name is None or to_unicode is None:
            continue
        cmap_body = objects.get(int(to_unicode.group(1)))
        if cmap_body is None:
            continue
        cmap_stream = extract_stream(cmap_body)
        if cmap_stream is not None:
            font_maps[name.group(1).decode("ascii")] = unicode_map(cmap_stream)
    return font_maps


def read_pdf_literal(source: bytes, start: int) -> tuple[bytes, int]:
    """Lee una cadena PDF literal sin confundir paréntesis escapados con cierre."""

    if source[start] != ord("("):
        raise ValueError("La cadena PDF debe iniciar con un paréntesis.")

    depth = 1
    index = start + 1
    literal = bytearray()
    while index < len(source):
        byte = source[index]
        if byte == ord("\\"):
            literal.append(byte)
            index += 1
            if index < len(source):
                literal.append(source[index])
                index += 1
            continue
        if byte == ord("("):
            depth += 1
        elif byte == ord(")"):
            depth -= 1
            if depth == 0:
                return bytes(literal), index + 1
        literal.append(byte)
        index += 1
    raise ValueError("Cadena PDF sin cierre.")


def unescape_pdf_literal(literal: bytes) -> bytes:
    """Aplica los escapes de cadenas PDF, incluidos los octales."""

    result = bytearray()
    index = 0
    simple_escapes = {
        ord("n"): 0x0A,
        ord("r"): 0x0D,
        ord("t"): 0x09,
        ord("b"): 0x08,
        ord("f"): 0x0C,
    }
    while index < len(literal):
        byte = literal[index]
        if byte != ord("\\"):
            result.append(byte)
            index += 1
            continue

        index += 1
        if index == len(literal):
            break
        escaped = literal[index]
        index += 1
        if escaped in simple_escapes:
            result.append(simple_escapes[escaped])
        elif ord("0") <= escaped <= ord("7"):
            octal = bytearray([escaped])
            while (
                index < len(literal)
                and len(octal) < 3
                and ord("0") <= literal[index] <= ord("7")
            ):
                octal.append(literal[index])
                index += 1
            result.append(int(octal, 8))
        elif escaped == 0x0D and index < len(literal) and literal[index] == 0x0A:
            index += 1
        elif escaped in (ord("("), ord(")"), ord("\\")):
            result.append(escaped)
        else:
            result.append(escaped)
    return bytes(result)


def decode_text(literal: bytes, mapping: dict[int, str]) -> str:
    decoded = unescape_pdf_literal(literal)
    if len(decoded) % 2:
        return ""
    return "".join(
        mapping.get(int.from_bytes(decoded[index : index + 2], "big"), "�")
        for index in range(0, len(decoded), 2)
    )


def extract_text_items(pdf: bytes) -> list[TextItem]:
    objects = extract_pdf_objects(pdf)
    font_maps = extract_font_maps(objects)
    items: list[TextItem] = []

    for object_body in objects.values():
        stream = extract_stream(object_body)
        if stream is None:
            continue
        for text_object in re.findall(rb"BT\s*(.*?)\s*ET", stream, re.DOTALL):
            font = re.search(rb"/([^\s/]+)\s+[-+0-9.]+\s+Tf", text_object)
            position = re.search(
                rb"([-+0-9.]+)\s+([-+0-9.]+)\s+Td", text_object
            )
            literal_start = text_object.find(b"(")
            if font is None or position is None or literal_start < 0:
                continue
            mapping = font_maps.get(font.group(1).decode("ascii"))
            if mapping is None:
                continue
            try:
                literal, after_literal = read_pdf_literal(text_object, literal_start)
            except ValueError:
                continue
            if not re.match(rb"\s*Tj", text_object[after_literal:]):
                continue
            text = decode_text(literal, mapping)
            if text:
                items.append(
                    TextItem(
                        x=float(position.group(1)),
                        y=float(position.group(2)),
                        text=text,
                    )
                )
    return items


def normalized_label(text: str) -> str:
    return (
        unicodedata.normalize("NFKD", text)
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )


def parse_money(value: str) -> Decimal:
    """Acepta cifras con separadores de miles en estilo CR o US."""

    digits = re.sub(r"[^0-9,.-]", "", value)
    if not digits or digits in {"-", ".", ","}:
        raise ValueError(f"No se encontró un importe válido en {value!r}.")

    last_dot = digits.rfind(".")
    last_comma = digits.rfind(",")
    if last_dot >= 0 and last_comma >= 0:
        decimal_separator = "." if last_dot > last_comma else ","
    else:
        separator = "." if last_dot >= 0 else "," if last_comma >= 0 else None
        decimal_separator = None
        if separator is not None and digits.count(separator) == 1:
            tail = digits.rsplit(separator, 1)[1]
            if len(tail) in (1, 2):
                decimal_separator = separator

    if decimal_separator is None:
        normalized = digits.replace(".", "").replace(",", "")
    else:
        integer, fraction = digits.rsplit(decimal_separator, 1)
        normalized = integer.replace(".", "").replace(",", "") + "." + fraction
    try:
        return Decimal(normalized)
    except InvalidOperation as error:
        raise ValueError(f"Importe inválido: {value!r}.") from error


def csv_amount(value: Decimal) -> str:
    """Escribe decimal con coma, sin miles, para el formato regional documentado."""

    return format(value.quantize(Decimal("0.01")), "f").replace(".", ",")


def items_near(items: list[TextItem], x_min: float, x_max: float, y: float, tolerance: float = 1) -> list[TextItem]:
    return [
        item
        for item in items
        if x_min <= item.x <= x_max and abs(item.y - y) <= tolerance
    ]


def build_records(items: list[TextItem], until: date) -> list[dict[str, str]]:
    records: list[tuple[date, int, dict[str, str]]] = []
    date_pattern = re.compile(r"^\d{2}/\d{2}/\d{4}$")

    for date_item in items:
        if not (270 <= date_item.x <= 330 and date_pattern.fullmatch(date_item.text)):
            continue
        payment_date = datetime.strptime(date_item.text, "%d/%m/%Y").date()
        if payment_date > until:
            continue

        sequence_candidates = items_near(items, 0, 100, date_item.y)
        amount_candidates = items_near(items, 380, 550, date_item.y)
        if not sequence_candidates or not amount_candidates:
            raise ValueError(
                f"No se pudo leer la fila del {date_item.text}: faltan número o cuota total."
            )
        try:
            sequence = int(sequence_candidates[0].text)
            total = parse_money(amount_candidates[0].text)
        except (ValueError, IndexError) as error:
            raise ValueError(f"No se pudo leer la fila del {date_item.text}.") from error

        fields: dict[str, Decimal] = {}
        details = [
            item
            for item in items
            if 550 <= item.x <= 870 and date_item.y - 65 <= item.y <= date_item.y + 1
        ]
        for detail in details:
            label, separator, value = detail.text.partition(":")
            if not separator:
                continue
            label = normalized_label(label)
            amount = parse_money(value)
            if "amortizaci" in label:
                fields["principal_amount"] = amount
            elif "intereses" in label:
                fields["interest_amount"] = amount
            elif "lizas" in label:
                fields["insurance_amount"] = amount
            elif "otros" in label:
                fields["fee_amount"] = amount

        required = {"principal_amount", "interest_amount", "insurance_amount", "fee_amount"}
        missing = required.difference(fields)
        if missing:
            names = ", ".join(sorted(missing))
            raise ValueError(f"Faltan campos ({names}) en la fila del {date_item.text}.")

        record = {
            "id": f"pdf-plan-{payment_date:%Y%m%d}-{sequence:03d}",
            "date": date_item.text,
            "total_amount": csv_amount(total),
            "interest_amount": csv_amount(fields["interest_amount"]),
            "principal_amount": csv_amount(fields["principal_amount"]),
            "extra_principal_amount": "",
            "insurance_amount": csv_amount(fields["insurance_amount"]),
            "fee_amount": csv_amount(fields["fee_amount"]),
            "notes": f"Plan de pagos PDF; cuota {sequence}.",
        }
        records.append((payment_date, sequence, record))

    records.sort(key=lambda record: (record[0], record[1]))
    if not records:
        raise ValueError("No se encontraron cuotas con fecha hasta el corte indicado.")
    return [record for _, _, record in records]


def write_csv(records: list[dict[str, str]], output_csv: Path) -> None:
    with output_csv.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=CSV_HEADERS, delimiter=";")
        writer.writeheader()
        writer.writerows(records)


def main() -> None:
    arguments = parse_arguments()
    if not arguments.input_pdf.is_file():
        raise SystemExit(f"No existe el PDF: {arguments.input_pdf}")
    if not arguments.output_csv.parent.is_dir():
        raise SystemExit(f"No existe el directorio de salida: {arguments.output_csv.parent}")

    try:
        items = extract_text_items(arguments.input_pdf.read_bytes())
        records = build_records(items, arguments.until)
    except (OSError, ValueError) as error:
        raise SystemExit(f"No se pudo convertir el PDF: {error}") from error

    write_csv(records, arguments.output_csv)
    print(
        f"Se escribieron {len(records)} pagos en {arguments.output_csv} "
        f"(corte: {arguments.until.isoformat()})."
    )


if __name__ == "__main__":
    main()
