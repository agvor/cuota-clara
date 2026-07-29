# ADR-0005: Contrato con plazo, seguro y escenarios TBP+margen

- Estado: aceptado
- Fecha: 2026-07-29

## Contexto

El modelo actual carece de plazo contractual explícito, seguro mensual separado y una regla variable orientada a la tasa básica pasiva. Esto impide explicar el monto final proyectado y obliga a usar calendarios genéricos.

## Decisión

US-017 introduce un contrato v2 con monto original, fecha inicial, exactamente una de fecha final o número total de cuotas, cuota mensual y seguro mensual. US-019 introduce la regla local y determinista `tbp_margin_v1`: TBP + margen, con TBP promedio inicial, margen, frecuencia de revisión, evolución estable/alza/baja y variación por puntos porcentuales guardados en el escenario.

El seguro no amortiza ni genera interés en el primer alcance. La proyección exhibirá principal, interés, seguro y total por separado. No habrá consulta automática de TBP ni modificación de contratos/pagos históricos por un escenario.

## Consecuencias

- El modelo y las copias de respaldo deberán versionarse y migrar sin inventar plazo o seguro de registros existentes.
- El motor conserva cuota cuando cambia la tasa. El plazo declarado continúa siendo límite del contrato y una estimación muestra saldo pendiente o cuota final reducida.
- La función gratuita local conserva reproducibilidad; futuras fuentes oficiales de TBP pueden llegar mediante un adaptador con fecha, fuente y consentimiento.

La TBP no se consulta automáticamente ni se vuelve negativa en una evolución a la baja. Una fuente oficial futura requerirá adaptador, fecha, fuente y consentimiento.
