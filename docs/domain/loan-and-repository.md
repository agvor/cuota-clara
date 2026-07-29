# Préstamo y puerto de repositorio

## Préstamo contractual

`Loan` conserva sus campos financieros v1 para no romper proyecciones y pagos existentes. `createLoanV2` crea además un `contract` de versión `2`, con monto original, cuota mensual, seguro mensual y exactamente una de fecha final o cantidad total de cuotas. La cuota y el monto original duplicados deben coincidir con los campos v1.

Un préstamo sin `contract` se identifica mediante `isLegacyLoan`. Es un registro heredado: no se le asignan plazo ni seguro por defecto y sigue pudiendo cargarse, exportarse y conservar sus pagos y escenarios. El diseño de detalle está en [`loan-contract-v2.md`](loan-contract-v2.md).

`estimateLoanContract` recibe únicamente un `Loan` con contrato v2 y genera una proyección trazable: cuotas, principal, interés, seguro, total, fecha de última cuota, pago final y saldo pendiente. No modifica el agregado ni los pagos históricos; la interfaz usará el resultado en US-020.

Este contrato representa la configuración del préstamo; los pagos históricos y escenarios viven en el agregado asociado para que una proyección no modifique la realidad contractual.

## Agregado y persistencia

`LoanAggregate` reúne un préstamo, sus `PaymentRecord` y sus snapshots de escenarios. `LoanRepository` solo expresa las operaciones asíncronas de listar, cargar, guardar y eliminar agregados.

El puerto no conoce Dexie, IndexedDB, React ni red. El siguiente adaptador local implementará este contrato con IndexedDB; una sincronización futura podrá implementar el mismo puerto con consentimiento de la persona usuaria.

Un snapshot de escenario conserva identificador, préstamo asociado, nombre, configuración y fecha de creación. El modelo detallado de estrategias seguirá evolucionando sin cambiar la frontera de persistencia.

## Gestión desde la PWA

La PWA permite crear, editar, duplicar y eliminar un préstamo. Guardar conserva los pagos y escenarios del mismo agregado; duplicar genera un identificador nuevo y empieza sin pagos ni escenarios para no mezclar datos reales. Duplicación y borrado solicitan confirmación explícita. La eliminación borra el agregado completo mediante el repositorio transaccional.
