# Requisitos y alcance inicial

## Propósito

CuotaClara ayuda a una persona a reconstruir y proyectar sus préstamos, entender su costo y comparar estrategias de pago. La primera versión se dirige a préstamos amortizables de cuota periódica, comunes en Costa Rica, sin impedir que el modelo evolucione a otros países y tipos de crédito.

## Alcance del MVP

El MVP es una PWA web responsive, local-first y gratuita. Permite administrar varios préstamos independientes, registrar o importar pagos históricos, reconstruir un estado de corte y comparar una proyección base frente a estrategias de pago extraordinario. Soporta una secuencia de tasa fija inicial y una regla de tasa variable posterior.

Quedan fuera del MVP: cuentas, sincronización, cobros, colaboración, PDF/XLSX, optimización automática, ejecución de fórmulas arbitrarias y aplicaciones nativas. Las interfaces se diseñarán para permitir esas extensiones sin incluir su complejidad ahora.

## Requisitos funcionales

| ID     | Requisito                               | Criterios de aceptación iniciales                                                                                                                                           | Estado   |
| ------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| RF-001 | Administrar préstamos independientes.   | Crear, editar, duplicar y eliminar con confirmación; la información de cada préstamo se mantiene aislada.                                                                   | Planeado |
| RF-002 | Configurar el préstamo.                 | Se registran moneda, monto/saldo inicial, fechas, plazo, periodicidad, cuota ordinaria, cargos y política de redondeo.                                                      | Planeado |
| RF-003 | Configurar plan de tasas.               | Se define una fase fija con tasa y periodo, seguida opcionalmente por una fase variable cuya regla, frecuencia de revisión y supuestos quedan explícitos.                   | En curso |
| RF-004 | Calcular una proyección base.           | Para cada periodo se muestran saldo inicial/final, tasa, cuota, interés, principal, cargos y pago total. El resultado es determinista.                                      | En curso |
| RF-005 | Registrar pagos históricos manualmente. | Se validan fecha, importes y desglose disponible; cada pago conserva su origen y notas.                                                                                     | En curso |
| RF-006 | Importar registro de pagos en CSV.      | Se acepta una plantilla CSV, se muestra una previsualización con errores, duplicados e inconsistencias antes de guardar. La importación no altera datos hasta confirmación. | En curso |
| RF-007 | Reconstruir y reconciliar el estado.    | El sistema distingue pagos históricos de proyecciones, calcula el saldo a la fecha de corte y permite un ajuste de reconciliación trazable.                                 | En curso |
| RF-008 | Configurar pagos extraordinarios.       | Se soportan pagos únicos y un importe mensual fijo que reduce plazo; no modifica el historial real.                                                                         | En curso |
| RF-009 | Comparar escenarios.                    | Se comparan al menos escenario base y un escenario alternativo por fecha final, plazo restante, pago total, interés y ahorro.                                               | En curso |
| RF-010 | Visualizar resultados.                  | Se muestra tabla paginada o virtualizada y gráfico de evolución de saldo; pagos históricos y proyecciones se distinguen.                                                    | Planeado |
| RF-011 | Persistir y respaldar datos locales.    | Los datos sobreviven reinicios, se pueden exportar a una copia de respaldo e importar tras validación.                                                                      | Planeado |
| RF-012 | Operar sin conexión.                    | Las funciones MVP funcionan después de instalar/cargar la PWA, sin cuenta ni red.                                                                                           | Planeado |

### Precisiones del modelo de tasa

- La fase fija tiene una fecha de inicio y un número de periodos o fecha final inequívocos.
- La fase variable declara una regla versionada: por ejemplo, serie manual de tasas, referencia más margen o valor fijo de supuesto. El MVP implementará primero una **serie manual fechada**, porque es reproducible y no depende de una fuente externa.
- La frecuencia de revisión es distinta de la periodicidad de pago y debe estar representada explícitamente.
- La decisión de si un cambio de tasa mantiene cuota o plazo será una política configurable. El primer comportamiento implementado será **mantener la cuota y recalcular el plazo**, salvo que el contrato de referencia exija otra política.
- No se asume que una proyección coincida con un banco sin validar su convención de días, fechas, redondeo, seguros y aplicación de pagos.

## Requisitos no funcionales

| ID      | Requisito                         | Criterio verificable                                                                                                     | Estado   |
| ------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| RNF-001 | Precisión decimal.                | El dominio no usa punto flotante binario para valores financieros; las políticas de redondeo se prueban.                 | En curso |
| RNF-002 | Determinismo y trazabilidad.      | Igual entrada y versión del motor producen igual salida; una proyección conserva versión y supuestos.                    | En curso |
| RNF-003 | Separación arquitectónica.        | El motor de dominio no depende de React, IndexedDB, red ni gráficos.                                                     | En curso |
| RNF-004 | Integridad histórica.             | Una simulación no puede mutar pagos históricos ni el préstamo real.                                                      | En curso |
| RNF-005 | Privacidad local-first.           | El MVP no transmite datos financieros a un servidor.                                                                     | Planeado |
| RNF-006 | Importación segura y recuperable. | La importación valida antes de confirmar y los respaldos se validan antes de restaurar.                                  | En curso |
| RNF-007 | Rendimiento.                      | Una proyección de hasta 600 periodos se calcula interactivamente en equipo convencional; se medirá antes de optimizar.   | Planeado |
| RNF-008 | Accesibilidad y adaptación.       | Flujos principales utilizables con teclado y pantallas pequeñas; objetivo WCAG 2.1 AA.                                   | Planeado |
| RNF-009 | Portabilidad.                     | Funciona en navegadores modernos de escritorio y móviles; la PWA es instalable.                                          | Planeado |
| RNF-010 | Evolución freemium.               | Persistencia, identidad y sincronización se consumen mediante puertos; el dominio no conoce planes de pago.              | Planeado |
| RNF-011 | Calidad del cálculo.              | Cada regla financiera tiene pruebas unitarias y casos de referencia comparados con fuente contractual u hoja de cálculo. | Planeado |
| RNF-012 | Seguridad de fórmulas.            | No hay ejecución de código arbitrario. Si se agregan fórmulas, usarán un lenguaje limitado validado.                     | Planeado |

## Entregas

1. **Motor verificable:** préstamo de tasa fija, amortización, dinero decimal, redondeo y pagos extraordinarios únicos.
2. **MVP local:** CRUD, pagos manuales, CSV con previsualización, tasa fija→variable por serie manual, escenarios básicos, IndexedDB, gráfico y respaldo.
3. **Estrategias avanzadas:** pagos recurrentes y aporte objetivo al principal, más reglas de tasa variable y comparación ampliada.
4. **Producto público:** PWA pulida, accesibilidad, guía inicial y exportación CSV.
5. **Premium opcional:** cuentas, sincronización, informes y optimización, únicamente tras validar valor y privacidad.
