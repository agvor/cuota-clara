# ADR-0005: Contrato con plazo, seguro y escenarios TBP+margen

- Estado: propuesto
- Fecha: 2026-07-29

## Contexto

El modelo actual carece de plazo contractual explícito, seguro mensual separado y una regla variable orientada a la tasa básica pasiva. Esto impide explicar el monto final proyectado y obliga a usar calendarios genéricos.

## Propuesta

Introducir un contrato v2 con monto original, fecha inicial, fecha final o número total de cuotas, cuota mensual y seguro mensual. La fase variable predeterminada será una regla local y determinista `TBP + margen`, cuyos supuestos se guardan en el escenario: TBP promedio inicial, frecuencia de revisión y evolución estable/alza/baja por puntos porcentuales.

El seguro no amortiza ni genera interés en el primer alcance. La proyección exhibirá principal, interés, seguro y total por separado. No habrá consulta automática de TBP ni modificación de contratos/pagos históricos por un escenario.

## Consecuencias

- El modelo y las copias de respaldo deberán versionarse y migrar sin inventar plazo o seguro de registros existentes.
- El motor necesitará una política de calendario mensual contractual y una decisión explícita de cuota vs. plazo cuando cambie la tasa.
- La función gratuita local conserva reproducibilidad; futuras fuentes oficiales de TBP pueden llegar mediante un adaptador con fecha, fuente y consentimiento.

## Decisiones pendientes

Las cinco preguntas de confirmación de `domain/loan-contract-v2.md` deben resolverse antes de iniciar código de dominio o migraciones.
