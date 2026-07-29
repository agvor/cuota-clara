# Persistencia local

`@cuotaclara/local-storage` implementa el puerto `LoanRepository` del dominio mediante Dexie sobre IndexedDB. La aplicación y los casos de uso solo reciben el puerto; no importan Dexie ni las API del navegador.

## Datos y transacciones

La versión de esquema actual es **1** y define tres tablas:

| Tabla       | Clave e índices                 | Contenido                                                               |
| ----------- | ------------------------------- | ----------------------------------------------------------------------- |
| `loans`     | `id`                            | Configuración financiera serializada con importes decimales como texto. |
| `payments`  | `id`, `loanId`, `[loanId+date]` | Pagos reales asociados a un préstamo.                                   |
| `scenarios` | `id`, `loanId`                  | Capturas de configuración de escenarios.                                |

`saveAggregate` valida y serializa todo el agregado antes de abrir una transacción. Después reemplaza los pagos y escenarios del préstamo y escribe el préstamo en una única transacción de IndexedDB. Por ello, un error de validación o de almacenamiento no deja un agregado a medio actualizar. Borrar un préstamo también elimina sus hijos dentro de una transacción.

Los importes se guardan como `{ amount: string, currency: string }`; no se convierten a `number`. Al leer, el adaptador vuelve a construir `Money`, `Loan` y `PaymentRecord`, aplicando sus invariantes de dominio.

## Migraciones

Una modificación persistente incrementa la versión declarada por Dexie y añade una migración explícita. La migración debe ser compatible con datos reales y tener una prueba con datos de la versión previa. No se cambia el esquema existente sin una ruta de actualización ni se borra la base automáticamente.

1. Documentar el cambio en un ADR y actualizar esta tabla.
2. Añadir la nueva versión y la transformación transaccional.
3. Probar la lectura de registros anteriores y la actualización.
4. Mantener la exportación/restauración compatible o versionarla antes de publicar.

## Datos inválidos y recuperación

Si una fila no cumple el contrato al guardarse o recuperarse, el adaptador emite `LocalDataCorruptionError`. La interfaz deberá mostrar un mensaje recuperable y no sustituir ni borrar datos silenciosamente. La ruta de recuperación prevista es conservar la base, exportar los registros que aún sean legibles y restaurar una copia validada; la experiencia de respaldo/restauración se implementará en `US-015`.

Mientras esa interfaz no exista, el equipo de soporte debe pedir una copia de respaldo previa o conservar una exportación de los registros legibles antes de usar las herramientas del navegador para borrar la base. Borrar IndexedDB es una última opción y nunca una acción automática de la aplicación.
