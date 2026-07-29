# Preflight: contrato financiero v2

Usar antes de iniciar `US-017` a `US-020`. No escribir código hasta completar esta lista.

1. Leer `docs/domain/loan-contract-v2.md`, `docs/requirements.md` y ADR-0005.
2. Confirmar por escrito los cinco supuestos pendientes: cuota vs. seguro, variación TBP, política ante cambio de tasa y unidad del margen.
3. Definir un caso de referencia contractual autorizado que incluya plazo, seguro y al menos una revisión variable; no usar datos personales.
4. Diseñar la migración de datos v1 y respaldo antes de cambiar `Loan` o Dexie. No asignar valores por defecto a plazo o seguro.
5. Escribir primero pruebas de dominio y de migración. La UI solo comienza cuando las pruebas y contratos de dominio estén claros.

La fuente de TBP no se consulta desde la red en esta fase: los escenarios deben ser locales, versionados y reproducibles.
