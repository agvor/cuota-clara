# Preflight: cuota total y resultados bajo demanda

Usar antes de iniciar US-021 a US-023. No escribir código hasta completar esta lista.

1. Leer ADR-0006 y `docs/domain/contract-payment-and-results-v3.md` completos.
2. Declarar que la cuota configurada incluye seguro y calcular la cuota base como `total − seguro`; no reutilizar silenciosamente el campo v2 como si fuera total.
3. Escribir primero casos de dominio para 360 cuotas/30 años, día ancla y la cuota insuficiente de 115,000,000 a 8.5%.
4. Diseñar y probar migración de IndexedDB y respaldo antes de cambiar serialización; pagos y escenarios existentes deben permanecer intactos.
5. Centralizar formato de dinero antes de modificar componentes. No convertir la representación decimal a `number` para formatear grandes importes.
6. Mantener dominio sin React. El cálculo y renderizado bajo demanda pertenecen a la PWA y deben tener pruebas de accesibilidad.
