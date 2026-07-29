# Ejecutar el siguiente ítem del backlog

1. Lee `AGENTS.md`, `docs/implementation-plan.md`, `docs/backlog.json` y los requisitos relacionados.
2. Encuentra el primer ítem `ready` con todas sus dependencias `completed`. Si no existe, informa el bloqueo; no elijas un ítem futuro arbitrariamente.
3. Cambia solo ese ítem a `in_progress`, actualiza `updatedAt` y ejecuta `pnpm docs:sync`.
4. Declara los supuestos financieros y escribe primero una prueba que falle.
5. Implementa el mínimo comportamiento que haga pasar la prueba; refactoriza sin cambiar resultados.
6. Comprueba cada criterio de aceptación. Actualiza documentación, cambia el ítem a `completed`, actualiza requisitos entregados y ejecuta `pnpm docs:sync && pnpm verify`.
7. Informa el ítem completado, pruebas realizadas, supuestos pendientes y el siguiente ítem habilitado.
