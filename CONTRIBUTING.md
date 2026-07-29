# Contribuir a CuotaClara

## Flujo de cambio

1. Parte de un requisito existente o añade uno antes de implementar.
2. Escribe una prueba que falle, implementa el mínimo código y refactoriza con la suite verde.
3. Cambia el dominio y sus pruebas antes de la interfaz.
4. Actualiza la documentación indicada en `AGENTS.md`.
5. Ejecuta las verificaciones disponibles.

```bash
pnpm docs:sync
pnpm verify
```

El detalle de commits, TDD, pruebas y análisis estático está en [docs/development.md](docs/development.md).

## Convenciones

- TypeScript estricto; nombres de tipos en inglés y texto visible al usuario en español internacional.
- Fechas sin hora en ISO 8601 (`YYYY-MM-DD`) dentro del dominio.
- Dinero, tasas y redondeos con tipos explícitos y aritmética decimal.
- Unidades explícitas en nombres y contratos: `annualRate`, `amount`, `periodsPerYear`.
- Commits pequeños, comprobables y sin cambios de formato no relacionados.

## Decisiones

Una decisión que sea difícil de revertir o afecte más de un módulo se registra en `docs/adr/` antes o junto con su implementación.
