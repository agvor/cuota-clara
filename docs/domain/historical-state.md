# Estado histórico y reconciliación

## Pago histórico

Un `PaymentRecord` es un hecho inmutable: identificador, fecha, importe total, origen (`manual` o `csv_import`) y notas. Puede incluir interés, principal ordinario, principal extraordinario, seguro y comisión cuando sean conocidos. Todos los componentes usan la moneda del pago.

Para reconstruir el saldo, el principal ordinario debe conocerse. Si el banco no proporciona ese desglose, el motor rechaza la reconstrucción en lugar de inferirlo a partir de la cuota. La importación futura podrá solicitar la información faltante o crear un ajuste de reconciliación explícito.

## Fecha de corte

`reconstructHistoricalState` ordena una copia de los pagos por fecha, comprueba identificadores duplicados y aplica principal más principal extraordinario hasta la fecha de corte. También suma el interés conocido sin usarlo para reducir saldo. El resultado identifica esos registros como históricos y expone:

- saldo calculado antes de reconciliar;
- principal acumulado aplicado;
- interés histórico acumulado;
- saldo actual usado para la proyección posterior.

Los pagos posteriores a la fecha de corte o que exceden el saldo se rechazan.

## Reconciliación

Un `ReconciliationAdjustment` guarda identificador, fecha de corte, saldo reportado y motivo. El motor muestra la diferencia entre el saldo calculado y el reportado, y usa el reportado como saldo actual. No modifica ninguno de los pagos originales ni oculta la diferencia.

## Reset con saldo bancario

El reset bancario se solicita después de previsualizar o importar pagos, no se deduce del PDF. Requiere tres datos proporcionados por la persona usuaria:

1. saldo **principal** reportado por la entidad;
2. fecha de corte de ese saldo;
3. fecha de la última cuota proyectada por la entidad.

La aplicación calcula, a esa fecha, `saldo reconstruido = monto original − principal ordinario acumulado − principal extraordinario acumulado`. El interés importado se acumula por separado: describe el costo ya pagado, pero no amortiza el saldo.

| Resultado de comparación | Tratamiento                                                                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saldo reportado menor    | Se ofrece crear un **ajuste de reconciliación** por la diferencia. Solo tras confirmación se guarda como registro histórico especial, con principal extraordinario y cero interés, seguro y comisión. |
| Saldo igual              | Se guarda el reset sin ajuste.                                                                                                                                                                        |
| Saldo reportado mayor    | Se presenta la discrepancia y no se inventa un pago ni ajuste. La persona debe revisar o conservar el reset con su motivo.                                                                            |

Una proyección posterior usa el saldo reportado como saldo inicial y recalcula la cuota necesaria para terminar en la fecha final bancaria. Conserva el plan de tasas contractual, periodicidad, seguro y cargos que ya tenía el préstamo: el reset no reinicia la fase fija o variable. El resumen final muestra por separado y suma: capital histórico, interés histórico, ajuste de reconciliación y los importes proyectados desde el reset.

Esta entrega no interpreta atrasos, pagos parciales ni el orden bancario de cargos desconocidos; esas reglas requerirán casos de referencia adicionales.
