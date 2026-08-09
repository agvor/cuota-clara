# Documentación viva y backlog

## Propósito

Mantener alineados los requisitos, historias, trazabilidad, documentación especializada y archivos generados cuando una entrega cambia el producto, o cuando se audita un conjunto de commits ya realizados.

## Cuándo usarla

- Antes de cerrar cualquier `feat`, `fix`, `refactor` o `chore` que cambie comportamiento, datos, interfaz, herramientas de usuario o validación.
- Al detectar que un intervalo de commits no actualizó el backlog o los documentos asociados.
- Al completar, dividir, reabrir o registrar retrospectivamente una historia.

## Entradas

- El cambio actual o un rango de Git explícito (`<base>..HEAD`).
- `AGENTS.md`, `docs/requirements.md`, `docs/implementation-plan.md`, `docs/backlog.json` y `docs/traceability.json`.
- Los documentos especializados que correspondan: dominio, arquitectura, respaldo, importación, PWA o ADR.

## Procedimiento

1. Lee las instrucciones del repositorio y los documentos de entrada. Para un intervalo, inspecciona `git log --reverse <base>..HEAD` y `git diff --name-status <base>..HEAD`.
2. Por cada cambio, registra mentalmente el comportamiento observable, `RF-*`/`RNF-*` afectados, historia que lo cubre y documentos necesarios. No supongas que `fix` o `refactor` carecen de impacto documental.
3. Reutiliza una historia existente solo si sus criterios ya describen por completo la entrega. Si añade una capacidad, flujo, decisión persistente o aceptación nueva, crea una historia con requisitos, dependencias y criterios comprobables. Si el trabajo ocurrió antes de esta revisión, la historia es retrospectiva y su estado es `completed` únicamente si se puede comprobar.
4. Actualiza requisitos cuando cambie el alcance o aceptación; actualiza trazabilidad al revisar requisitos; actualiza los documentos especializados y el plan de implementación conforme a la tabla de `AGENTS.md`.
5. Actualiza las fechas de revisión de `backlog.json` y `traceability.json`, ejecuta `pnpm docs:sync` y no edites manualmente los documentos generados.

## Validación

Ejecuta `pnpm docs:check`. Antes de cerrar una entrega, ejecuta también `pnpm verify` o la verificación equivalente disponible y comunica cualquier limitación del entorno. Comprueba que las historias nuevas no tengan IDs duplicados, dependencias inexistentes ni criterios vacíos.

## Límites

No inventes reglas financieras, evidencia bancaria ni datos de clientes. No declares una historia o requisito completado por compilación solamente. No reescribas commits históricos: registra una corrección documental como trabajo retrospectivo trazable.
