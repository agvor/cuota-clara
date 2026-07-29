# ADR-0006: Cuota total, calendario contractual y resultados bajo demanda

- Estado: aceptado; US-021 a US-023 implementados
- Fecha: 2026-07-29

## Contexto

La implementación v2 actual interpreta la cuota mensual como importe base y suma el seguro por aparte. La decisión de producto posterior aclara que la cuota configurada es el total exigible, incluido el seguro. También se requiere una fecha de última cuota verificable, cifras legibles y una vista de resultados que no calcule ni cargue el detalle visual de inmediato.

## Decisiones

1. El contrato v3 guarda `monthlyTotalPayment` y `monthlyInsurance`. La cuota base se deriva como `monthlyTotalPayment − monthlyInsurance`; debe ser positiva y es la única parte disponible para interés y principal.
2. El seguro se cobra dentro del total, no amortiza ni devenga interés. El estimador debe rechazar una cuota base que no cubra el interés del periodo y explicar ambos importes.
3. Para `N` cuotas mensuales, la cuota `N` vence en `startDate + N meses`, conservando el día ancla o el último día del mes cuando no exista. Así, 360 cuotas son exactamente 30 años desde el inicio.
4. El formato monetario está centralizado, localizado y basado en importes decimales ya redondeados, sin convertir valores financieros arbitrariamente a `number`. Se aplica a toda salida monetaria; los campos editables conservan el literal decimal canónico.
5. El resumen de préstamo aparece de inmediato con fecha final, cuotas, principal, interés, seguro y total. La tabla de amortización y el gráfico se solicitan mediante una pestaña o acción explícita; el gráfico tendrá ejes, etiquetas y un rango seleccionable.

## Consecuencias

- Se requiere contrato, persistencia, respaldo y migración nuevos sin alterar préstamos/pagos heredados.
- El contrato v2 existente se presentará como legado de cuota-base hasta una migración explícita; no se reinterpretará `monthlyInstallment` como cuota total.
- El caso de referencia de 115,000,000 a 360 meses, cuota total 900,000 y seguro 150,000 debe probar que la cuota base es 750,000 y no cubre el interés inicial de 814,583.33 a 8.5% nominal anual. Es una validación de regla, no una recomendación financiera.
- La carga del detalle visual pasa a ser responsabilidad de la PWA; el dominio conserva cálculos deterministas y sin conocimiento de pestañas ni gráficos.
