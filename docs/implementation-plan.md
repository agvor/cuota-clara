# Plan de implementación

Este backlog es la ruta de trabajo del MVP. Su fuente estructurada es [`backlog.json`](backlog.json); el estado generado se consulta en [`implementation-status.md`](implementation-status.md).

## Cómo tomar el siguiente trabajo

Un agente debe tomar el primer ítem con estado `ready` cuyas dependencias estén completadas. Antes de modificar código, cambia su estado a `in_progress`, actualiza `updatedAt`, ejecuta `pnpm docs:sync` y no inicies otro ítem en paralelo. Al terminar, comprueba sus criterios de aceptación, marca `completed`, actualiza los requisitos que hayan quedado completamente entregados y ejecuta la verificación disponible en el entorno.

Un ítem solo se marca `blocked` cuando describe la decisión o evidencia externa que falta. Nunca se marca `completed` porque "el código compila": deben cumplirse todos sus criterios, pruebas y documentación.

## Épicas y orden

| Épica                               | Resultado                                                                        | Historias                                        |
| ----------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------ |
| E1 · Motor financiero verificable   | Cálculo fijo, estado histórico, pagos extra y transición a tasa variable manual. | US-001 a US-007                                  |
| E2 · Importación y datos locales    | CSV previsualizado, validado y almacenamiento local abstraído.                   | US-008, US-008a, US-009 y US-042                 |
| E3 · PWA y gestión de préstamos     | Aplicación instalable, CRUD, captura/importación de pagos y espacio de trabajo.  | US-010 a US-012, US-035 a US-041                 |
| E4 · Escenarios y resultados        | Comparación, tabla de amortización y gráfico de señales.                         | US-013, US-014, US-027 a US-028, US-030 a US-034 |
| E5 · Respaldo y publicación         | Recuperación de datos y operación offline completa.                              | US-015 a US-016                                  |
| E6 · Contrato financiero v2         | Plazo, seguro, estimación y regla variable TBP+margen migrables.                 | US-017 a US-020                                  |
| E7 · Contrato y resultados legibles | Cuota total con seguro, resumen financiero, plazo contractual y detalle visual.  | US-021 a US-026                                  |

El orden no es una excusa para omitir dependencias: el campo `dependsOn` de cada historia es autoritativo. US-017 solo depende del respaldo: la terminación de la experiencia PWA offline (US-016) no bloquea una migración de dominio/persistencia. Las decisiones ya adoptadas y las pendientes están en [`domain/loan-contract-v2.md`](domain/loan-contract-v2.md). Las historias avanzadas —fuentes de tasa de referencia, sincronización y premium— se crearán como nuevos ítems después de validar el MVP.

## Definition of Ready

Una historia está lista si tiene requisitos relacionados, dependencias completadas, criterios de aceptación comprobables y ninguna ambigüedad financiera sin declarar.

## Definition of Done

- Todas las pruebas del cambio pasan, incluyendo regresión financiera cuando aplique.
- El requisito y los criterios de aceptación se cumplen, no solo la interfaz visible.
- Requisitos, glosario, ADR y trazabilidad están actualizados cuando corresponde.
- Las comprobaciones disponibles del repositorio terminan correctamente; si una no puede correr por el entorno, se documenta el motivo y no se oculta.
- El cambio puede explicarse con entradas, políticas, resultados y limitaciones.
