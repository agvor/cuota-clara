# Documentación viva

La documentación es parte del producto y se mantiene en el mismo cambio que el código. No se usa como una descripción aspiracional separada de la implementación.

## Fuentes de verdad

| Tema                                            | Fuente                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| Alcance y comportamiento                        | `requirements.md`                                                          |
| Conceptos y reglas del dominio                  | `domain/glossary.md`                                                       |
| Motor de amortización inicial                   | `domain/amortization-engine.md`                                            |
| Estado histórico y reconciliación               | `domain/historical-state.md`                                               |
| Transición a tasa variable manual               | `domain/manual-variable-rates.md`                                          |
| Escenarios de aporte recurrente                 | `domain/recurring-extra-payment-scenarios.md`                              |
| Cotización bancaria pendiente de reconciliación | `financial-reference-cases/pending-bank-quote-fixed-variable.md`           |
| Escenarios con pago extraordinario único        | `domain/one-time-extra-payment-scenarios.md`                               |
| Préstamo y puerto de repositorio                | `domain/loan-and-repository.md`                                            |
| Contratos v2/v3, seguro y escenarios TBP+margen | `domain/loan-contract-v2.md` y `domain/contract-payment-and-results-v3.md` |
| Importación CSV de pagos                        | `import/payment-csv.md`                                                    |
| Conversión local de plan de pagos PDF           | `import/payment-plan-pdf-converter.md`                                     |
| Persistencia local, migraciones y recuperación  | `infrastructure/local-persistence.md`                                      |
| Respaldo y restauración                         | `backup.md`                                                                |
| PWA, navegación y estado offline actual         | `pwa.md`                                                                   |
| Preparación y ejecución local                   | `run.md`                                                                   |
| Límites y componentes                           | `architecture.md`                                                          |
| Decisiones irreversibles                        | `adr/`                                                                     |
| Estado de requisitos                            | `traceability.json` → `status.md`                                          |
| Plan y estado de implementación                 | `backlog.json` → `implementation-status.md`                                |
| Dependencias y criterios de selección           | `technologies.md`                                                          |

`status.md`, `implementation-status.md` y `run.md` se generan desde sus fuentes; nunca se editan a mano. Ejecuta `pnpm docs:sync` tras cambiar el estado de una entrega, scripts o paquetes de ejecución. `pnpm docs:check` comprueba que los informes generados sigan coherentes. La automatización evita desalineación mecánica; actualizar el contenido de una decisión sigue siendo responsabilidad de quien hace el cambio.

## Ciclo de documentación

1. Añade o ajusta requisito y criterios de aceptación antes de programar.
2. Registra un ADR si se cambia arquitectura, una interfaz transversal o tecnología.
3. Implementa con pruebas y actualiza la trazabilidad.
4. Genera el estado y ejecuta la validación.

Los documentos están deliberadamente en español; los identificadores y nombres de código permanecen en inglés para consistencia técnica.
