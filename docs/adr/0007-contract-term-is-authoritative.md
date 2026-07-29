# ADR-0007: El plazo contractual es autoritativo

- Estado: aceptado e implementado
- Fecha: 2026-07-29

## Contexto

El estimador anterior trataba la cuota configurada como una orden de amortización y detenía el calendario al liquidar el principal. Así, un préstamo con 360 cuotas podía mostrar 334 y una fecha final anterior, aun cuando el plazo acordado era parte del contrato bancario.

Una cuota, principal, tasa, seguro y plazo pueden no ser compatibles con el modelo simplificado de la PWA. La diferencia puede deberse a convenciones de banco, cargos, redondeo o cambios futuros de tasa; no se debe ocultar acortando el contrato.

## Decisión

1. Para contratos v3, la fecha final o la cantidad total de cuotas es autoritativa. La proyección siempre contiene todas las cuotas declaradas y termina en la fecha contractual.
2. En cada cuota se calcula la cuota base necesaria para liquidar el saldo dentro de las cuotas restantes usando la tasa nominal prevista. El seguro se suma después; no amortiza ni devenga interés.
3. La cuota total ingresada se conserva como cuota configurada. El resumen muestra la cuota total proyectada inicial y una advertencia no bloqueante cuando difiere.
4. La proyección es una comparación local y no reemplaza el estado de cuenta ni la convención del banco. Las cuotas pueden recalcularse conforme cambie la tasa prevista.
5. Los contratos v2 conservan su comportamiento heredado hasta migrarse explícitamente a v3.

## Consecuencias

- Una cuota configurada inferior al interés del primer período ya no impide mostrar el plazo contractual; el resumen expone la cuota necesaria bajo los supuestos declarados.
- La tabla detallada usa el mismo calendario contractual que el resumen, para evitar fechas o cantidades de cuotas contradictorias.
- Se requiere una prueba de regresión con 115,000,000, 360 cuotas, seguro 150,000 y tasa 8.5%, que termina en la cuota 360 y muestra una cuota inicial proyectada distinta de la configurada.
