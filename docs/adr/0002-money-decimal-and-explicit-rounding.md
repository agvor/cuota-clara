# ADR-0002: Dinero decimal y redondeo explícito

- Estado: aceptado
- Fecha: 2026-07-28

## Contexto

Los préstamos requieren importes y tasas reproducibles. Los números binarios de JavaScript no representan exactamente importes decimales comunes, y un redondeo implícito puede alterar interés, principal y pago final.

## Decisión

El núcleo usa `decimal.js` encapsulado por el tipo inmutable `Money`. Los importes de entrada son literales decimales de texto; el dominio no acepta `number` para un importe. Cada operación de presentación o aplicación contractual recibe una `RoundingPolicy` con escala y modo explícitos.

La primera política del caso de referencia es `half_up` a dos decimales por periodo. No se convierte esa política en una regla universal: cada préstamo declarará su propia política cuando se implemente su configuración.

## Consecuencias

- El motor evita errores binarios como `0.1 + 0.2` y puede probar empates de redondeo.
- Las incompatibilidades de moneda y de escala declarada producen errores explícitos.
- `decimal.js` queda como detalle interno del paquete; el resto del producto depende de `Money` y `RoundingPolicy`.
- Las futuras operaciones de división e interés deberán declarar precisión intermedia y punto exacto de redondeo; no pueden depender de los valores globales de la librería.
