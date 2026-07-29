# Requisitos y alcance inicial

## Propósito

CuotaClara ayuda a una persona a reconstruir y proyectar sus préstamos, entender su costo y comparar estrategias de pago. La primera versión se dirige a préstamos amortizables de cuota periódica, comunes en Costa Rica, sin impedir que el modelo evolucione a otros países y tipos de crédito.

## Alcance del MVP

El MVP es una PWA web responsive, local-first y gratuita. Permite administrar varios préstamos independientes, registrar o importar pagos históricos, reconstruir un estado de corte y comparar una proyección base frente a estrategias de pago extraordinario. Soporta una secuencia de tasa fija inicial y una regla de tasa variable posterior.

Quedan fuera del MVP: cuentas, sincronización, cobros, colaboración, PDF/XLSX, optimización automática, ejecución de fórmulas arbitrarias y aplicaciones nativas. Las interfaces se diseñarán para permitir esas extensiones sin incluir su complejidad ahora.

## Requisitos funcionales

| ID     | Requisito                               | Criterios de aceptación iniciales                                                                                                                                           | Estado     |
| ------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-001 | Administrar préstamos independientes.   | Crear, editar, duplicar y eliminar con confirmación; la información de cada préstamo se mantiene aislada.                                                                   | En curso   |
| RF-002 | Configurar el préstamo.                 | Se registran moneda, monto original, fecha inicial, fecha final o total de cuotas, cuota mensual, seguro mensual, periodicidad y política de redondeo.                      | Completado |
| RF-003 | Configurar plan de tasas.               | Se define fase fija por cuotas y fase variable posterior con regla versionada: serie manual o TBP+margen, frecuencia de revisión y supuestos explícitos.                    | Completado |
| RF-004 | Calcular una proyección base.           | Para cada periodo se muestran saldo inicial/final, tasa, cuota, seguro, interés, principal y pago total. El resultado es determinista.                                      | En curso   |
| RF-005 | Registrar pagos históricos manualmente. | Se validan fecha, importes y desglose disponible; cada pago conserva su origen y notas.                                                                                     | En curso   |
| RF-006 | Importar registro de pagos en CSV.      | Se acepta una plantilla CSV, se muestra una previsualización con errores, duplicados e inconsistencias antes de guardar. La importación no altera datos hasta confirmación. | En curso   |
| RF-007 | Reconstruir y reconciliar el estado.    | El sistema distingue pagos históricos de proyecciones, calcula el saldo a la fecha de corte y permite un ajuste de reconciliación trazable.                                 | En curso   |
| RF-008 | Configurar pagos extraordinarios.       | Se soportan pagos únicos y un importe mensual fijo que reduce plazo; no modifica el historial real.                                                                         | En curso   |
| RF-009 | Comparar escenarios.                    | Se comparan al menos escenario base y un escenario alternativo por fecha final, plazo restante, pago total, interés y ahorro.                                               | En curso   |
| RF-010 | Visualizar resultados.                  | Se muestra tabla paginada o virtualizada y gráfico de evolución de saldo; pagos históricos y proyecciones se distinguen.                                                    | Planeado   |
| RF-011 | Persistir y respaldar datos locales.    | Los datos sobreviven reinicios, se pueden exportar a una copia de respaldo e importar tras validación.                                                                      | En curso   |
| RF-012 | Operar sin conexión.                    | Las funciones MVP funcionan después de instalar/cargar la PWA, sin cuenta ni red.                                                                                           | En curso   |
| RF-013 | Estimar costo y fecha contractual.      | Antes de confirmar el préstamo se estiman fecha final, cuotas, principal, interés, seguro y total desembolsado; supuestos y límites se muestran explícitamente.             | Completado |
| RF-014 | Configurar escenario de TBP+margen.     | La fase variable permite TBP promedio configurable, margen, frecuencia y evolución estable/alza/baja reproducible por escenario, sin consultar red.                         | Completado |

### Precisiones del modelo de tasa

- El contrato declara fecha final o número total de cuotas; no se infiere un plazo sin que la persona usuaria lo confirme.
- La fase fija tiene un número de cuotas inequívoco. La fase variable declara una regla versionada: serie manual fechada o **TBP+margen** con TBP promedio configurable por escenario y sin consulta de red.
- La frecuencia de revisión es distinta de la periodicidad de pago y debe estar representada explícitamente.
- Un cambio de tasa conserva cuota. El plazo declarado no se altera: la estimación muestra el saldo pendiente o la cuota final reducida.
- El seguro mensual se muestra separado; la propuesta inicial no lo financia ni lo aplica a principal.
- No se asume que una proyección coincida con un banco sin validar su convención de días, fechas, redondeo, seguros y aplicación de pagos.

## Requisitos no funcionales

| ID      | Requisito                         | Criterio verificable                                                                                                     | Estado   |
| ------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| RNF-001 | Precisión decimal.                | El dominio no usa punto flotante binario para valores financieros; las políticas de redondeo se prueban.                 | En curso |
| RNF-002 | Determinismo y trazabilidad.      | Igual entrada y versión del motor producen igual salida; una proyección conserva versión y supuestos.                    | En curso |
| RNF-003 | Separación arquitectónica.        | El motor de dominio no depende de React, IndexedDB, red ni gráficos.                                                     | En curso |
| RNF-004 | Integridad histórica.             | Una simulación no puede mutar pagos históricos ni el préstamo real.                                                      | En curso |
| RNF-005 | Privacidad local-first.           | El MVP no transmite datos financieros a un servidor.                                                                     | En curso |
| RNF-006 | Importación segura y recuperable. | La importación valida antes de confirmar y los respaldos se validan antes de restaurar.                                  | En curso |
| RNF-007 | Rendimiento.                      | Una proyección de hasta 600 periodos se calcula interactivamente en equipo convencional; se medirá antes de optimizar.   | Planeado |
| RNF-008 | Accesibilidad y adaptación.       | Flujos principales utilizables con teclado y pantallas pequeñas; objetivo WCAG 2.1 AA.                                   | En curso |
| RNF-009 | Portabilidad.                     | Funciona en navegadores modernos de escritorio y móviles; la PWA es instalable.                                          | En curso |
| RNF-010 | Evolución freemium.               | Persistencia, identidad y sincronización se consumen mediante puertos; el dominio no conoce planes de pago.              | En curso |
| RNF-011 | Calidad del cálculo.              | Cada regla financiera tiene pruebas unitarias y casos de referencia comparados con fuente contractual u hoja de cálculo. | Planeado |
| RNF-012 | Seguridad de fórmulas.            | No hay ejecución de código arbitrario. Si se agregan fórmulas, usarán un lenguaje limitado validado.                     | Planeado |

## Entregas

1. **Motor verificable:** préstamo de tasa fija, amortización, dinero decimal, redondeo y pagos extraordinarios únicos.
2. **MVP local:** CRUD, pagos manuales, CSV con previsualización, tasa fija→variable por serie manual o TBP+margen local, escenarios básicos, IndexedDB, gráfico y respaldo.
3. **Estrategias avanzadas:** pagos recurrentes y aporte objetivo al principal, más reglas de tasa variable y comparación ampliada.
4. **Producto público:** PWA pulida, accesibilidad, guía inicial y exportación CSV.
5. **Premium opcional:** cuentas, sincronización, informes y optimización, únicamente tras validar valor y privacidad.
