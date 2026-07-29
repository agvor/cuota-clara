# Escenarios de pago extraordinario único

Un escenario es una captura independiente asociada a un préstamo; no modifica su configuración ni los pagos históricos. La primera estrategia disponible contiene un pago extraordinario único, con identificador, fecha de pago y un importe positivo en la moneda del préstamo.

`compareLoanWithOneTimeExtraPayment` construye un calendario base y uno alternativo, aplica el extra únicamente al principal en la alternativa y devuelve fecha de finalización, plazo e interés ahorrado. La captura persistible usa la versión `one_time_extra_payment_v1`, con el importe decimal como texto.

La primera comparación se basa en la configuración contractual del préstamo. Los pagos históricos permanecen aislados y una evolución que inicie desde un corte reconciliado se incorporará cuando el calendario de proyección tenga una política contractual completa.

La política inicial genera hasta 600 fechas de pago desde la fecha inicial para frecuencias que dividen 12 (mensual, trimestral, semestral o anual); conserva el día del mes y lo ajusta al último día cuando es necesario. La fecha del pago extraordinario debe coincidir con una fecha del calendario. Esta política está explícita para poder sustituirse por un calendario contractual posterior.
