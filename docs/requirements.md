# Requisitos y alcance inicial

## Propósito

CuotaClara ayuda a una persona a reconstruir y proyectar sus préstamos, entender su costo y comparar estrategias de pago. La primera versión se dirige a préstamos amortizables de cuota periódica, comunes en Costa Rica, sin impedir que el modelo evolucione a otros países y tipos de crédito.

## Alcance del MVP

El MVP es una PWA web responsive, local-first y gratuita. Permite administrar varios préstamos independientes, registrar o importar pagos históricos, reconstruir un estado de corte y comparar una proyección base frente a estrategias de pago extraordinario. Soporta una secuencia de tasa fija inicial y una regla de tasa variable posterior.

Quedan fuera del MVP: cuentas, sincronización, cobros, colaboración, importación directa de PDF/XLSX dentro de la PWA, optimización automática, ejecución de fórmulas arbitrarias y aplicaciones nativas. Un conversor local externo puede preparar el CSV compatible sin ampliar el flujo de importación de la aplicación. Las interfaces se diseñarán para permitir esas extensiones sin incluir su complejidad ahora.

## Requisitos funcionales

| ID     | Requisito                               | Criterios de aceptación iniciales                                                                                                                                                                                                                                                                          | Estado     |
| ------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-001 | Administrar préstamos independientes.   | Crear, editar, duplicar y eliminar con confirmación; la información de cada préstamo se mantiene aislada, se organiza por tareas y conserva su vista activa en una ruta local.                                                                                                                             | En curso   |
| RF-002 | Configurar el préstamo.                 | Se registran moneda, monto original, fecha inicial, fecha final o total de cuotas, seguro y cuota mensual total configurada o automática; la cuota base se deriva como total − seguro.                                                                                                                     | En curso   |
| RF-003 | Configurar plan de tasas.               | Se define fase fija por cuotas y fase variable posterior con regla versionada: serie manual o TBP+margen, frecuencia de revisión y supuestos explícitos; los campos se expresan en porcentaje.                                                                                                             | Completado |
| RF-004 | Calcular una proyección base.           | Para cada periodo se muestran saldo inicial/final, tasa, cuota, seguro, interés, principal y pago total; el resultado es determinista, puede calcular la cuota automática y continúa desde el último pago histórico o desde un reset bancario confirmado.                                                  | En curso   |
| RF-005 | Registrar pagos históricos manualmente. | Se validan fecha, importes y desglose disponible; cada pago conserva su origen y notas.                                                                                                                                                                                                                    | En curso   |
| RF-006 | Importar registro de pagos en CSV.      | Se acepta una plantilla CSV, se muestra una previsualización con errores, duplicados e inconsistencias antes de guardar. La importación no altera datos hasta confirmación; un conversor local documentado puede preparar CSV desde el plan PDF compatible y solicitar un saldo bancario para reconciliar. | En curso   |
| RF-007 | Reconstruir y reconciliar el estado.    | El sistema distingue pagos históricos de proyecciones, acumula principal e interés importados, calcula el saldo a la fecha de corte y permite un ajuste de reconciliación trazable junto con un punto de reset bancario.                                                                                   | En curso   |
| RF-008 | Configurar pagos extraordinarios.       | Se soportan pagos únicos, extraordinario mensual fijo y objetivo mensual de principal; no modifican el historial real.                                                                                                                                                                                     | En curso   |
| RF-009 | Comparar escenarios.                    | Se compara la base con alternativas por fecha final, plazo, pago total e interés; el gráfico muestra hasta dos alternativas y la tabla permite elegir base o una alternativa.                                                                                                                              | En curso   |
| RF-010 | Visualizar resultados.                  | El resumen se muestra primero; tabla paginada ordenable por fecha y con fuente seleccionable, y gráfico con ejes, cuadrícula, rango por fechas, señales seleccionables, tabla comparativa del punto y punto fijable se solicitan bajo demanda.                                                             | Completado |
| RF-011 | Persistir y respaldar datos locales.    | Los datos sobreviven reinicios, se pueden exportar a una copia de respaldo e importar tras validación.                                                                                                                                                                                                     | En curso   |
| RF-012 | Operar sin conexión.                    | Las funciones MVP funcionan después de instalar/cargar la PWA, sin cuenta ni red.                                                                                                                                                                                                                          | En curso   |
| RF-013 | Estimar costo y fecha contractual.      | Antes de confirmar el préstamo se estiman fecha final, cuotas, principal, interés, seguro y total desembolsado; usa cuota total y límites explícitos. Con un reset, el resumen suma los importes históricos conocidos y los proyectados posteriores.                                                       | En curso   |
| RF-014 | Configurar escenario de TBP+margen.     | La fase variable permite TBP promedio configurable, margen, frecuencia y evolución estable/alza/baja reproducible por escenario, sin consultar red.                                                                                                                                                        | Completado |
| RF-015 | Presentar resumen financiero legible.   | Todos los importes de lectura usan formato monetario localizado y el préstamo muestra fecha final, total pagado, principal e interés antes del detalle.                                                                                                                                                    | Completado |

