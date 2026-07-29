# Respaldo y restauración

La PWA permite descargar una copia JSON de todos los agregados locales. Incluye versión de esquema, fecha de creación, préstamos, pagos y snapshots de escenarios; los importes se representan como texto decimal.

Al seleccionar una copia para restaurar, `@cuotaclara/backup` valida el JSON completo, su versión, préstamos únicos, pagos, monedas y pertenencia de escenarios antes de mostrar la confirmación. La confirmación indica cuántos préstamos serán restaurados y advierte que coincidencias por identificador se reemplazarán. Una copia inválida no modifica la persistencia.

La restauración guardada usa el repositorio local por agregado. Una falla física de IndexedDB durante esa fase se informa a la persona usuaria; conservar una copia descargada antes de restaurar sigue siendo recomendable.
