# Estructura del repositorio

```text
apps/
  web/                 PWA y adaptadores de presentación
packages/
  domain/              Núcleo financiero reutilizable y sin dependencias web
  import-csv/          Adaptador de parseo y previsualización de CSV
  local-storage/       Implementación Dexie del puerto de préstamos
docs/
  adr/                 Decisiones de arquitectura
  domain/              Glosario, invariantes y contratos del dominio
  traceability.json    Fuente de estado de los requisitos
  status.md            Informe generado; no editar
tooling/               Automatizaciones de desarrollo y documentación
.agents/
  prompts/             Instrucciones reutilizables para tareas agentic
  skills/              Habilidades locales, autocontenidas
```

La infraestructura de persistencia ya es reutilizable y por eso vive en `packages/local-storage`, detrás del puerto del dominio. Los detalles exclusivos de interfaz permanecen en `apps/web/src/infrastructure/` cuando se cree la PWA.
