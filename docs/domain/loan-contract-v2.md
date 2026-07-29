# Modelo contractual de préstamo v2

US-017 implementa el núcleo contractual, su serialización y la migración compatible. US-018 implementa la estimación de costo y fecha; US-019 la regla TBP; y US-020 expone ambas capacidades en la PWA. Ninguna ruta infiere datos que la persona usuaria no haya proporcionado.

> Estado de producto: la interpretación actual de cuota v2 será reemplazada por la cuota total acordada. El plan y las incompatibilidades de migración están en [`contract-payment-and-results-v3.md`](contract-payment-and-results-v3.md); no se implementa ni se infiere ese cambio todavía.

## Datos del contrato

La próxima versión del préstamo deberá distinguir estos datos, todos en moneda decimal del préstamo:

| Dato                                       | Regla propuesta                                  | Propósito                                                                            |
| ------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Fecha de inicio                            | Obligatoria, ISO.                                | Primer día del contrato y ancla del calendario.                                      |
| Fecha final **o** cantidad total de cuotas | Exactamente uno obligatorio.                     | Define el plazo contractual.                                                         |
| Monto original                             | Positivo.                                        | Principal originalmente financiado; no se confunde con saldo histórico reconciliado. |
| Tasa nominal anual inicial                 | Decimal anual no negativo.                       | Tasa de la fase fija.                                                                |
| Cuota mensual contractual                  | Positiva.                                        | Pago ordinario que amortiza principal e interés.                                     |
| Seguro mensual                             | No negativo; por defecto `0`.                    | Cargo mensual separado, no aplicado a principal.                                     |
| Periodicidad                               | El primer alcance será mensual (`12` pagos/año). | Evita inventar un calendario para contratos no mensuales.                            |

El seguro mensual se mostrará separado. La primera regla propuesta es que no financia principal ni devenga interés; el total de desembolsos proyectado será **principal + interés + seguro**. Comisiones u otros cargos no se introducirán hasta tener una regla contractual específica.

## Plan de interés fijo→variable

El contrato puede tener una fase fija definida por número de cuotas y una fase variable para el resto del plazo. Las reglas son versionadas y distintas:

1. **TBP + margen (`tbp_margin_v1`):** tasa nominal anual = tasa básica pasiva configurada en el escenario + margen anual.
2. **Serie manual (`manual_series_v1`):** conserva compatibilidad con la capacidad actual de introducir tasas explícitas. Los registros anteriores sin `kind` se reconocen como serie manual heredada; no se reinterpretan como TBP.

US-019 implementa `tbp_margin_v1`. La tasa básica pasiva no se consulta desde red: cada escenario conserva el supuesto completo, por lo que el cálculo es reproducible:

| Parámetro de escenario TBP | Regla propuesta                                                              |
| -------------------------- | ---------------------------------------------------------------------------- |
| TBP promedio inicial       | Decimal anual configurable por escenario.                                    |
| Evolución                  | `estable`, `alza_progresiva` o `baja_progresiva`.                            |
| Variación por revisión     | Cambio en **puntos porcentuales anuales** por revisión; es `0` para estable. |
| Frecuencia de revisión     | Mensual, trimestral, semestral o anual; independiente de la cuota.           |
| Margen                     | Decimal anual fijo del contrato, sumado a TBP.                               |

Ejemplo: TBP inicial `0.05`, margen `0.02`, alza progresiva de `0.001` trimestral ⇒ primera tasa variable `0.07`, luego `0.071`, `0.072`, etc. La variación se expresa en puntos porcentuales, no como multiplicación relativa de la TBP. Si el producto necesita la otra interpretación, se añadirá como una regla distinta y versionada.

La primera cuota variable usa la TBP inicial. La evolución se aplica después de cada frecuencia de revisión (1, 3, 6 o 12 cuotas); una baja se limita a TBP `0`, por lo que la tasa no pasa a ser negativa. La cuota mensual se conserva al cambiar la tasa. Si el plazo declarado termina con saldo, la estimación lo muestra: no extiende ni acorta silenciosamente el contrato.

## Estimación inicial obligatoria

`estimateLoanContract` produce la estimación etiquetada como proyección, no como promesa bancaria. La PWA la muestra antes de permitir guardar o editar un préstamo:

- fecha de última cuota estimada;
- cantidad total de cuotas estimada;
- principal total proyectado;
- interés total proyectado;
- seguro total proyectado;
- total de desembolsos, igual a la suma de los tres importes anteriores.

Si la cuota mensual (que excluye el seguro) no cubre el interés aplicable, no se produce una estimación y se muestra un error contractual explícito. Cuando la fecha final o el número de cuotas limita el plazo, el resultado expone el saldo remanente o el pago final distinto; nunca los ajusta silenciosamente.

El calendario mensual conserva el día de inicio cuando existe en el mes; por ejemplo, un inicio el día 31 usa el último día de febrero y vuelve al 31 en marzo. Una fecha final declarada es la última cuota, aunque produzca un periodo más corto. El cálculo sigue el modelo nominal anual ÷ 12 y no prorratea por días: ese supuesto se expone para no simular precisión bancaria inexistente.

## Decisiones vigentes y pendientes

1. La cuota mensual excluye el seguro; el seguro es fijo por mes y no se financia ni devenga interés.
2. La variación de TBP propuesta es en puntos porcentuales anuales por revisión, no porcentual relativa.
3. Ante cambio de tasa se conserva cuota. El plazo declarado sigue siendo un límite explícito: la estimación revela saldo pendiente o cuota final reducida.
4. El margen TBP+margen se tratará como decimal anual sumable.

## Migración de datos existentes

Los préstamos ya guardados no contienen plazo contractual ni seguro. Una migración no puede inventarlos:

1. conservar el préstamo v1 y permitir exportarlo;
2. al abrirlo, solicitar fecha final o cantidad de cuotas y seguro mensual antes de habilitar la nueva proyección;
3. guardar la procedencia/migración y no alterar pagos históricos ni escenarios existentes;
4. versionar respaldo y esquema de IndexedDB antes de escribir el contrato v2.

La compatibilidad de una serie manual existente se mantiene como regla variable heredada o `manual_series_v1`; TBP+margen es una regla nueva y no una reinterpretación automática de datos previos.
