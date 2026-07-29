# Estado histórico y reconciliación

## Pago histórico

Un `PaymentRecord` es un hecho inmutable: identificador, fecha, importe total, origen (`manual` o `csv_import`) y notas. Puede incluir interés, principal ordinario, principal extraordinario, seguro y comisión cuando sean conocidos. Todos los componentes usan la moneda del pago.

Para reconstruir el saldo, el principal ordinario debe conocerse. Si el banco no proporciona ese desglose, el motor rechaza la reconstrucción en lugar de inferirlo a partir de la cuota. La importación futura podrá solicitar la información faltante o crear un ajuste de reconciliación explícito.

## Fecha de corte

`reconstructHistoricalState` ordena una copia de los pagos por fecha, comprueba identificadores duplicados y aplica principal más principal extraordinario hasta la fecha de corte. El resultado identifica esos registros como históricos y expone:

- saldo calculado antes de reconciliar;
- principal acumulado aplicado;
- saldo actual usado para la proyección posterior.

Los pagos posteriores a la fecha de corte o que exceden el saldo se rechazan.

## Reconciliación

Un `ReconciliationAdjustment` guarda identificador, fecha de corte, saldo reportado y motivo. El motor muestra la diferencia entre el saldo calculado y el reportado, y usa el reportado como saldo actual. No modifica ninguno de los pagos originales ni oculta la diferencia.

Esta entrega no interpreta atrasos, pagos parciales ni el orden bancario de cargos desconocidos; esas reglas requerirán casos de referencia adicionales.
