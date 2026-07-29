# Estándares de cambio y validación

## Commits

Se usa [Conventional Commits](https://www.conventionalcommits.org/). El formato es:

```text
tipo(alcance): resumen en imperativo
```

`alcance` es opcional, pero se recomienda: `domain`, `web`, `docs`, `tooling` o `ci`. Los tipos permitidos son `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci` y `chore`.

Ejemplos:

```text
feat(domain): calcular interés de tasa fija mensual
fix(import): rechazar filas CSV con fechas ambiguas
test(domain): cubrir redondeo del pago final
docs(architecture): describir el adaptador de respaldo
```

Un cambio incompatible usa `!` tras tipo o alcance y explica el impacto en el cuerpo del commit. El resumen no lleva punto, no supera 100 caracteres y no mezcla cambios ajenos.

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

## Análisis estático

El análisis no sustituye las pruebas. ESLint cubre errores y convenciones de JavaScript/TypeScript; TypeScript estricto detecta incompatibilidades de tipos; Prettier elimina discusiones de formato. Las reglas específicas del dominio financiero permanecen como invariantes, pruebas y revisión humana, porque un analizador estático no puede demostrar la corrección contractual de una amortización.

No se permiten advertencias nuevas. Una excepción temporal requiere justificación en el PR, una tarea de seguimiento y aprobación explícita.
