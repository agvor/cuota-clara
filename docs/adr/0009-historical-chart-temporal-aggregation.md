# ADR-0009: Agregación temporal del historial en el gráfico

- Estado: aceptado, pendiente de implementación en US-060
- Fecha: 2026-08-09

## Contexto

El dominio y la persistencia representan cada pago histórico como un `PaymentRecord` independiente. Esta granularidad es necesaria para conservar identidad, procedencia, notas y administración individual. Una fecha puede contener varios pagos legítimos y el conversor local de planes PDF registra los aportes extraordinarios inferidos como filas separadas en la fecha de la cuota siguiente.

El gráfico actual convierte cada registro histórico en un periodo, sustituye componentes ausentes por cero y distribuye los puntos por índice. Así, una cuota ordinaria y un aporte extraordinario de la misma fecha ocupan posiciones diferentes: las señales alternan entre sus componentes y muestran caídas artificiales a cero. Aunque las etiquetas son fechas, intervalos distintos reciben el mismo espacio horizontal, por lo que el eje no es temporal en su geometría.

La tabla necesita conservar cada hecho auditable. El gráfico, en cambio, necesita una observación coherente por instante para comparar flujos históricos con periodos proyectados sin atribuir al dominio una agrupación que solo responde a la presentación.

## Decisión

1. La PWA construirá mediante una transformación pura un modelo de lectura exclusivo del gráfico. No cambiará `PaymentRecord`, el agregado, la persistencia, la importación ni los periodos calculados por el dominio.
2. Los pagos históricos se agruparán por fecha ISO exacta. No se agruparán por mes, número de cuota ni cercanía temporal: movimientos de fechas diferentes permanecerán separados.
3. Para cada fecha se sumarán por separado `totalAmount`, principal ordinario y principal extraordinario. El principal total será ordinario más extraordinario; el extraordinario no se sumará otra vez sobre ese total. El saldo de apertura será el anterior al primer evento del día y el saldo de cierre será el posterior a todos sus eventos.
4. Los componentes opcionales conservarán su completitud. La ausencia de interés, seguro o comisión no se convertirá automáticamente en cero; el detalle mostrará el valor como desconocido cuando ningún tipo de evento permita afirmar que es cero.
5. Un ajuste de reconciliación seguirá siendo un evento histórico diferenciado. Afectará el saldo y su señal de principal trazable, pero no aumentará `Cuota total`, porque no prueba un desembolso. Si coincide con pagos en la misma fecha, el detalle conservará su procedencia separada aunque el saldo mostrado sea el cierre posterior a todos los eventos aplicables.
6. Las observaciones se posicionarán en X según el tiempo transcurrido entre el inicio y el final del rango visible. Las marcas del eje, el divisor entre historial y proyección y la búsqueda del punto más cercano usarán esa misma escala.
7. La interacción y su configuración identificarán la observación mediante una clave temporal estable, no mediante el índice renumerado de la secuencia. La interfaz hablará de fecha o evento histórico y reservará “cuota” para un periodo contractual o proyectado.
8. Base y escenarios compartirán exactamente las observaciones históricas consolidadas. Cada fuente aportará después sus propios periodos proyectados; fechas futuras ausentes en una alternativa no se presentarán como hechos históricos ni alterarán la base.
9. Las señales existentes no se apilarán. `Aporte extraordinario a principal` es subconjunto de `Aporte total a principal` y, con desglose completo, ambos están contenidos en `Cuota total`; apilarlos produciría doble contabilización visual.

## Consecuencias

- Una cuota ordinaria y un aporte extraordinario registrados el mismo día producirán un único punto con pago, principal y extraordinario acumulados de forma consistente.
- La tabla y la administración de pagos seguirán mostrando y operando sobre cada registro individual; no se requiere migración de IndexedDB ni del formato de respaldo.
- El eje hará visibles los intervalos reales entre fechas. Los huecos históricos ocuparán más espacio que fechas próximas y varios eventos del mismo día no crearán distancia ficticia.
- El modelo visual deberá representar valores monetarios opcionales o su estado de completitud, en vez de depender exclusivamente de `Money` obligatorio con cero como valor sustituto.
- La configuración guardada de un punto fijado por número podrá ignorarse de forma compatible o migrarse a una clave por fecha; rangos y selección de señales permanecen compatibles.
- Las pruebas verificarán sumas decimales, saldo de cierre, fechas coincidentes y distintas, componentes desconocidos, reconciliación, escenarios, coordenadas temporales, foco, teclado y texto accesible.
