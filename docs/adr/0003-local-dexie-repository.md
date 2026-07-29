# ADR-0003: Repositorio local Dexie con serialización explícita

- Estado: aceptado
- Fecha: 2026-07-28

## Contexto

El MVP debe conservar préstamos, pagos y escenarios entre reinicios sin enviar información financiera a un servidor. A la vez, una futura sincronización premium no puede forzar al dominio ni a los casos de uso a depender de IndexedDB.

## Decisión

Implementar `LoanRepository` en el paquete `@cuotaclara/local-storage` usando Dexie e IndexedDB. El agregado se persiste en tres tablas y sus actualizaciones se realizan transaccionalmente. El adaptador serializa `Money` como texto decimal y reconstruye los tipos del dominio al leer para detectar filas inválidas.

El esquema inicia en la versión 1. Las migraciones futuras serán incrementales, explícitas y probadas; no habrá eliminación automática de la base como mecanismo de migración.

## Consecuencias

- El núcleo permanece reutilizable en PWA, móvil o una futura sincronización.
- La app puede mostrar recuperación controlada mediante `LocalDataCorruptionError` en vez de ignorar datos corruptos.
- Dexie y el navegador quedan contenidos en infraestructura; sus pruebas usan `fake-indexeddb` y no requieren un navegador real.
- Se necesita implementar respaldo/restauración antes de ofrecer una recuperación completa a la persona usuaria.
