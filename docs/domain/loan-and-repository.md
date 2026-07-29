# Préstamo y puerto de repositorio

## Préstamo mínimo

La implementación actual de `Loan` contiene identificador, nombre, fecha inicial, saldo inicial, cuota ordinaria, tasa nominal anual, períodos por año y política de redondeo. Puede incluir una fase variable manual. Ese contrato es insuficiente para el plazo y seguro requeridos; el diseño propuesto está en [`loan-contract-v2.md`](loan-contract-v2.md) y debe reemplazarlo mediante migración explícita, no por valores inventados.

Este contrato representa la configuración del préstamo; los pagos históricos y escenarios viven en el agregado asociado para que una proyección no modifique la realidad contractual.

## Agregado y persistencia

`LoanAggregate` reúne un préstamo, sus `PaymentRecord` y sus snapshots de escenarios. `LoanRepository` solo expresa las operaciones asíncronas de listar, cargar, guardar y eliminar agregados.

El puerto no conoce Dexie, IndexedDB, React ni red. El siguiente adaptador local implementará este contrato con IndexedDB; una sincronización futura podrá implementar el mismo puerto con consentimiento de la persona usuaria.

Un snapshot de escenario conserva identificador, préstamo asociado, nombre, configuración y fecha de creación. El modelo detallado de estrategias seguirá evolucionando sin cambiar la frontera de persistencia.

## Gestión desde la PWA

La PWA permite crear, editar, duplicar y eliminar un préstamo. Guardar conserva los pagos y escenarios del mismo agregado; duplicar genera un identificador nuevo y empieza sin pagos ni escenarios para no mezclar datos reales. Duplicación y borrado solicitan confirmación explícita. La eliminación borra el agregado completo mediante el repositorio transaccional.
