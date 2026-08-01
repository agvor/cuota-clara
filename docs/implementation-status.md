# Estado de implementación

> Generado desde `docs/backlog.json` el 2026-07-31. No editar manualmente.

**Siguiente ítem habilitado:** ninguno; revisar dependencias o bloqueos.

| Épica | Planeado | Listo | En curso | Bloqueado | Completado |
| --- | ---: | ---: | ---: | ---: | ---: |
| E1 · Motor financiero verificable | 0 | 0 | 0 | 0 | 7 |
| E2 · Importación y datos locales | 0 | 0 | 1 | 0 | 4 |
| E3 · PWA y gestión de préstamos | 0 | 0 | 0 | 0 | 10 |
| E4 · Escenarios y resultados | 0 | 0 | 0 | 0 | 9 |
| E5 · Respaldo y publicación | 1 | 0 | 0 | 0 | 1 |
| E6 · Contrato financiero v2 | 1 | 0 | 0 | 0 | 4 |
| E7 · Contrato y resultados legibles | 0 | 0 | 0 | 0 | 6 |

## Historias

| ID | Épica | Historia | Estado | Depende de |
| --- | --- | --- | --- | --- |
| US-001 | E1 · Motor financiero verificable | Establecer casos de referencia financieros | Completado | — |
| US-002 | E1 · Motor financiero verificable | Representar dinero y redondeo de forma decimal | Completado | US-001 |
| US-003 | E1 · Motor financiero verificable | Resolver una tasa fija por periodo | Completado | US-002 |
| US-004 | E1 · Motor financiero verificable | Generar amortización de cuota periódica fija | Completado | US-003 |
| US-005 | E1 · Motor financiero verificable | Reconstruir estado desde pagos históricos | Completado | US-004 |
| US-006 | E1 · Motor financiero verificable | Aplicar pagos extraordinarios únicos | Completado | US-004 |
| US-007 | E1 · Motor financiero verificable | Resolver tasa fija seguida de serie variable manual | Completado | US-004 |
| US-008 | E2 · Importación y datos locales | Validar y previsualizar un CSV de pagos | Completado | US-005 |
| US-008a | E2 · Importación y datos locales | Definir préstamo y puerto de repositorio | Completado | US-005 |
| US-009 | E2 · Importación y datos locales | Persistir préstamos mediante un puerto local | Completado | US-008a |
| US-010 | E3 · PWA y gestión de préstamos | Crear la PWA y navegar préstamos | Completado | US-009 |
| US-011 | E3 · PWA y gestión de préstamos | Crear y editar un préstamo | Completado | US-007, US-010 |
| US-012 | E3 · PWA y gestión de préstamos | Registrar e importar pagos desde la interfaz | Completado | US-008, US-010 |
| US-013 | E4 · Escenarios y resultados | Comparar escenario base y pago extraordinario | Completado | US-006, US-011 |
| US-014 | E4 · Escenarios y resultados | Mostrar tabla y evolución de saldo | Completado | US-012, US-013 |
| US-015 | E5 · Respaldo y publicación | Respaldar y restaurar datos locales | Completado | US-009, US-011 |
| US-016 | E5 · Respaldo y publicación | Completar experiencia offline e instalación | Planeado | US-014, US-015 |
| US-017 | E6 · Contrato financiero v2 | Modelar plazo, seguro y migración de préstamo | Completado | US-015 |
| US-018 | E6 · Contrato financiero v2 | Estimar fecha y costo inicial del préstamo | Completado | US-017 |
| US-019 | E6 · Contrato financiero v2 | Resolver tasa variable TBP más margen | Completado | US-017 |
| US-020 | E6 · Contrato financiero v2 | Configurar contrato y escenario TBP desde la PWA | Completado | US-018, US-019 |
| US-021 | E7 · Contrato y resultados legibles | Migrar a cuota total incluida con seguro | Completado | US-020 |
| US-022 | E7 · Contrato y resultados legibles | Mostrar resumen y dinero con formato universal | Completado | US-021 |
| US-023 | E7 · Contrato y resultados legibles | Consultar amortización y gráfico bajo demanda | Completado | US-022 |
| US-024 | E7 · Contrato y resultados legibles | Preservar el plazo contractual al estimar cuotas | Completado | US-023 |
| US-025 | E7 · Contrato y resultados legibles | Hacer legibles y explorables tasas, cuotas y proyección | Completado | US-024 |
| US-026 | E7 · Contrato y resultados legibles | Calcular cuota automática y explorar componentes de proyección | Completado | US-025 |
| US-027 | E4 · Escenarios y resultados | Proyectar aportes recurrentes y comparar dos escenarios | Completado | US-026 |
| US-028 | E4 · Escenarios y resultados | Unificar administración y comparación visual de escenarios | Completado | US-027 |
| US-029 | E6 · Contrato financiero v2 | Reconciliar cuota bancaria con tasa fija inicial y variable proyectada | Planeado | US-028 |
| US-030 | E4 · Escenarios y resultados | Mejorar la experiencia de gestión y resumen de escenarios | Completado | US-028 |
| US-031 | E4 · Escenarios y resultados | Comparar señales de amortización con un punto fijable | Completado | US-030 |
| US-032 | E4 · Escenarios y resultados | Clarificar señales y lectura de comparación gráfica | Completado | US-031 |
| US-033 | E4 · Escenarios y resultados | Configurar el rango temporal del gráfico | Completado | US-032 |
| US-034 | E4 · Escenarios y resultados | Elegir la fuente de la tabla de amortización | Completado | US-033 |
| US-035 | E3 · PWA y gestión de préstamos | Organizar el préstamo como espacio de trabajo por tareas | Completado | US-034 |
| US-036 | E3 · PWA y gestión de préstamos | Conservar navegación y reducir formularios permanentes | Completado | US-035 |
| US-037 | E3 · PWA y gestión de préstamos | Unificar el lenguaje visual de las tareas locales | Completado | US-036 |
| US-038 | E3 · PWA y gestión de préstamos | Unificar la presentación de tablas financieras | Completado | US-037 |
| US-039 | E3 · PWA y gestión de préstamos | Afinar el detalle de proyección y escenarios | Completado | US-038 |
| US-040 | E3 · PWA y gestión de préstamos | Conservar el contexto de análisis del préstamo | Completado | US-039 |
| US-041 | E3 · PWA y gestión de préstamos | Pulir controles y referencias globales | Completado | US-040 |
| US-042 | E2 · Importación y datos locales | Convertir un plan PDF compatible en CSV de pagos | Completado | US-008 |
| US-043 | E2 · Importación y datos locales | Reconciliar pagos importados con un reset bancario | En curso | US-042 |
