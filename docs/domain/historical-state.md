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

## Continuidad sin saldo bancario

Si no existe un reset bancario y hay pagos con principal conocido, el último pago histórico define el corte automático de la proyección. El motor usa el saldo reconstruido como saldo de apertura y genera únicamente las cuotas contractuales posteriores a esa fecha. La visualización conserva cada pago histórico con su saldo de cierre para que la transición sea verificable.

El gráfico usa la misma secuencia que la tabla: pagos históricos desde el inicio, ajuste de reconciliación si existe y periodos proyectados. Una línea vertical sutil marca el inicio de la proyección sin cambiar el color de las señales financieras.

## Posición vigente de lectura

El resumen y la cartera presentan una misma posición vigente, derivada sin modificar el agregado. El **saldo principal actual** se resuelve con esta precedencia:

1. el saldo bancario conciliado más reciente, menos el principal ordinario y extraordinario de pagos posteriores a su fecha reportada;
2. sin saldo conciliado, el saldo reconstruido a la fecha del último pago cuyo principal sea conocido;
3. sin actividad registrada, el saldo inicial del préstamo.

El valor se acompaña de la fecha de la evidencia que lo sustenta. Si un pago necesario no contiene principal, la aplicación no infiere el saldo a partir de la cuota total: comunica que el valor no está disponible y conserva el historial para revisión.

La **fecha final vigente** usa la fecha final bancaria cuando existe y, en su ausencia, la fecha contractual o la calculada por la proyección compatible. Su procedencia se presenta de forma explícita. Saldo conciliado y fecha final bancaria continúan siendo referencias independientes, aunque el motor necesita un límite final aplicable para construir una proyección posterior al reset.

## Reconciliación

Un `ReconciliationAdjustment` guarda identificador, fecha de corte, saldo reportado y motivo. El motor muestra la diferencia entre el saldo calculado y el reportado, y usa el reportado como saldo actual. No modifica ninguno de los pagos originales ni oculta la diferencia.

## Reset con saldo bancario

La conciliación bancaria se solicita después de previsualizar o importar pagos, no se deduce del PDF. Los saldos y la fecha final se administran por separado:

1. saldo **principal** reportado por la entidad;
2. fecha de corte de ese saldo;
3. fecha de la última cuota proyectada por la entidad.

La aplicación calcula, a esa fecha, `saldo reconstruido = monto original − principal ordinario acumulado − principal extraordinario acumulado`. El interés importado se acumula por separado: describe el costo ya pagado, pero no amortiza el saldo.

| Resultado de comparación | Tratamiento                                                                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saldo reportado menor    | Se ofrece crear un **ajuste de reconciliación** por la diferencia. Solo tras confirmación se guarda como registro histórico especial, con principal extraordinario y cero interés, seguro y comisión. |

Puede haber varios saldos conciliados, cada uno con importe y fecha reportada, y todos pueden editarse o eliminarse. El de fecha más reciente alimenta la proyección vigente; los anteriores siguen siendo evidencia del historial. La fecha final reportada por el banco es única, no tiene fecha de corte y puede actualizarse o eliminarse sin afectar los pagos reales.
| Saldo igual | Se guarda el reset sin ajuste. |
| Saldo reportado mayor | Se presenta la discrepancia y no se inventa un pago ni ajuste. La persona debe revisar o conservar el reset con su motivo. |

Una proyección posterior usa el saldo conciliado activo como punto de partida. Si hay pagos CSV posteriores a la fecha reportada, descuenta de ese saldo exclusivamente su principal ordinario y extraordinario y mueve el corte al último de esos pagos; no descuenta de nuevo los pagos anteriores, pues ya están reflejados por el banco. Después usa la fecha final bancaria única como límite y recalcula la cuota necesaria. Conserva el plan de tasas contractual, periodicidad, seguro y cargos que ya tenía el préstamo: la conciliación no reinicia la fase fija o variable. Base y escenarios usan ese mismo punto compuesto. El resumen final muestra por separado y suma: capital histórico, interés histórico, ajuste de reconciliación y los importes proyectados desde el saldo activo.

Esta entrega no interpreta atrasos, pagos parciales ni el orden bancario de cargos desconocidos; esas reglas requerirán casos de referencia adicionales.
