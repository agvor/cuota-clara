# Arquitectura

## Decisión principal

Se construirá un monolito modular TypeScript, local-first. El dominio financiero es un paquete independiente y determinista; la PWA es un adaptador de presentación. No hay backend en el MVP.

```text
Persona usuaria
       │
       ▼
Web/PWA (apps/web)
  ├─ presentación React
  ├─ casos de uso
  └─ adaptadores de archivo y almacenamiento
       │                     │
       ▼                     ▼
packages/domain        IndexedDB local
  ├─ préstamos          (adaptador reemplazable)
  ├─ pagos históricos
  ├─ interés, TBP y redondeo
  └─ amortización
```

## Módulos y límites

| Módulo                            | Responsabilidad                                                    | No puede conocer                                |
| --------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| `packages/domain`                 | Tipos, invariantes, políticas, motor de amortización y resultados. | UI, navegador, almacenamiento, HTTP.            |
| `packages/local-storage`          | Adaptador Dexie, esquema local y migraciones de `LoanRepository`.  | Reglas financieras, UI y planes de suscripción. |
| Aplicación web                    | Orquesta casos de uso, convierte datos de UI y presenta errores.   | Detalles internos de algoritmos.                |
| Infraestructura local             | Implementa repositorios, migraciones, CSV, respaldo y PWA.         | Reglas financieras duplicadas.                  |
| Futuro servicio de sincronización | Sincroniza datos consentidos mediante puertos.                     | Motor financiero como fuente de verdad remota.  |

## Persistencia y evolución freemium

El código de aplicación dependerá de puertos como `LoanRepository`, `BackupService` y, en el futuro, `SyncService`. `@cuotaclara/local-storage` es el adaptador IndexedDB del MVP. Cuentas, sincronización y funciones premium se agregan como adaptadores y políticas de aplicación; los cálculos y datos locales no dependen de una suscripción.

## Flujo de importación de pagos

```text
CSV → parseo regional → filas normalizadas → validación y detección de duplicados
    → previsualización y resolución de errores → confirmación
    → comparación opcional con saldo bancario → ajuste confirmado y reset → repositorio local
```

La previsualización es obligatoria. Las filas rechazadas no se persisten y la importación confirmada conserva su procedencia.

Como apoyo externo a este flujo, `tooling/convert_payment_plan_pdf.py` transforma localmente un formato de plan PDF conocido en el CSV regional. No forma parte del dominio ni del adaptador de importación: su salida sigue pasando por la misma validación, previsualización y confirmación, pues un plan programado no prueba un pago histórico.

El adaptador reutilizable `packages/import-csv` convierte texto CSV en una previsualización de `PaymentRecord`; no depende de IndexedDB ni puede confirmar la importación. El dominio calcula los acumulados, la discrepancia y la cuota posterior al reset; la PWA solo solicita la confirmación explícita y el adaptador local persiste el agregado resultante.

## Flujo de proyección

```text
Préstamo + pagos históricos + fecha de corte + reset bancario opcional + escenario
  → reconstrucción/reconciliación
  → acumular histórico y resolver saldo inicial/final del reset
  → resolver tasa por periodo y cuota hasta la fecha final aplicable
  → aplicar interés, cuota, cargos y pago extraordinario
  → periodos y resumen trazables
```

## Presentación de resultados planificada

La PWA separará el resumen inmediato del detalle de amortización. El resumen consume una estimación ya calculada y muestra los importes clave; la solicitud explícita de la persona usuaria inicia el cálculo/visualización de tabla y gráfico. Ese límite evita trabajo visual innecesario y permite que los ejes, rango y accesibilidad del gráfico evolucionen sin acoplarlos al dominio. El formato monetario será un servicio de presentación común: el dominio entrega `Money` y la PWA decide locale y símbolos sin alterar el valor decimal.

## Reglas de diseño

- Dependencias dirigidas hacia el dominio; los adaptadores dependen de interfaces del núcleo.
- Las decisiones de días, tasa, cuota ante cambios y redondeo son políticas explícitas e inyectables.
- Las referencias de tasa, incluido TBP+margen, son supuestos versionados de escenario; una futura fuente externa será un adaptador opcional y nunca una dependencia del cálculo local.
- El resultado guarda versiones de motor y políticas para poder explicarlo y repetirlo.
- Las transacciones de importación, restauración y borrado se confirman y son recuperables cuando sea posible.

Los ADR actuales se encuentran en [`adr/`](adr/).
