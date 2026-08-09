"""Pruebas unitarias del conversor local de plan de pagos PDF."""

from __future__ import annotations

import importlib.util
import sys
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("convert_payment_plan_pdf.py")
SPEC = importlib.util.spec_from_file_location("payment_plan_converter", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:  # pragma: no cover - falla de entorno
    raise RuntimeError("No se pudo cargar el conversor de PDF.")
converter = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = converter
SPEC.loader.exec_module(converter)


def parsed_payment(
    payment_date: date,
    sequence: int,
    total: str,
    principal: str,
    closing_balance: str,
) -> converter.ParsedPayment:
    record = {
        "id": f"payment-{sequence}",
        "date": payment_date.strftime("%d/%m/%Y"),
        "total_amount": total,
        "interest_amount": "0,00",
        "principal_amount": principal,
        "extra_principal_amount": "",
        "insurance_amount": "0,00",
        "fee_amount": "0,00",
        "notes": f"Plan de pagos PDF; cuota {sequence}.",
    }
    return converter.ParsedPayment(
        payment_date=payment_date,
        sequence=sequence,
        total=Decimal(total),
        principal=Decimal(principal),
        closing_balance=Decimal(closing_balance),
        record=record,
    )


class InferExtraPrincipalFromBalancesTest(unittest.TestCase):
    def test_crea_una_fila_separada_en_la_cuota_siguiente(self) -> None:
        first = parsed_payment(date(2024, 8, 15), 1, "100.00", "10.00", "990.00")
        second = parsed_payment(date(2024, 9, 15), 2, "100.00", "11.00", "959.00")

        inferred = converter.infer_extra_principal_from_balances([first, second])

        self.assertEqual(first.record["extra_principal_amount"], "")
        self.assertEqual(first.record["total_amount"], "100.00")
        self.assertEqual(len(inferred), 1)
        _, _, _, record = inferred[0]
        self.assertEqual(record["id"], "pdf-plan-extra-20240915-002")
        self.assertEqual(record["date"], "15/09/2024")
        self.assertEqual(record["total_amount"], "20,00")
        self.assertEqual(record["principal_amount"], "0,00")
        self.assertEqual(record["extra_principal_amount"], "20,00")
        self.assertIn("15/09/2024", record["notes"])

    def test_ignora_la_diferencia_de_un_centavo_por_redondeo(self) -> None:
        first = parsed_payment(date(2024, 8, 15), 1, "100.00", "10.00", "990.00")
        second = parsed_payment(date(2024, 9, 15), 2, "100.00", "11.00", "978.99")

        inferred = converter.infer_extra_principal_from_balances([first, second])

        self.assertEqual(inferred, [])


if __name__ == "__main__":
    unittest.main()
