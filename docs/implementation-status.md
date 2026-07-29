# Estado de implementación

> Generado desde `docs/backlog.json` el 2026-07-28. No editar manualmente.

**Siguiente ítem habilitado:** ninguno; revisar dependencias o bloqueos.

| Épica | Planeado | Listo | En curso | Bloqueado | Completado |
| --- | ---: | ---: | ---: | ---: | ---: |
| E1 · Motor financiero verificable | 0 | 0 | 0 | 0 | 7 |
| E2 · Importación y datos locales | 0 | 0 | 0 | 0 | 3 |
| E3 · PWA y gestión de préstamos | 0 | 0 | 0 | 0 | 3 |
| E4 · Escenarios y resultados | 0 | 0 | 0 | 0 | 2 |
| E5 · Respaldo y publicación | 1 | 0 | 0 | 0 | 1 |

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
