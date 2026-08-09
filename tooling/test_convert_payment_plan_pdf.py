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
    def test_registra_en_la_cuota_anterior_la_reduccion_adicional_de_saldo(self) -> None:
        first = parsed_payment(date(2024, 8, 15), 1, "100.00", "10.00", "990.00")
        second = parsed_payment(date(2024, 9, 15), 2, "100.00", "11.00", "959.00")

        converter.infer_extra_principal_from_balances([first, second])

        self.assertEqual(first.record["extra_principal_amount"], "20,00")
        self.assertEqual(first.record["total_amount"], "120,00")
        self.assertIn("15/09/2024", first.record["notes"])
        self.assertEqual(second.record["extra_principal_amount"], "")

    def test_ignora_la_diferencia_de_un_centavo_por_redondeo(self) -> None:
        first = parsed_payment(date(2024, 8, 15), 1, "100.00", "10.00", "990.00")
        second = parsed_payment(date(2024, 9, 15), 2, "100.00", "11.00", "978.99")

        converter.infer_extra_principal_from_balances([first, second])

        self.assertEqual(first.record["extra_principal_amount"], "")


if __name__ == "__main__":
    unittest.main()
