# Préstamo y puerto de repositorio

## Préstamo contractual

`Loan` conserva sus campos financieros v1 para no romper proyecciones y pagos existentes. `createLoanV2` conserva el contrato heredado de cuota base. `createLoanV3` crea el contrato activo con monto original, cuota total mensual, seguro mensual y exactamente una de fecha final o cantidad total de cuotas. En v3, `ordinaryPayment` siempre es la cuota base derivada (`monthlyTotalPayment − monthlyInsurance`); el monto original y la cuota base duplicados deben coincidir con los campos financieros del préstamo.

Un préstamo sin `contract` se identifica mediante `isLegacyLoan`. `requiresContractMigration` identifica tanto esos préstamos como los contratos v2, que no se reinterpretan automáticamente. Un registro heredado sigue pudiendo cargarse, exportarse y conservar sus pagos y escenarios. El diseño de detalle está en [`loan-contract-v2.md`](loan-contract-v2.md) y su evolución en [`contract-payment-and-results-v3.md`](contract-payment-and-results-v3.md).

`estimateLoanContract` recibe un `Loan` con contrato v2 o v3 y genera una proyección trazable: cuotas, principal, interés, seguro, total, fecha de última cuota, pago final y saldo pendiente. Para v3 conserva el plazo declarado y compara la cuota total configurada con la cuota inicial proyectada necesaria bajo sus supuestos. No modifica el agregado ni los pagos históricos.

Este contrato representa la configuración del préstamo; los pagos históricos y escenarios viven en el agregado asociado para que una proyección no modifique la realidad contractual.

## Agregado y persistencia

`LoanAggregate` reúne un préstamo, sus `PaymentRecord`, un reset bancario opcional y sus snapshots de escenarios. El reset conserva saldo principal reportado, fecha de corte, fecha final bancaria, diferencia calculada y, si fue confirmado, su ajuste histórico especial. `LoanRepository` solo expresa las operaciones asíncronas de listar, cargar, guardar y eliminar agregados.

El puerto no conoce Dexie, IndexedDB, React ni red. El siguiente adaptador local implementará este contrato con IndexedDB; una sincronización futura podrá implementar el mismo puerto con consentimiento de la persona usuaria.

Un snapshot de escenario conserva identificador, préstamo asociado, nombre, configuración y fecha de creación. El modelo detallado de estrategias seguirá evolucionando sin cambiar la frontera de persistencia.

## Gestión desde la PWA

La PWA permite crear, editar, duplicar y eliminar un préstamo. Guardar conserva los pagos y escenarios del mismo agregado; duplicar genera un identificador nuevo y empieza sin pagos ni escenarios para no mezclar datos reales. Duplicación y borrado solicitan confirmación explícita. La eliminación borra el agregado completo mediante el repositorio transaccional.