### Precisiones del modelo de tasa

- El contrato declara fecha final o número total de cuotas; no se infiere un plazo sin que la persona usuaria lo confirme.
- La fase fija tiene un número de cuotas inequívoco. La fase variable declara una regla versionada: serie manual fechada o **TBP+margen** con TBP promedio configurable por escenario y sin consulta de red.
- La frecuencia de revisión es distinta de la periodicidad de pago y debe estar representada explícitamente.
- Un cambio de tasa conserva cuota. El plazo declarado no se altera: la estimación muestra el saldo pendiente o la cuota final reducida.
- La cuota mensual ingresada es el total exigible e incluye seguro. La cuota base que amortiza principal e interés es `cuota total − seguro`; el seguro no se financia ni se aplica a principal. Para v3, el plazo declarado es autoritativo: la proyección compara la cuota configurada con la cuota necesaria bajo sus supuestos, en lugar de acortar el contrato.
- La cuota puede ser **configurada** o **automática**. La automática se calcula localmente con el monto, plazo, seguro y plan de tasas; se persiste como modo del contrato y presenta su resultado sin compararlo contra una cuota configurada.
- Con `N` cuotas mensuales, la última fecha programada es la fecha de inicio desplazada exactamente `N` meses, conservando el día ancla cuando exista. Por ejemplo, 360 cuotas equivalen a 30 años.
- Los importes de lectura se presentan en `es-CR` con símbolo de moneda, separadores de miles y escala contractual. Los campos monetarios editables conservan el literal decimal canónico; todo campo de tasa usa porcentaje legible (por ejemplo, `8.5` representa `8.5%`) y la PWA lo convierte al decimal canónico antes de invocar el dominio.
- No se asume que una proyección coincida con un banco sin validar su convención de días, fechas, redondeo, seguros y aplicación de pagos.
- Una reconciliación bancaria declara el saldo principal reportado, la fecha a la que corresponde y la fecha de última cuota proyectada por la entidad. La proyección posterior parte de ese saldo y recalcula su cuota para llegar a esa fecha, manteniendo el calendario de tasas y los cargos configurados.
- El saldo reconstruido se calcula con el monto original menos la suma de principal ordinario y extraordinario de los pagos históricos. El interés importado no reduce saldo, pero integra el interés y total pagado acumulados del resumen.
- Sin reset bancario, una proyección con historial comienza en la primera cuota contractual posterior al último pago histórico y usa como saldo inicial el saldo reconstruido. La tabla muestra el saldo de cierre de cada pago histórico; no repite el calendario desde el monto original.
- Cuando el saldo reportado es menor que el reconstruido, la aplicación ofrece —sin asumirlo— registrar la diferencia como ajuste de reconciliación aplicado al principal. El ajuste se muestra en el historial y no inventa interés, seguro ni comisión. Un saldo reportado mayor se conserva como discrepancia que requiere revisión.

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
