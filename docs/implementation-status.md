# Estado de implementación

> Generado desde `docs/backlog.json` el 2026-07-28. No editar manualmente.

**Siguiente ítem habilitado:** US-003 — Resolver una tasa fija por periodo

| Épica | Planeado | Listo | En curso | Bloqueado | Completado |
| --- | ---: | ---: | ---: | ---: | ---: |
| E1 · Motor financiero verificable | 4 | 1 | 0 | 0 | 2 |
| E2 · Importación y datos locales | 2 | 0 | 0 | 0 | 0 |
| E3 · PWA y gestión de préstamos | 3 | 0 | 0 | 0 | 0 |
| E4 · Escenarios y resultados | 2 | 0 | 0 | 0 | 0 |
| E5 · Respaldo y publicación | 2 | 0 | 0 | 0 | 0 |

## Historias

| ID | Épica | Historia | Estado | Depende de |
| --- | --- | --- | --- | --- |
| US-001 | E1 · Motor financiero verificable | Establecer casos de referencia financieros | Completado | — |
| US-002 | E1 · Motor financiero verificable | Representar dinero y redondeo de forma decimal | Completado | US-001 |
| US-003 | E1 · Motor financiero verificable | Resolver una tasa fija por periodo | Listo | US-002 |
| US-004 | E1 · Motor financiero verificable | Generar amortización de cuota periódica fija | Planeado | US-003 |
| US-005 | E1 · Motor financiero verificable | Reconstruir estado desde pagos históricos | Planeado | US-004 |
| US-006 | E1 · Motor financiero verificable | Aplicar pagos extraordinarios únicos | Planeado | US-004 |
| US-007 | E1 · Motor financiero verificable | Resolver tasa fija seguida de serie variable manual | Planeado | US-004 |
| US-008 | E2 · Importación y datos locales | Validar y previsualizar un CSV de pagos | Planeado | US-005 |
| US-009 | E2 · Importación y datos locales | Persistir préstamos mediante un puerto local | Planeado | US-005 |
| US-010 | E3 · PWA y gestión de préstamos | Crear la PWA y navegar préstamos | Planeado | US-009 |
| US-011 | E3 · PWA y gestión de préstamos | Crear y editar un préstamo | Planeado | US-007, US-010 |
| US-012 | E3 · PWA y gestión de préstamos | Registrar e importar pagos desde la interfaz | Planeado | US-008, US-010 |
| US-013 | E4 · Escenarios y resultados | Comparar escenario base y pago extraordinario | Planeado | US-006, US-011 |
| US-014 | E4 · Escenarios y resultados | Mostrar tabla y evolución de saldo | Planeado | US-012, US-013 |
| US-015 | E5 · Respaldo y publicación | Respaldar y restaurar datos locales | Planeado | US-009, US-011 |
| US-016 | E5 · Respaldo y publicación | Completar experiencia offline e instalación | Planeado | US-014, US-015 |
