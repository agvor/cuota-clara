# ADR-0001: Monolito modular local-first

- Estado: aceptado
- Fecha: 2026-07-28

## Contexto

La primera entrega debe funcionar sin cuenta y sin conexión, mientras que una futura oferta premium podría incluir sincronización y reportes. El motor financiero exige exactitud y pruebas independientes de la interfaz.

## Decisión

Usar un monolito modular TypeScript con un paquete de dominio independiente, PWA estática y persistencia local detrás de puertos. No se creará backend, microservicios ni autenticación en el MVP.

## Consecuencias

- Menor fricción, costo operativo y exposición de datos personales en la primera entrega.
- La persistencia y sincronización futuras requieren migraciones y resolución de conflictos que se diseñarán cuando haya una necesidad validada.
- El dominio se puede probar sin navegador y reutilizar más adelante en móvil o un servicio.
