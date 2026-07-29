# Documentación viva

La documentación es parte del producto y se mantiene en el mismo cambio que el código. No se usa como una descripción aspiracional separada de la implementación.

## Fuentes de verdad

| Tema                                  | Fuente                            |
| ------------------------------------- | --------------------------------- |
| Alcance y comportamiento              | `requirements.md`                 |
| Conceptos y reglas del dominio        | `domain/glossary.md`              |
| Límites y componentes                 | `architecture.md`                 |
| Decisiones irreversibles              | `adr/`                            |
| Estado de requisitos                  | `traceability.json` → `status.md` |
| Dependencias y criterios de selección | `technologies.md`                 |

`status.md` se genera desde `traceability.json`; nunca se edita a mano. Ejecuta `npm run docs:sync` tras cambiar el estado de una entrega. `npm run docs:check` comprueba que el estado generado y los documentos obligatorios sigan coherentes. La automatización evita desalineación mecánica; actualizar el contenido de una decisión sigue siendo responsabilidad de quien hace el cambio.

## Ciclo de documentación

1. Añade o ajusta requisito y criterios de aceptación antes de programar.
2. Registra un ADR si se cambia arquitectura, una interfaz transversal o tecnología.
3. Implementa con pruebas y actualiza la trazabilidad.
4. Genera el estado y ejecuta la validación.

Los documentos están deliberadamente en español; los identificadores y nombres de código permanecen en inglés para consistencia técnica.
