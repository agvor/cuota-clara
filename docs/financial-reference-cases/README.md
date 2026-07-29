# Casos de referencia financieros

Los casos de referencia convierten una regla financiera en una entrada, supuestos y resultado verificables. Son la especificación ejecutable del motor: cada cambio de cálculo debe añadir o actualizar un caso antes de modificar la implementación.

## Fuentes y privacidad

- Un caso `synthetic` ilustra una regla y nunca se presenta como resultado de un banco.
- Un caso `bank_statement` o `contract` requiere consentimiento, una referencia no sensible al documento y la eliminación de nombres, números de préstamo, direcciones e identificadores.
- La coincidencia con un banco solo es válida cuando se documentan la convención de días, fechas de corte, seguros, comisiones, redondeo y aplicación de pagos.

## Ubicación y plantilla

Los JSON ejecutables viven en `packages/domain/test/fixtures/`; el primer caso es [`fixed-rate-monthly-v1.json`](../../packages/domain/test/fixtures/fixed-rate-monthly-v1.json). Copia [`template.json`](template.json) para crear un caso nuevo y añade una prueba de regresión que compruebe cada periodo afectado.

Todo caso debe contener:

- Identificador y versión estables.
- Fuente, procedencia y confirmación de que no contiene datos personales.
- Entradas: moneda, fechas, saldo, cuota, tasa, periodicidad y políticas.
- Regla de interés y el orden de aplicación del pago.
- Tabla esperada por periodo y totales.

## Caso fijo sintético v1

`fixed-rate-monthly-v1` aplica interés nominal mensual: `saldo inicial × 0.12 ÷ 12`, con redondeo half-up a dos decimales en cada periodo. La cuota ordinaria es 340.00; el último pago se limita al saldo pendiente.

| Periodo | Saldo inicial | Interés | Principal |   Pago | Saldo final |
| ------: | ------------: | ------: | --------: | -----: | ----------: |
|       1 |      1,000.00 |   10.00 |    330.00 | 340.00 |      670.00 |
|       2 |        670.00 |    6.70 |    333.30 | 340.00 |      336.70 |
|       3 |        336.70 |    3.37 |    336.63 | 340.00 |        0.07 |
|       4 |          0.07 |    0.00 |      0.07 |   0.07 |        0.00 |

El total de interés esperado es 20.07 y el total pagado es 1,020.07. Este resultado depende de las políticas declaradas y no debe generalizarse a un contrato real.
