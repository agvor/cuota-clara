# Glosario e invariantes del dominio

## Términos

| Término                          | Definición                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Préstamo (`Loan`)                | Contrato y estado real que contiene configuración y pagos históricos.                              |
| Pago histórico (`PaymentRecord`) | Hecho real registrado manualmente o importado; nunca es resultado de una simulación.               |
| Escenario (`ProjectionScenario`) | Hipótesis futura asociada a un préstamo. No modifica el préstamo ni su historial.                  |
| Periodo de proyección            | Intervalo de pago calculado que contiene saldo inicial/final, interés, principal y cargos.         |
| Plan de tasas (`InterestPlan`)   | Secuencia de reglas que resuelve la tasa aplicable a cada periodo.                                 |
| Fase fija                        | Intervalo explícito en el que la tasa anual se conoce y no cambia.                                 |
| Fase variable                    | Intervalo posterior cuya tasa se determina por una regla versionada y una frecuencia de revisión.  |
| Serie manual de tasas            | Lista de tasas efectivas desde fechas concretas, introducida por la persona usuaria.               |
| Reconciliación                   | Ajuste explícito que explica la diferencia entre saldo calculado y saldo informado por la entidad. |
| Pago extraordinario              | Importe adicional aplicado al principal bajo una regla contractual declarada.                      |
| Dinero (`Money`)                 | Importe inmutable en una moneda, representado con aritmética decimal y no con `number`.            |
| Política de redondeo             | Escala y modo declarados que determinan cuándo y cómo se redondea un importe.                      |
| Interés nominal por periodo      | Interés calculado como saldo inicial × tasa nominal anual ÷ períodos por año.                      |
| Amortización de tasa fija        | Secuencia de periodos con fechas explícitas, interés, principal, pago y saldo resultante.          |

## Invariantes iniciales

- Todos los importes pertenecen a una moneda y precisan su escala decimal.
- Una operación entre importes de monedas distintas falla de forma explícita.
- Una fecha de pago no puede ser anterior al inicio del préstamo.
- Ningún saldo, pago o cargo puede ser negativo, salvo un tipo de ajuste definido explícitamente.
- El saldo final de cada periodo no puede ser menor que cero; el último pago se limita al importe necesario.
- El motor inicial rechaza una cuota que no reduzca principal; no modela amortización negativa todavía.
- Un periodo histórico se identifica como tal y no se recalcula silenciosamente a partir de una proyección.
- Una reconciliación conserva tanto el saldo calculado como el saldo reportado; no reescribe pagos históricos.
- Toda tasa usada contiene su fuente o supuesto, fecha de vigencia y versión de la regla.
- Un pago importado conserva archivo/origen, fila de procedencia y resultado de validación para trazabilidad.
