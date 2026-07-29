# PWA web

`apps/web` es la capa de presentación de CuotaClara. Su punto de composición crea el adaptador local `DexieLoanRepository` y entrega únicamente el puerto `LoanRepository` al componente `App`. La interfaz no importa Dexie ni reproduce reglas de amortización.

La aplicación se compila con Vite, React y `vite-plugin-pwa`. El manifiesto usa modo `standalone`, idioma español, iconos de 192/512 y registro de service worker con actualización automática. La lista de préstamos, el estado vacío, la creación/edición y el detalle seleccionado se pueden recorrer con teclado; la cuadrícula se adapta a pantallas pequeñas.

El formulario crea contratos v3 mensuales: muestra monto original, cuota total incluido seguro, seguro contenido en esa cuota y plazo por fecha final o cuotas. Antes de habilitar el guardado llama a `estimateLoanContract` y separa principal, interés, seguro y total; el resultado se etiqueta como estimación local. También permite elegir tasa fija, serie manual o TBP+margen con unidades y supuestos visibles. Al guardar TBP+margen, la aplicación conserva además un escenario versionado con TBP inicial, margen, frecuencia, evolución y variación. Los préstamos v1 se muestran como heredados hasta que la persona complete plazo y seguro al editarlos; al guardar un v2 se informa que su total efectivo se conserva y se migra explícitamente a v3.

Toda salida monetaria de la PWA usa un único formateador de `es-CR`: conserva el decimal redondeado contractual y añade símbolo de moneda, miles y decimales sin convertir el importe a `number`. Los campos editables siguen mostrando el literal decimal canónico para no modificar la entrada. El detalle del préstamo presenta de inmediato una tabla compacta con fecha final estimada, cuotas, principal, interés, seguro, total y saldo pendiente cuando aplique.

Para un contrato v3, la cantidad de cuotas o fecha final declarada es autoritativa. Si la cuota total configurada no coincide con la cuota que requiere el modelo para cumplir ese plazo, el resumen conserva ambas cifras y explica la discrepancia; no adelanta la fecha final. La tabla de amortización usa el mismo calendario cuando se abre el detalle.

La tabla de amortización y el gráfico se montan solo al seleccionar **Ver detalle de amortización**. El gráfico ofrece rangos de 12, 60, 120 períodos o todo el plazo, con ejes temporal y monetario, nombre y descripción accesibles. Véase [`domain/contract-payment-and-results-v3.md`](domain/contract-payment-and-results-v3.md).

La PWA precachea la página, manifiesto, iconos y recursos de construcción. Después de la primera visita, la página raíz puede servirse mediante el service worker sin red. La verificación de actualización de caché y de recuperación ante datos locales inválidos requiere una prueba de navegador con Chromium y sigue pendiente dentro de `US-016`.

Desde el detalle de un préstamo se registran y corrigen pagos manuales, o se importa un CSV tras revisar sus filas, duplicados y meses faltantes. La confirmación no admite una previsualización con errores y los pagos se persisten dentro del agregado del préstamo seleccionado.

También se pueden guardar escenarios de pago extraordinario único. La comparación muestra base y alternativa —fecha final, plazo, total pagado e interés ahorrado— y usa un calendario contractual explícito; el escenario nunca modifica pagos reales ni la configuración del préstamo.

La vista de evolución presenta una tabla paginada y un gráfico SVG ligero bajo demanda. Los registros históricos y las filas proyectadas están marcados por separado; el cálculo de la proyección lo produce el dominio, no la interfaz.
