# Préstamo y puerto de repositorio

## Préstamo mínimo

`Loan` contiene identificador, nombre, fecha inicial, saldo inicial, cuota ordinaria, tasa nominal anual, períodos por año y política de redondeo. Su creación valida moneda común entre saldo y cuota, importes positivos y datos financieros básicos.

Este contrato representa la configuración del préstamo; los pagos históricos y escenarios viven en el agregado asociado para que una proyección no modifique la realidad contractual.

## Agregado y persistencia

`LoanAggregate` reúne un préstamo, sus `PaymentRecord` y sus snapshots de escenarios. `LoanRepository` solo expresa las operaciones asíncronas de listar, cargar, guardar y eliminar agregados.

El puerto no conoce Dexie, IndexedDB, React ni red. El siguiente adaptador local implementará este contrato con IndexedDB; una sincronización futura podrá implementar el mismo puerto con consentimiento de la persona usuaria.

Un snapshot de escenario conserva identificador, préstamo asociado, nombre, configuración y fecha de creación. El modelo detallado de estrategias seguirá evolucionando sin cambiar la frontera de persistencia.
