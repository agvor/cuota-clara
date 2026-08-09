# ADR-0008: Identidad y deduplicación de pagos importados

- Estado: aceptado e implementado en US-053 a US-055
- Fecha: 2026-08-09

## Contexto

La importación CSV actual utiliza el campo `id` de la fuente como clave primaria global de `payments`. La previsualización compara esa clave solo con los pagos del préstamo seleccionado, excluye la fila repetida de los registros válidos y bloquea toda confirmación cuando encuentra un duplicado. Esto permite reconocer algunas reimportaciones, pero no importar las filas nuevas del mismo archivo, no distingue un pago idéntico de un cambio conflictivo y puede colisionar con el mismo identificador usado por otro préstamo.

Fecha e importes tampoco bastan como identidad: pueden existir dos pagos legítimos iguales el mismo día. La integridad no puede depender únicamente de una previsualización calculada en la interfaz, porque el agregado podría cambiar antes de confirmar o surgir otro consumidor del puerto.

## Decisión

1. Cada `PaymentRecord` tendrá un identificador interno opaco y globalmente único, separado del identificador externo aportado por el CSV. La referencia externa se evalúa únicamente dentro del préstamo.
2. La migración conservará como identificador interno el `id` válido de cada pago existente y, para pagos con origen CSV, copiará ese valor como referencia externa. Los pagos creados después de la migración recibirán un identificador interno nuevo; no se reinterpretarán importes ni procedencias históricas.
3. Una referencia externa ya registrada con el mismo contenido normalizado se clasifica como `already_registered` y se omite automáticamente. El contenido incluye fecha, total, desglose opcional y notas normalizadas, pero no la fila física del archivo.
4. La misma referencia externa con contenido distinto se clasifica como `conflict` y nunca se reemplaza silenciosamente. La persona puede conservar el existente, reemplazarlo explícitamente manteniendo su identidad interna o cancelar.
5. Una referencia externa diferente con la misma fecha e importes se clasifica como `possible_duplicate`. Es una advertencia que permite omitir o importar, no una restricción de unicidad.
6. La previsualización mostrará por separado nuevos, ya registrados, posibles duplicados, conflictos e inválidos. Los pagos ya registrados no bloquearán la importación de los nuevos.
7. Un caso de uso de aplicación repetirá la clasificación contra el agregado vigente al confirmar y persistirá la mezcla resultante en una transacción. Si una decisión quedó obsoleta, volverá a presentar el conflicto en lugar de sobrescribir datos.
8. El esquema local y el respaldo conservarán identidad interna, referencia externa y procedencia. La unicidad de la referencia externa será por préstamo; ningún identificador de un CSV podrá sobrescribir pagos de otro préstamo.

## Consecuencias

- Reimportar exactamente el mismo archivo es idempotente: importa cero pagos y comunica cuántos fueron omitidos.
- Un archivo mixto puede importar sus pagos nuevos sin que los ya registrados obliguen a editarlo.
- Se requiere una migración de IndexedDB y una nueva versión del formato de respaldo, ambas compatibles con datos anteriores y cubiertas por pruebas.
- La clasificación debe ser una política reutilizable y determinista, independiente de React y Dexie.
- La interfaz necesita comparación accesible de conflictos y una confirmación que anuncie el resultado exacto.
- Las pruebas deben cubrir reimportación, archivos mixtos, conflicto, posible duplicado legítimo, estado desactualizado, aislamiento entre préstamos, rollback y migraciones desde esquemas y respaldos anteriores.
