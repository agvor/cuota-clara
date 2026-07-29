# Motor de amortización inicial

## Modelo implementado

`generateFixedRateAmortization` genera una tabla de cuota periódica fija para una tasa nominal anual fija o una serie variable manual. Recibe las fechas de pago de forma explícita para no ocultar todavía una política de calendario —por ejemplo, qué ocurre con el día 31 o feriados— dentro del motor.

En cada periodo aplica este orden:

1. Calcula y redondea el interés sobre el saldo inicial.
2. Limita el pago al saldo más interés si se trata del último periodo.
3. Aplica al principal el pago menos interés.
4. Aplica el pago extraordinario único programado para esa fecha, si existe.
5. Produce saldo final, importes y traza de tasa.

## Contrato de salida

Cada periodo contiene fecha, saldo inicial, tasa anual y periódica, interés, principal, cargos, cuota ordinaria, pago extraordinario, pago total y saldo final. En esta entrega los cargos son siempre `0.00`; seguros, comisiones y cargos configurables requerirán reglas y casos de referencia propios.

Un pago extraordinario único se identifica, se programa en una fecha de pago y se aplica después de la cuota ordinaria exclusivamente al principal. Se limita al saldo restante y el comparador de escenarios informa intereses y periodos ahorrados. No recalcula la cuota ordinaria.

El resumen contiene fecha de finalización, total de interés, principal y pago. La función rechaza una cuota que no reduzca principal, monedas distintas, fechas no crecientes y una lista de fechas insuficiente para cancelar el saldo.

## Estimación de contrato v2

`estimateLoanContract` construye el calendario mensual de un contrato v2 y reutiliza la misma regla de interés. Separa seguro de principal e interés y expone tanto el total desembolsado como el saldo que queda si el plazo declarado no alcanza. Si la liquidación ocurre antes, informa la cuota final reducida; si no, nunca inventa una cuota adicional.

Su caso de referencia sintético es [`contract-estimate-monthly-insurance-v1`](../../packages/domain/test/fixtures/contract-estimate-monthly-insurance-v1.json). El seguro es fijo, se cobra por cada cuota proyectada y no devenga interés ni amortiza principal. La estimación no prorratea interés por días ni constituye una liquidación bancaria.

## Límites conocidos

- El motor genérico no incorpora seguros ni comisiones; la estimación contractual v2 aplica el seguro mensual fijo por separado.
- No decide ni genera el calendario de pagos; esa política se incorporará de forma explícita cuando exista evidencia contractual.
- No representa aún atrasos, pagos parciales ni cambios de cuota.

El caso [`fixed-rate-monthly-v1`](../../packages/domain/test/fixtures/fixed-rate-monthly-v1.json) es su referencia de regresión actual.

`projectLoanAmortization` adapta la configuración de un `Loan` al motor y genera el calendario contractual inicial para frecuencias que dividen doce. La presentación usa ese resultado para la tabla y el gráfico, sin repetir cálculos financieros.
