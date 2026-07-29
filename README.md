# CuotaClara

Simulador web local-first para entender préstamos, reconstruir su historial de pagos y comparar estrategias de amortización.

La primera versión se centra en préstamos amortizables con cuota periódica, una fase inicial de tasa fija y una fase posterior de tasa variable configurable. Los datos permanecen en el dispositivo; no hay cuentas ni servicios remotos en el MVP.

## Estado

El repositorio contiene la base de arquitectura y documentación. El primer entregable de software será el motor de amortización, acompañado de casos de referencia verificables.

## Inicio rápido

Se requiere Node.js 22 o superior y pnpm 11 (gestionado mediante Corepack).

```bash
corepack enable
pnpm install
pnpm verify
```

## Documentación

- [Requisitos](docs/requirements.md)
- [Arquitectura](docs/architecture.md)
- [Tecnologías](docs/technologies.md)
- [Glosario e invariantes](docs/domain/glossary.md)
- [Estructura del repositorio](docs/project-structure.md)
- [Estándares de cambio, TDD y validación](docs/development.md)
- [Plan de implementación](docs/implementation-plan.md)
- [Estado de implementación](docs/implementation-status.md)
- [Proceso de documentación viva](docs/README.md)
- [Estado generado](docs/status.md)

Las reglas de contribución están en [CONTRIBUTING.md](CONTRIBUTING.md) y las instrucciones para personas y agentes en [AGENTS.md](AGENTS.md).
