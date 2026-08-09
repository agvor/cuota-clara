# Cerrar o auditar documentación viva

Usa este prompt al terminar un cambio que afecte producto, dominio, persistencia, herramientas o interfaz; úsalo también para auditar commits que se implementaron sin actualizar el backlog.

1. Lee `AGENTS.md`, `docs/requirements.md`, `docs/implementation-plan.md`, `docs/backlog.json`, `docs/traceability.json` y los documentos de dominio o arquitectura que toquen el cambio.
2. Para una auditoría, recibe un rango explícito y revisa `git log --reverse <base>..HEAD` junto con `git diff --name-status <base>..HEAD`. Para cada commit, anota: comportamiento entregado, requisitos afectados, documentación existente y si una historia ya lo cubre.
3. No crees historias por cambios puramente mecánicos. Crea una historia si el intervalo añadió una capacidad, flujo de usuario, decisión persistente o criterio de aceptación que no aparece en el backlog. Si el trabajo ya está entregado, márcala `completed`, conserva dependencias reales y escribe criterios verificables; no alteres el historial de commits.
4. Actualiza `docs/requirements.md` cuando cambie alcance o aceptación, `docs/traceability.json` cuando cambie la revisión o estado de requisitos, y el documento especializado correspondiente para contratos, persistencia, respaldo, importación, PWA o arquitectura. Actualiza `docs/implementation-plan.md` cuando cambien las historias de una épica.
5. Actualiza `docs/backlog.json.updatedAt` y `docs/traceability.json.updatedAt` con la fecha de la revisión. Ejecuta `pnpm docs:sync`, revisa los archivos generados y después `pnpm docs:check`. Ejecuta la verificación completa disponible antes del commit.
6. Informa el intervalo revisado, los documentos actualizados, las historias creadas o ajustadas, la cobertura que ya existía y cualquier decisión pendiente.

Límites: no marques requisitos u historias como completados solo porque el código compile; no inventes reglas financieras, evidencia bancaria ni estados de datos. Mantén los prompts y documentos libres de datos personales, contratos reales y secretos.
