# Instrucciones para agentes

## Objetivo

CuotaClara es un simulador de préstamos local-first. La exactitud, trazabilidad y privacidad son más importantes que añadir funcionalidades rápidamente.

## Antes de cambiar código

1. Lee `docs/requirements.md`, `docs/architecture.md` y el glosario que afecte el cambio.
2. Lee `docs/implementation-plan.md` y toma únicamente el siguiente ítem habilitado del backlog.
3. Identifica los requisitos por su identificador (`RF-*` o `RNF-*`).
4. Expón cualquier regla financiera ambigua como supuesto; no la inventes silenciosamente.
5. Escribe primero una prueba que falle; implementa el cambio mínimo y refactoriza con las pruebas en verde.

## Reglas no negociables

- No uses `number` de JavaScript para dinero, tasas ni redondeos financieros en el dominio.
- El paquete `packages/domain` no puede importar React, IndexedDB, HTTP ni APIs del navegador.
- Un escenario nunca modifica el préstamo ni los pagos históricos.
- No ejecutes fórmulas suministradas por usuarios como JavaScript ni mediante `eval`.
- Cada corrección de cálculo necesita una prueba de regresión con valores esperados.
- No introduzcas backend, autenticación o sincronización en el MVP sin un ADR aprobado.

## Documentación viva

En el mismo cambio, actualiza los documentos afectados y `docs/traceability.json`; después ejecuta `pnpm docs:sync` y `pnpm verify`. La CI rechaza documentación incoherente, análisis estático, tipos o pruebas fallidas.

| Cambio                                | Documentación mínima                             |
| ------------------------------------- | ------------------------------------------------ |
| Requisito o alcance                   | `docs/requirements.md`, `docs/traceability.json` |
| Decisión estructural o tecnológica    | ADR en `docs/adr/`, arquitectura o tecnologías   |
| Tipo, invariante o término financiero | `docs/domain/glossary.md`                        |
| Entrega o avance de requisito         | `docs/traceability.json` y estado generado       |
| Avance de una historia                | `docs/backlog.json` y estado generado            |

## Recursos para trabajo agentic

- Usa [`.agents/prompts/`](.agents/prompts/README.md) para tareas repetibles.
- Para proseguir de forma autónoma, usa [`.agents/prompts/next-work-item.md`](.agents/prompts/next-work-item.md).
- Las habilidades específicas del proyecto viven en [`.agents/skills/`](.agents/skills/README.md). Cada una requiere un `SKILL.md` autosuficiente.
- Mantén prompts y habilidades libres de secretos, datos reales de clientes y afirmaciones financieras sin fuente.
