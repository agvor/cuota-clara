# Ajuste de contrato y resultados v3 (planificado)

Este documento traduce las observaciones de producto en trabajo comprobable. Describe el destino; el comportamiento actual sigue documentado como v2 hasta que US-021 lo migre.

## Diferencia que debe migrarse

| Concepto                   | v2 actual               | v3 acordado                                                  |
| -------------------------- | ----------------------- | ------------------------------------------------------------ |
| Campo ingresado como cuota | Cuota base, sin seguro. | Cuota total, incluido seguro.                                |
| Cálculo base               | No se deriva.           | `cuota total − seguro mensual`.                              |
| Total proyectado           | Cuota base + seguro.    | Cuota total; principal, interés y seguro siguen desglosados. |
| V2 almacenado              | Contrato activo.        | Dato heredado hasta migración explícita.                     |

No se debe interpretar automáticamente la cuota v2 como cuota total: hacerlo cambiaría el importe contractual conocido. La migración solicitará confirmación de la persona usuaria o conservará el préstamo como heredado.

## Calendario de 360 cuotas

La primera cuota se programa un mes después de la fecha de inicio. La cuota número `N` se programa `N` meses después. Por tanto, un inicio `2026-01-15` y 360 cuotas termina `2056-01-15`; un inicio el día 31 usa el último día de los meses que no tienen día 31 y recupera el día 31 cuando exista. La prueba de dominio debe cubrir ambos casos.

## Caso de referencia solicitado

| Entrada                |          Valor |
| ---------------------- | -------------: |
| Principal              |    115,000,000 |
| Cuotas                 |            360 |
| Cuota total            |        900,000 |
| Seguro                 |        150,000 |
| Cuota base derivada    |        750,000 |
| Tasa nominal anual     | 8.5% (`0.085`) |
| Interés del primer mes |     814,583.33 |

La cuota base no cubre ese interés inicial. US-021 debe emitir un error contractual trazable; no puede presentar un plan amortizable ni absorber silenciosamente la diferencia con el seguro.

## Presentación acordada

1. Un único formateador monetario se usa en toda la PWA, con separadores de miles y decimales coherentes con el locale seleccionado (`es-CR` inicialmente).
2. El resumen inmediato usa una tabla compacta de importes: principal, interés, seguro y total; además muestra fecha/numero de última cuota y saldo pendiente si existe.
3. La página inicial del préstamo no ejecuta la tabla completa ni renderiza el gráfico. Una acción **Ver detalle de amortización** los calcula bajo demanda.
4. El gráfico debe tener eje X temporal, eje Y monetario, etiquetas accesibles y controles de rango; la tabla debe conservar cabecera, contraste, columnas numéricas alineadas y navegación de páginas.

## Secuencia de entrega

- **US-021:** contrato total, migración y casos de referencia.
- **US-022:** formato monetario universal y resumen inmediato.
- **US-023:** detalle de amortización y gráfico ajustable bajo demanda.
