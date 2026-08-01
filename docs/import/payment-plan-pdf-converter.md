# Conversión de un plan de pagos PDF

`tooling/convert_payment_plan_pdf.py` convierte el plan de pagos PDF entregado por la entidad al [CSV de pagos](payment-csv.md) que importa CuotaClara. El conversor se ejecuta localmente, usa solo la biblioteca estándar de Python y no transmite ni conserva los datos fuera del archivo CSV que se indique.

El formato admitido es el PDF tabular generado por Select.Pdf que contiene por cuota: fecha, total, amortización a capital, intereses corrientes, pólizas y otros. No es un lector genérico de PDF ni confirma que una cuota planificada haya sido efectivamente pagada.

## Uso

Desde la raíz del repositorio:

```bash
python3 tooling/convert_payment_plan_pdf.py \
  "/ruta/GeneratePDF (1).pdf" \
  /tmp/pagos-hasta-hoy.csv
```

Por defecto incluye únicamente las cuotas cuya fecha sea igual o anterior a la fecha local de ejecución. Para reproducir un corte específico, indica la fecha inclusive con `--until`:

```bash
python3 tooling/convert_payment_plan_pdf.py \
  "/ruta/GeneratePDF (1).pdf" \
  /tmp/pagos-2026-07-31.csv \
  --until 2026-07-31
```

El archivo generado usa `;`, coma decimal y fechas `DD/MM/AAAA`, la configuración regional inicial de la importación. Sus columnas se asignan así:

| Campo CSV                | Campo leído del PDF                                        |
| ------------------------ | ---------------------------------------------------------- |
| `total_amount`           | Cuota total                                                |
| `principal_amount`       | Amortización a capital                                     |
| `interest_amount`        | Intereses corrientes                                       |
| `insurance_amount`       | Pólizas                                                    |
| `fee_amount`             | Otros                                                      |
| `extra_principal_amount` | Vacío: el PDF no declara un aporte extraordinario separado |

## Importación segura

1. En CuotaClara abre el préstamo y entra a **Pagos**.
2. Importa el CSV y conserva el formato regional `;`, `,` y `DD/MM/YYYY`.
3. Revisa la previsualización: totales, fechas, posibles duplicados y meses faltantes.
4. Confirma solo las filas que representen pagos reales. Un plan de pagos es una programación de cobros, no un comprobante de pago.

El conversor falla en vez de inventar campos cuando no encuentra el número, total o desglose necesario de una cuota. Si la entidad modifica el diseño de su PDF, no importes un resultado parcial: registra el nuevo formato como una mejora y conserva el PDF original como referencia privada.
