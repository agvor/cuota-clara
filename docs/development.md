# Estándares de cambio y validación

Las instrucciones reproducibles para preparar y ejecutar la PWA están en [`run.md`](run.md). Ese archivo se genera desde los manifiestos de paquetes y se valida en CI; no se edita manualmente.

## Commits

Se usa [Conventional Commits](https://www.conventionalcommits.org/). El formato es:

```text
tipo(alcance): resumen de la acción
```

El encabezado se escribe en español, en minúsculas y con una acción en infinitivo. No lleva punto final y no supera 100 caracteres. El alcance es opcional cuando el cambio es transversal, no existe un subsistema dominante o el tipo ya identifica el área con suficiente precisión, como `docs` o `ci`.

### Tipos permitidos

| Tipo       | Cuándo usarlo                                                |
| ---------- | ------------------------------------------------------------ |
| `feat`     | Añade o amplía comportamiento observable.                    |
| `fix`      | Corrige comportamiento defectuoso.                           |
| `docs`     | Cambia únicamente documentación.                             |
| `test`     | Añade o corrige pruebas sin cambiar el producto.             |
| `refactor` | Reestructura código sin cambiar comportamiento.              |
| `perf`     | Mejora rendimiento sin cambiar el contrato funcional.        |
| `build`    | Cambia dependencias, empaquetado o compilación.              |
| `ci`       | Cambia automatización de integración o entrega.              |
| `chore`    | Realiza mantenimiento que no encaja en los tipos anteriores. |

El tipo describe el efecto principal del commit, no todos los archivos incluidos. Por ejemplo, una funcionalidad con pruebas y documentación sigue siendo `feat`, no `test` ni `docs`.

### Alcances del repositorio

| Alcance   | Área principal                                 |
| --------- | ---------------------------------------------- |
| `domain`  | Reglas financieras y `packages/domain`.        |
| `import`  | Importación CSV y `packages/import-csv`.       |
| `storage` | Persistencia local y `packages/local-storage`. |
| `backup`  | Respaldo y `packages/backup`.                  |
| `web`     | Interfaz y comportamiento de `apps/web`.       |
| `tooling` | Scripts y herramientas locales de desarrollo.  |

Usa un alcance cuando un subsistema domina claramente el cambio y el tipo no lo expresa: `fix(import): ...`. Omítelo cuando la entrega atraviese varias capas inseparables, sea planificación general o el tipo ya sea suficientemente específico: `feat: ...`, `docs: ...` o `ci: ...`. No inventes un alcance para un nombre de historia, archivo o detalle temporal; el catálogo anterior mantiene el historial agrupable.

### Resumen, cuerpo y referencias

El resumen responde **qué cambia** y evita detalles de implementación, identificadores solos o frases vagas. Se prefiere `feat(web): mostrar conflictos antes de importar` sobre `feat(web): cambios CSV`.

El cuerpo es opcional. Úsalo para explicar el motivo, una decisión no evidente, una migración o una limitación. Sepáralo del encabezado con una línea en blanco y ajusta el texto aproximadamente a 100 caracteres por línea.

Cuando el cambio entrega o corrige una historia o requisito, añade una referencia en el pie, también separada por una línea en blanco:

```text
Refs: US-055, RF-006, RNF-006
```

`Refs` permite relacionar el commit sin repetir identificadores en el resumen. No sustituye la actualización de `docs/backlog.json` ni `docs/traceability.json` cuando corresponda.

Un cambio incompatible usa `!` después del tipo o del alcance y debe explicar la migración o el impacto mediante un pie `BREAKING CHANGE:`:

```text
feat(storage)!: migrar la identidad de pagos importados

BREAKING CHANGE: los respaldos nuevos usan la versión 7 del esquema.
Refs: US-053
```

### Atomicidad

Cada commit representa una unidad revisable y deja el repositorio verificable:

- Incluye juntos la implementación, sus pruebas y la documentación necesaria para esa misma entrega.
- Separa correcciones, refactorizaciones o mantenimiento que puedan revisarse y revertirse de forma independiente.
- No usa `chore` para ocultar una mezcla de cambios sin relación.
- No declara `feat` si solo prepara un plan; la planificación sin producto implementado usa `docs`.

Ejemplos:

```text
feat(domain): calcular interés de tasa fija mensual
fix(import): rechazar filas CSV con fechas ambiguas
test(domain): cubrir redondeo del pago final
docs: describir el adaptador de respaldo
refactor(storage): centralizar la validación de pagos
ci: validar mensajes de todos los commits del pull request
```

Ejemplos que deben evitarse:

```text
actualizar cosas                 # no tiene tipo ni expresa una acción concreta
feat(Web): Mejoras del CSV.      # alcance y resumen no están en minúsculas; sobra el punto
chore: arreglar import y estilos # mezcla cambios y usa un tipo impreciso
feat: US-055                     # el identificador no explica el comportamiento
```

La configuración `commitlint.config.mjs` valida la convención en los pull requests. Antes de un commit se puede comprobar el mensaje con:

```bash
printf 'feat(domain): ejemplo de cambio' | pnpm exec commitlint
```

## Ciclo de cambio: TDD

El ciclo normal es **rojo → verde → refactorizar**:

1. Relacionar el cambio con uno o más `RF-*` o `RNF-*`, y hacer explícito el supuesto pendiente.
2. Escribir una prueba que falle y describa el comportamiento observable. Para cálculos, usar importes, fechas, tasas, política de redondeo y resultados esperados concretos.
3. Implementar el mínimo código que haga pasar la prueba.
4. Refactorizar solo con la suite en verde, sin alterar comportamiento.
5. Actualizar documentos y trazabilidad; ejecutar la verificación completa.

Una corrección financiera no se considera terminada sin una prueba de regresión y, cuando exista, contraste contra contrato, estado de cuenta o hoja de cálculo de referencia. No se hacen cambios de cálculo basados solo en una intuición.

## Verificación local obligatoria

Antes de solicitar revisión, ejecutar:

```bash
pnpm verify
```

El comando ejecuta, en este orden:

| Comprobación | Propósito                                                          |
| ------------ | ------------------------------------------------------------------ |
| `docs:check` | El estado generado coincide con la trazabilidad.                   |
| `format`     | Prettier detecta formato no uniforme.                              |
| `lint`       | ESLint detecta errores, patrones inseguros y problemas de calidad. |
| `typecheck`  | TypeScript estricto valida los contratos de todos los paquetes.    |
| `test`       | Vitest ejecuta pruebas unitarias y de regresión.                   |

Para desarrollar, usar `pnpm test:watch`. Las pruebas de navegador y de accesibilidad se añadirán cuando exista la PWA; entonces también serán obligatorias para los cambios de interfaz.

La PWA se comprueba en producción con `pnpm build:web`; `pnpm verify` también la compila para evitar que un cambio de interfaz llegue a CI sin construir.

## Análisis estático

El análisis no sustituye las pruebas. ESLint cubre errores y convenciones de JavaScript/TypeScript; TypeScript estricto detecta incompatibilidades de tipos; Prettier elimina discusiones de formato. Las reglas específicas del dominio financiero permanecen como invariantes, pruebas y revisión humana, porque un analizador estático no puede demostrar la corrección contractual de una amortización.

No se permiten advertencias nuevas. Una excepción temporal requiere justificación en el PR, una tarea de seguimiento y aprobación explícita.
