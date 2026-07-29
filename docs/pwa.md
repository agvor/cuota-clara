# PWA web

`apps/web` es la capa de presentación de CuotaClara. Su punto de composición crea el adaptador local `DexieLoanRepository` y entrega únicamente el puerto `LoanRepository` al componente `App`. La interfaz no importa Dexie ni reproduce reglas de amortización.

La aplicación se compila con Vite, React y `vite-plugin-pwa`. El manifiesto usa modo `standalone`, idioma español y registro de service worker con actualización automática. La lista de préstamos, estado vacío, errores de lectura y detalle seleccionado se pueden recorrer con teclado; la cuadrícula se adapta a pantallas pequeñas.

La PWA actual precachea sus recursos de construcción. Las pruebas de instalación y operación sin red después de la primera carga se completarán en `US-016`; hasta entonces el requisito offline continúa en curso.
