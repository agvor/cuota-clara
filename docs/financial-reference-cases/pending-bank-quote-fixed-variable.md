# Caso pendiente: cuota bancaria con tasa fija inicial y variable posterior

## Propósito

Este caso se registró para mejorar la cercanía de la simulación a una cotización bancaria real. No se usa todavía como fixture ejecutable ni autoriza cambiar la fórmula actual sin confirmar los supuestos faltantes.

## Datos reportados

| Campo                                 |                               Valor reportado |
| ------------------------------------- | --------------------------------------------: |
| Monto                                 |                                ₡94 920 015,78 |
| Plazo                                 |                          336 cuotas mensuales |
| Tasa inicial                          | 8,15% anual, fija durante los primeros 3 años |
| Seguro mensual aproximado             |                                      ₡175 000 |
| Cuota cotizada por el banco           |                                      ₡912 545 |
| Cuota automática actual de CuotaClara |                                      ₡893 586 |

Con el modelo nominal mensual actual, 8,15% ÷ 12 y 336 cuotas, la cuota base es aproximadamente ₡718 586,35 y, al sumar ₡175 000 de seguros, la cuota total es aproximadamente ₡893 586,35. La diferencia contra la cotización reportada es aproximadamente ₡18 958,65.

## Hipótesis a validar

La diferencia no debe atribuirse automáticamente a seguros o cargos. El banco podría estar resolviendo una cuota nivelada para todo el plazo usando una trayectoria proyectada: tasa fija durante 36 cuotas y una tasa variable esperada para las 300 restantes. También puede usar una convención de tasa, saldo financiado o calendario distinta.

Antes de implementar, obtener del banco:

1. Fecha de desembolso y de la primera cuota.
2. Desglose de la primera cuota: interés, principal, seguros y cualquier cargo.
3. Confirmación de si el monto reportado es saldo financiado o monto desembolsado.
4. Definición contractual de 8,15%: nominal/efectiva y base de días.
5. Regla posterior a los 36 meses: referencia, margen, frecuencia de revisión y proyección utilizada en la cotización.
6. Política de cuota: se recalcula en cada revisión o permanece nivelada bajo una proyección de tasas.

## Decisión pendiente

La historia [`US-029`](../implementation-status.md) definirá una política de cuota versionada solo después de validar estas entradas. El resultado debe añadirse como fixture financiero reproducible y no como un ajuste ad hoc para una sola cotización.
