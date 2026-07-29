# Glosario e invariantes del dominio

## Términos

| Término                          | Definición                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Préstamo (`Loan`)                | Contrato y estado real que contiene configuración y pagos históricos.                              |
| Plazo contractual                | Fecha final o cantidad total de cuotas que limita la proyección; no se infiere silenciosamente.    |
| Cuota mensual total              | Importe exigible que la persona configura; incluye la cuota base y el seguro mensual.              |
| Cuota base                       | Parte de la cuota total restante tras restar el seguro; amortiza principal e interés.              |
| Seguro mensual                   | Cargo periódico incluido en la cuota total, separado de principal e interés.                       |
| Estimación contractual           | Proyección no bancaria de cuotas, costo y saldo según contrato v2/v3 y supuestos declarados.       |
| Agregado de préstamo             | Préstamo con sus pagos históricos y snapshots de escenarios, unidad de persistencia.               |
| Pago histórico (`PaymentRecord`) | Hecho real registrado manualmente o importado; nunca es resultado de una simulación.               |
| Escenario (`ProjectionScenario`) | Hipótesis futura asociada a un préstamo. No modifica el préstamo ni su historial.                  |
| Periodo de proyección            | Intervalo de pago calculado que contiene saldo inicial/final, interés, principal y cargos.         |
| Plan de tasas (`InterestPlan`)   | Secuencia de reglas que resuelve la tasa aplicable a cada periodo.                                 |
| Fase fija                        | Intervalo explícito en el que la tasa anual se conoce y no cambia.                                 |
| Fase variable                    | Intervalo posterior cuya tasa se determina por una regla versionada y una frecuencia de revisión.  |
| Serie manual de tasas            | Regla `manual_series_v1`: lista de tasas efectivas desde fechas concretas.                         |
| TBP (tasa básica pasiva)         | Tasa de referencia anual usada como supuesto local configurable; no se consulta desde red en MVP.  |
| Margen                           | Tasa anual contractual que se suma a la TBP para resolver la tasa variable.                        |
| Evolución de TBP                 | Hipótesis estable, alza progresiva o baja progresiva aplicada por revisión a la TBP del escenario. |
| Frecuencia de revisión           | Cadencia declarada en que una regla variable puede actualizar su tasa.                             |
| Reconciliación                   | Ajuste explícito que explica la diferencia entre saldo calculado y saldo informado por la entidad. |
| Pago extraordinario              | Importe adicional aplicado al principal bajo una regla contractual declarada.                      |
| Dinero (`Money`)                 | Importe inmutable en una moneda, representado con aritmética decimal y no con `number`.            |
| Política de redondeo             | Escala y modo declarados que determinan cuándo y cómo se redondea un importe.                      |
| Interés nominal por periodo      | Interés calculado como saldo inicial × tasa nominal anual ÷ períodos por año.                      |
| Amortización de tasa fija        | Secuencia de periodos con fechas explícitas, interés, principal, pago y saldo resultante.          |

## Invariantes iniciales

- Todos los importes pertenecen a una moneda y precisan su escala decimal.
- Una operación entre importes de monedas distintas falla de forma explícita.
- Un agregado asocia pagos y escenarios a un único préstamo mediante su identificador.
- Una fecha de pago no puede ser anterior al inicio del préstamo.
- Ningún saldo, pago o cargo puede ser negativo, salvo un tipo de ajuste definido explícitamente.
- El saldo final de cada periodo no puede ser menor que cero; el último pago se limita al importe necesario.
- El motor inicial rechaza una cuota que no reduzca principal; no modela amortización negativa todavía.
- El pago extraordinario único se aplica después de la cuota ordinaria y se limita al saldo restante.
- Un periodo histórico se identifica como tal y no se recalcula silenciosamente a partir de una proyección.
- Una reconciliación conserva tanto el saldo calculado como el saldo reportado; no reescribe pagos históricos.
- Toda tasa usada contiene su fuente o supuesto, fecha de vigencia y versión de la regla.
- Un periodo variable sin tasa manual vigente es inválido; el motor no infiere ni reutiliza tasas silenciosamente.
- Un pago importado conserva archivo/origen, fila de procedencia y resultado de validación para trazabilidad.
- Un contrato v2/v3 declara plazo por fecha final o número total de cuotas y separa monto original de saldo reconciliado. En v3, el plazo es autoritativo para la proyección y la cuota configurada se compara con la cuota proyectada necesaria.
- La cuota base equivale a cuota mensual total menos seguro y debe ser positiva; el seguro no reduce principal ni genera interés mientras no exista una regla contractual que disponga lo contrario.
- Una estimación que alcanza el plazo con saldo pendiente lo muestra; no inventa cuotas posteriores.
- Una regla `tbp_margin_v1` conserva TBP inicial, margen, frecuencia, evolución, variación y versión; no consulta ni infiere una tasa externa.
- La TBP no baja de cero; la cuota se conserva en el cambio de tasa y el saldo pendiente se expone al final del plazo declarado.
