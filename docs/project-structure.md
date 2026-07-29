# Estructura del repositorio

```text
apps/
  web/                 PWA y adaptadores de presentación
packages/
  domain/              Núcleo financiero reutilizable y sin dependencias web
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

Cuando se agregue infraestructura local, se ubicará inicialmente en `apps/web/src/infrastructure/`, detrás de los puertos definidos por el dominio o la capa de aplicación. Si ese código se vuelve reutilizable, se extraerá a un paquete con un ADR que justifique el cambio.
