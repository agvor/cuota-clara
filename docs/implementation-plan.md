# Plan de implementación

Este backlog es la ruta de trabajo del MVP. Su fuente estructurada es [`backlog.json`](backlog.json); el estado generado se consulta en [`implementation-status.md`](implementation-status.md).

## Cómo tomar el siguiente trabajo

Un agente debe tomar el primer ítem con estado `ready` cuyas dependencias estén completadas. Antes de modificar código, cambia su estado a `in_progress`, actualiza `updatedAt`, ejecuta `pnpm docs:sync` y no inicies otro ítem en paralelo. Al terminar, comprueba sus criterios de aceptación, marca `completed`, actualiza los requisitos que hayan quedado completamente entregados y ejecuta la verificación disponible en el entorno.

Un ítem solo se marca `blocked` cuando describe la decisión o evidencia externa que falta. Nunca se marca `completed` porque "el código compila": deben cumplirse todos sus criterios, pruebas y documentación.

## Épicas y orden

| Épica                               | Resultado                                                                        | Historias                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| E1 · Motor financiero verificable   | Cálculo fijo, estado histórico, pagos extra y transición a tasa variable manual. | US-001 a US-007                                                                     |
| E2 · Importación y datos locales    | CSV previsualizado, validado, idempotente y almacenamiento local abstraído.      | US-008, US-008a, US-009, US-042 a US-044 y US-051 a US-055                          |
| E3 · PWA y gestión de préstamos     | Aplicación instalable, CRUD, captura/importación de pagos y espacio de trabajo.  | US-010 a US-012, US-035 a US-041, US-048, US-050 y US-056 a US-059                  |
| E4 · Escenarios y resultados        | Comparación, tabla de amortización y gráfico de señales.                         | US-013, US-014, US-027 a US-028, US-030 a US-034, US-045 a US-047 y US-060 a US-061 |
| E5 · Respaldo y publicación         | Recuperación de datos y operación offline completa.                              | US-015 a US-016 y US-049                                                            |
| E6 · Contrato financiero v2         | Plazo, seguro, estimación y regla variable TBP+margen migrables.                 | US-017 a US-020                                                                     |
| E7 · Contrato y resultados legibles | Cuota total con seguro, resumen financiero, plazo contractual y detalle visual.  | US-021 a US-026                                                                     |

El orden no es una excusa para omitir dependencias: el campo `dependsOn` de cada historia es autoritativo. US-017 solo depende del respaldo: la terminación de la experiencia PWA offline (US-016) no bloquea una migración de dominio/persistencia. Las decisiones ya adoptadas y las pendientes están en [`domain/loan-contract-v2.md`](domain/loan-contract-v2.md). Las historias avanzadas —fuentes de tasa de referencia, sincronización y premium— se crearán como nuevos ítems después de validar el MVP.

El cierre de duplicados CSV se entregó en secuencia: US-053 estableció identidad interna, referencia externa, migración y respaldo; US-054 incorporó la clasificación y la revalidación defensiva; US-055 completó el resumen y la resolución accesible de conflictos. US-052 registró retrospectivamente las versiones de persistencia que ya existían pero no estaban reflejadas en su documento especializado. La política de identidad y duplicidad quedó implementada conforme a [`ADR-0008`](adr/0008-payment-import-identity-and-deduplication.md).

La mejora de lectura del préstamo se entregó en dos pasos. US-056 unificó el saldo principal actual, su corte y la fecha final aplicable para eliminar contradicciones entre resumen, cartera y proyección. US-057 usó esa posición única para reducir la densidad del resumen mediante divulgación progresiva y enriquecer las tarjetas sin ocultar el desglose financiero existente. La secuencia mantuvo la corrección financiera separada de la reorganización visual y permitió probarla antes del refactor de presentación.

US-059 corrigió una omisión detectada en las tarjetas entregadas por US-057: la cuota visible ahora proviene de la misma proyección vigente que el resumen y no del importe contractual original. US-058 separó después el registro completo de la página operativa de Pagos mediante una ruta local propia. La gestión permite filtrar, ordenar, corregir, seleccionar visibles o todo el registro y eliminar los pagos elegidos con un único guardado; los errores conservan la selección. Las conciliaciones y sus ajustes mantienen su identidad y trazabilidad, y la interfaz advierte que se revisen cuando cambie el historial del que dependían. La entrega no requirió una migración de dominio o persistencia ni reinterpretó datos financieros existentes.

US-060 corrigió la granularidad visual introducida al integrar el historial en US-045. El gráfico consolida por fecha exacta los flujos de varios pagos históricos y posiciona sus observaciones por tiempo transcurrido, mientras la tabla y la persistencia conservan cada `PaymentRecord` auditable. La decisión de presentación, el tratamiento de componentes desconocidos y la separación de ajustes de reconciliación están definidos en [`ADR-0009`](adr/0009-historical-chart-temporal-aggregation.md).

US-061 amplió esa vista con principal ordinario y otros componentes. Para mantener señales no solapadas, **Otros** es la parte del pago total que no corresponde a interés ni a principal ordinario o extraordinario; incluye seguro, comisiones y componentes ordinarios no clasificados, pero no ajustes de reconciliación. Si el desglose necesario falta, no se infiere el resultado.

## Definition of Ready

Una historia está lista si tiene requisitos relacionados, dependencias completadas, criterios de aceptación comprobables y ninguna ambigüedad financiera sin declarar.

## Definition of Done

- Todas las pruebas del cambio pasan, incluyendo regresión financiera cuando aplique.
- El requisito y los criterios de aceptación se cumplen, no solo la interfaz visible.
- Requisitos, glosario, ADR y trazabilidad están actualizados cuando corresponde.
- Las comprobaciones disponibles del repositorio terminan correctamente; si una no puede correr por el entorno, se documenta el motivo y no se oculta.
- El cambio puede explicarse con entradas, políticas, resultados y limitaciones.
