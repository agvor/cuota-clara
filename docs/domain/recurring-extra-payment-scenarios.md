# Escenarios de aporte recurrente

Los escenarios son alternativas locales: no cambian el contrato ni los pagos históricos guardados. Usan el mismo motor decimal, las mismas tasas, fechas y política de redondeo que la proyección base.

## Extraordinario constante mensual

`constant_extra` guarda un importe positivo y lo aplica después de cada cuota ordinaria. El último extraordinario se limita al saldo que quede después del principal ordinario; nunca deja saldo negativo.

## Aporte constante al principal

`constant_principal` guarda un objetivo positivo de principal por periodo. En cada cuota calcula:

`extraordinario = máximo(0, objetivo de principal − principal ordinario)`.

Así, el principal total aplicado intenta ser el objetivo declarado. Si la cuota ordinaria ya aporta más principal, no añade un extraordinario. La cuota extraordinaria puede cambiar entre meses porque el interés y, por tanto, el principal ordinario cambian.

## Comparación visual

La configuración de escenarios no duplica resultados visuales. Sus tarjetas permiten abrir el resumen de cada alternativa —fecha final, períodos ahorrados, interés ahorrado y total pagado—. Al abrir el detalle de amortización, la PWA conserva la base y permite elegir hasta dos escenarios guardados sobre ese mismo gráfico, sin repetir la tabla. Saldo, cuota total, interés, principal y extraordinario son señales comparables: al activar una, se presenta para todas las fuentes con color y patrón constantes por señal. El detalle de un periodo agrupa los importes de las señales activas por base y escenario; el periodo se puede fijar para comparar sin que cambie al mover el cursor. Una comparación no es un estado de cuenta bancario.
