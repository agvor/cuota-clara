# Tasa fija seguida de tasa variable manual

## Modelo actual y evolución propuesta

Un préstamo puede declarar un número de periodos iniciales de tasa fija y, después, una serie manual fechada de tasas nominales anuales. La serie contiene fecha efectiva, tasa y frecuencia de revisión declarada (`monthly`, `quarterly`, `semiannual` o `annual`).

Para cada periodo variable el motor selecciona la última tasa cuya fecha efectiva sea igual o anterior a la fecha de pago. Si no hay una tasa vigente, rechaza la proyección: nunca reutiliza de forma silenciosa una tasa fija ni consulta una fuente externa.

## Política de cuota

La primera implementación conserva la cuota ordinaria al cambiar la tasa. Como consecuencia, cambia el principal aplicado por periodo y el plazo/pago final estimado. Esta política queda visible en cada periodo mediante la fase (`fixed` o `variable`) y la tasa anual aplicada.

La regla manual seguirá disponible por compatibilidad. La siguiente regla propuesta es **TBP+margen**, local y determinista: TBP promedio inicial configurable por escenario más margen contractual, con evolución estable/alza/baja y variación por revisión. No se consultará una fuente externa en el MVP. Véase [`loan-contract-v2.md`](loan-contract-v2.md) para parámetros, unidades y decisiones pendientes.
