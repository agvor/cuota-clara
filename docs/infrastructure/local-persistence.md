# Persistencia local

`@cuotaclara/local-storage` implementa el puerto `LoanRepository` del dominio mediante Dexie sobre IndexedDB. La aplicación y los casos de uso solo reciben el puerto; no importan Dexie ni las API del navegador.

## Datos y transacciones

La versión de esquema actual es **6** y define tres tablas:

| Tabla       | Clave e índices                                              | Contenido                                                                            |
| ----------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `loans`     | `id`                                                         | Configuración financiera y, opcionalmente, contrato v2 o v3 con importes como texto. |
| `payments`  | `id`, `loanId`, `[loanId+date]`, `&[loanId+sourcePaymentId]` | Pagos reales con identidad interna global y referencia externa única por préstamo.   |
| `scenarios` | `id`, `loanId`                                               | Capturas de configuración de escenarios.                                             |

`saveAggregate` valida y serializa todo el agregado antes de abrir una transacción. Después reemplaza los pagos y escenarios del préstamo y escribe el préstamo en una única transacción de IndexedDB. Por ello, un error de validación o de almacenamiento no deja un agregado a medio actualizar. Borrar un préstamo también elimina sus hijos dentro de una transacción.

Los importes se guardan como `{ amount: string, currency: string }`; no se convierten a `number`. Al leer, el adaptador vuelve a construir `Money`, `Loan` y `PaymentRecord`, aplicando sus invariantes de dominio.

## Migraciones

La versión 2 añade el campo no indexado `contract` a `loans`. No transforma las filas v1: la ausencia de ese campo identifica un préstamo heredado y evita inventar plazo o seguro. La versión 3 conserva ese diseño físico y permite serializar el contrato v3 con `monthlyTotalPayment`; las filas v2 no se reinterpretan como cuota total. La versión 4 conserva junto al préstamo un reset bancario opcional y la versión 5 separa varios saldos conciliados de la fecha final bancaria única, manteniendo lectura compatible del reset v4. Pagos y escenarios se conservan.

La versión 6 separa la clave interna de cada pago de su identificador externo de importación. Los pagos CSV existentes conservan su `id` como clave interna y lo copian como referencia externa estable; los pagos nuevos reciben una clave interna globalmente única. El índice compuesto limita la referencia externa al préstamo, por lo que dos préstamos pueden importar la misma referencia sin sobrescribirse. La migración, el guardado y el respaldo conservan ambos identificadores y rechazan colisiones de forma transaccional. La decisión completa está en [`ADR-0008`](../adr/0008-payment-import-identity-and-deduplication.md).

Una modificación persistente incrementa la versión declarada por Dexie y añade una migración explícita. La migración debe ser compatible con datos reales y tener una prueba con datos de la versión previa. No se cambia el esquema existente sin una ruta de actualización ni se borra la base automáticamente.

1. Documentar el cambio en un ADR y actualizar esta tabla.
2. Añadir la nueva versión y la transformación transaccional.
3. Probar la lectura de registros anteriores y la actualización.
4. Mantener la exportación/restauración compatible o versionarla antes de publicar.

## Datos inválidos y recuperación

Si una fila no cumple el contrato al guardarse o recuperarse, el adaptador emite `LocalDataCorruptionError`. La interfaz muestra un mensaje recuperable y no sustituye ni borra datos silenciosamente. La ruta de recuperación es conservar la base, exportar los registros que aún sean legibles y restaurar una copia validada.

La copia usa un esquema versionado, serializa importes decimales como texto y valida todos los agregados antes de solicitar confirmación de restauración. Borrar IndexedDB es una última opción y nunca una acción automática de la aplicación.
