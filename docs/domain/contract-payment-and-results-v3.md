# Ajuste de contrato y resultados v3

Este documento traduce las observaciones de producto en trabajo comprobable. US-021 implementa el contrato v3 en dominio, persistencia local, respaldos y formulario. La migración visible de un v2 ocurre al editarlo y guardar la conservación de su total efectivo; el formato universal y el resumen inmediato pertenecen a US-022.

## Diferencia que debe migrarse

| Concepto                   | v2 heredado             | v3 implementado                                              |
| -------------------------- | ----------------------- | ------------------------------------------------------------ |
| Campo ingresado como cuota | Cuota base, sin seguro. | Cuota total, incluido seguro.                                |
| Cálculo base               | No se deriva.           | `cuota total − seguro mensual`.                              |
| Total proyectado           | Cuota base + seguro.    | Cuota total; principal, interés y seguro siguen desglosados. |
| V2 almacenado              | Dato heredado.          | Dato activo al crear o migrar explícitamente.                |

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

La cuota base configurada no cubre ese interés inicial. El plazo sigue siendo contractual: la proyección contiene 360 cuotas, termina el `2056-01-15` y muestra una cuota total inicial proyectada de `1,034,250.51` bajo la convención nominal mensual actual. La diferencia con 900,000 queda visible; no se atribuye silenciosamente al seguro ni se usa para acortar el plazo. El fixture ejecutable es [`contract-total-payment-insufficient-v1`](../../packages/domain/test/fixtures/contract-total-payment-insufficient-v1.json).

## Plazo contractual y cuota proyectada

Para v3, la fecha final o cantidad total de cuotas es autoritativa. En cada período, la PWA calcula la cuota base que liquida el saldo en las cuotas restantes usando la tasa prevista; el seguro se agrega después. La cuota total configurada permanece como dato contractual declarado y se compara con la cuota total proyectada inicial. Esto no intenta reproducir automáticamente un estado de cuenta bancario: cargos, convenciones de días y reglas de recálculo pueden diferir. La decisión completa está en [ADR-0007](../adr/0007-contract-term-is-authoritative.md).

## Presentación acordada

1. Un único formateador monetario se usa en toda la PWA, con separadores de miles y decimales coherentes con el locale seleccionado (`es-CR` inicialmente), sin convertir el decimal financiero a `number`. Los campos editables conservan el literal canónico.
2. El resumen inmediato usa una tabla compacta de importes: principal, interés, seguro y total; además muestra fecha/número de última cuota y saldo pendiente si existe.
3. La página inicial del préstamo no ejecuta la tabla completa ni renderiza el gráfico. La acción **Ver detalle de amortización** los calcula bajo demanda.
4. El gráfico tiene eje X temporal, eje Y monetario, nombre y descripción accesibles, y controles de rango. La tabla conserva cabecera, contraste, columnas numéricas alineadas y navegación de páginas.

## Secuencia de entrega

- **US-021:** contrato total, migración y casos de referencia. **Completado en dominio y persistencia.**
- **US-022:** formato monetario universal y resumen inmediato. **Completado.**
- **US-023:** detalle de amortización y gráfico ajustable bajo demanda. **Completado.**
- **US-024:** preservar plazo contractual y exponer discrepancia de cuota. **Completado.**
