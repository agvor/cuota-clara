# ADR-0004: PWA React con composición local

- Estado: aceptado
- Fecha: 2026-07-28

## Contexto

La primera interfaz debe funcionar desde navegadores modernos de escritorio y móvil, conservar la arquitectura local-first y permitir una experiencia instalable antes de considerar una aplicación móvil nativa.

## Decisión

Crear `apps/web` con React y Vite. `vite-plugin-pwa` genera el manifiesto y service worker; el punto de entrada compone el adaptador de almacenamiento local y entrega los puertos al árbol de presentación. Los componentes usan los datos y políticas del dominio, sin calcular amortizaciones ni importar IndexedDB.

## Consecuencias

- Una base web responsive cubre las plataformas iniciales y es instalable.
- La composición concreta de infraestructura queda en el borde de la app; las pruebas de interfaz usan repositorios falsos.
- La caché offline y su actualización necesitan pruebas de navegador antes de considerar completo el requisito de operación offline.
