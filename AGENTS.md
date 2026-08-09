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

### Cierre documental obligatorio

Todo cambio que altere comportamiento, alcance, datos, interfaz, herramientas de usuario o validación debe cerrar con una evaluación explícita de documentación y backlog, aunque su tipo de commit sea `fix`, `refactor` o `chore`. Antes de crear el commit:

1. Relaciona el cambio con `RF-*`/`RNF-*` y decide qué documentos de la tabla anterior aplican.
2. Actualiza los criterios de una historia existente si el cambio completa parte de su alcance; crea una historia nueva si introduce una capacidad, flujo o decisión verificable que no estaba cubierta.
3. Actualiza `docs/backlog.json` y `docs/traceability.json` cuando la historia o los requisitos cambien; ajusta `docs/implementation-plan.md` si cambia la composición de una épica.
4. Ejecuta `pnpm docs:sync` y deja los archivos generados en el mismo commit. Ejecuta además `pnpm docs:check` antes de finalizar.

Si se detecta una omisión posterior, no se reescribe la historia: se crea una historia retrospectiva con estado `completed`, criterios comprobables y dependencias reales, se actualiza la documentación afectada y se registra en el siguiente commit documental. Para auditar un intervalo usa `git log --reverse <base>..HEAD` y `git diff --name-status <base>..HEAD`, luego contrasta cada commit con requisitos, historias y documentos.

## Recursos para trabajo agentic

- Usa [`.agents/prompts/`](.agents/prompts/README.md) para tareas repetibles.
- Para proseguir de forma autónoma, usa [`.agents/prompts/next-work-item.md`](.agents/prompts/next-work-item.md).
- Para cerrar o auditar cambios ya implementados, usa [`.agents/prompts/documentation-closeout.md`](.agents/prompts/documentation-closeout.md) y la habilidad local de documentación viva.
- Las habilidades específicas del proyecto viven en [`.agents/skills/`](.agents/skills/README.md). Cada una requiere un `SKILL.md` autosuficiente.
- Mantén prompts y habilidades libres de secretos, datos reales de clientes y afirmaciones financieras sin fuente.
