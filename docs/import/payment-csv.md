# Importación de pagos por CSV

La importación comienza siempre con una previsualización. El adaptador analiza el texto, normaliza valores y devuelve filas válidas, errores, duplicados y meses faltantes; no conoce ni invoca almacenamiento local, por lo que no puede persistir datos.

## Plantilla

Usa la [plantilla CSV](payment-history-template.csv). Los encabezados son obligatorios tal como se muestran:

| Campo                    | Obligatorio | Descripción                                                                  |
| ------------------------ | ----------- | ---------------------------------------------------------------------------- |
| `id`                     | Sí          | Identificador único del pago.                                                |
| `date`                   | Sí          | Fecha, en el formato regional elegido.                                       |
| `total_amount`           | Sí          | Total pagado.                                                                |
| `interest_amount`        | No          | Interés conocido.                                                            |
| `principal_amount`       | No          | Principal ordinario conocido. Requerido más adelante para reconstruir saldo. |
| `extra_principal_amount` | No          | Principal extraordinario conocido.                                           |
| `insurance_amount`       | No          | Seguro incluido en el pago.                                                  |
| `fee_amount`             | No          | Comisión incluida en el pago.                                                |
| `notes`                  | No          | Nota visible para la persona usuaria.                                        |

## Formato regional explícito

La persona usuaria debe indicar delimitador, separador decimal y formato de fecha. Por ejemplo, para CSV exportado por Excel en español se usa `;`, decimal `,` y `DD/MM/YYYY`. No se deduce el formato de manera silenciosa: la misma fila puede tener significados distintos según la región.

La moneda se toma de la configuración del préstamo, no de cada fila. Los importes se convierten a `Money` decimal antes de la previsualización.

## Validaciones

- Encabezados obligatorios y errores estructurales de CSV.
- Fechas reales en el calendario e importes decimales válidos.
- Identificadores duplicados dentro del archivo o contra una lista existente.
- Meses faltantes entre pagos válidos, como señal diagnóstica; no implica por sí mismo que el banco haya omitido un cobro.

La confirmación, persistencia transaccional y resolución interactiva de errores se implementarán en los casos de uso de la aplicación. Una fila sin principal puede previsualizarse, pero no permitirá reconstruir saldo hasta completar ese dato o reconciliar explícitamente.
