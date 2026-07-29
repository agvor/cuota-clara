# PWA web

`apps/web` es la capa de presentación de CuotaClara. Su punto de composición crea el adaptador local `DexieLoanRepository` y entrega únicamente el puerto `LoanRepository` al componente `App`. La interfaz no importa Dexie ni reproduce reglas de amortización.

La aplicación se compila con Vite, React y `vite-plugin-pwa`. El manifiesto usa modo `standalone`, idioma español y registro de service worker con actualización automática. La lista de préstamos, el estado vacío, la creación/edición y el detalle seleccionado se pueden recorrer con teclado; la cuadrícula se adapta a pantallas pequeñas. El formulario delega las invariantes de importes, fechas, moneda y tasa fija-variable en `createLoan`.

La PWA actual precachea sus recursos de construcción. Las pruebas de instalación y operación sin red después de la primera carga se completarán en `US-016`; hasta entonces el requisito offline continúa en curso.

Desde el detalle de un préstamo se registran y corrigen pagos manuales, o se importa un CSV tras revisar sus filas, duplicados y meses faltantes. La confirmación no admite una previsualización con errores y los pagos se persisten dentro del agregado del préstamo seleccionado.

También se pueden guardar escenarios de pago extraordinario único. La comparación muestra base y alternativa —fecha final, plazo, total pagado e interés ahorrado— y usa un calendario contractual explícito; el escenario nunca modifica pagos reales ni la configuración del préstamo.

La vista de evolución presenta una tabla paginada y un gráfico SVG ligero. Los registros históricos y las filas proyectadas están marcados por separado; el cálculo de la proyección lo produce el dominio, no la interfaz.
