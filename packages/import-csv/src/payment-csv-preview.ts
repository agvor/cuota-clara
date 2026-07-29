import { createPaymentRecord, Money, type PaymentRecord } from '@cuotaclara/domain';
import Papa from 'papaparse';

const REQUIRED_HEADERS = ['id', 'date', 'total_amount'] as const;
const DECIMAL_LITERAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export type CsvRegionalFormat = Readonly<{
  delimiter: ',' | ';' | '\t';
  decimalSeparator: ',' | '.';
  dateFormat: 'yyyy-mm-dd' | 'dd/mm/yyyy';
  thousandsSeparator?: string;
}>;

export type CsvPreviewErrorCode =
  | 'csv_parse'
  | 'missing_required_header'
  | 'duplicate_id'
  | 'invalid_date'
  | 'invalid_amount'
  | 'invalid_record';

export type CsvPreviewError = Readonly<{
  code: CsvPreviewErrorCode;
  message: string;
  rowNumber?: number;
  field?: string;
}>;

export type CsvPreviewRow = Readonly<{
  rowNumber: number;
  raw: Readonly<Record<string, string>>;
  record?: PaymentRecord;
  errors: readonly CsvPreviewError[];
}>;

export type PaymentCsvPreview = Readonly<{
  rows: readonly CsvPreviewRow[];
  validRecords: readonly PaymentRecord[];
  errors: readonly CsvPreviewError[];
  duplicates: readonly Readonly<{ id: string; rowNumber: number }>[];
  missingPeriods: readonly string[];
}>;

function normalizeAmount(raw: string, format: CsvRegionalFormat): string {
  const trimmed = raw.trim();
  const thousandsSeparator =
    format.thousandsSeparator ?? (format.decimalSeparator === ',' ? '.' : ',');
  const withoutGrouping = thousandsSeparator ? trimmed.split(thousandsSeparator).join('') : trimmed;
  const normalized =
    format.decimalSeparator === ',' ? withoutGrouping.replace(',', '.') : withoutGrouping;
  if (!DECIMAL_LITERAL.test(normalized)) {
    throw new Error('El importe no coincide con el formato decimal configurado.');
  }
  return normalized;
}

function normalizeDate(raw: string, format: CsvRegionalFormat): string {
  const trimmed = raw.trim();
  if (format.dateFormat === 'yyyy-mm-dd') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new Error('La fecha no usa YYYY-MM-DD.');
    return trimmed;
  }

  const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!parts) throw new Error('La fecha no usa DD/MM/YYYY.');
  const [, dayText, monthText, yearText] = parts;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('La fecha no existe en el calendario.');
  }
  return `${yearText}-${monthText}-${dayText}`;
}

function optionalAmount(
  row: Record<string, string>,
  field: string,
  currency: string,
  format: CsvRegionalFormat,
): Money | undefined {
  const raw = row[field]?.trim();
  return raw ? Money.from(normalizeAmount(raw, format), currency) : undefined;
}

function monthAfter(period: string): string {
  const [yearText, monthText] = period.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${month === 12 ? year + 1 : year}-${String(nextMonth).padStart(2, '0')}`;
}

function detectMissingPeriods(records: readonly PaymentRecord[]): string[] {
  const periods = [...new Set(records.map((record) => record.date.slice(0, 7)))].sort();
  const missing: string[] = [];
  for (let index = 1; index < periods.length; index += 1) {
    const previous = periods[index - 1];
    const next = periods[index];
    if (!previous || !next) continue;
    let expected = monthAfter(previous);
    while (expected < next) {
      missing.push(expected);
      expected = monthAfter(expected);
    }
  }
  return missing;
}

function parseError(error: Papa.ParseError): CsvPreviewError {
  return {
    code: 'csv_parse',
    message: error.message,
    rowNumber: (error.row ?? 0) + 2,
  };
}

export function previewPaymentCsv(input: {
  csvText: string;
  currency: string;
  format: CsvRegionalFormat;
  existingPaymentIds?: readonly string[];
}): PaymentCsvPreview {
  const parsed = Papa.parse<Record<string, string>>(input.csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    delimiter: input.format.delimiter,
    transformHeader: (header) => header.trim().replace(/^\uFEFF/, ''),
  });
  const errors: CsvPreviewError[] = parsed.errors.map(parseError);
  const headers = new Set(parsed.meta.fields ?? []);
  for (const header of REQUIRED_HEADERS) {
    if (!headers.has(header)) {
      errors.push({
        code: 'missing_required_header',
        field: header,
        message: `Falta el encabezado obligatorio ${header}.`,
      });
    }
  }
  if (errors.some((error) => error.code === 'missing_required_header')) {
    return { rows: [], validRecords: [], errors, duplicates: [], missingPeriods: [] };
  }

  const knownIds = new Set(input.existingPaymentIds ?? []);
  const duplicates: Array<{ id: string; rowNumber: number }> = [];
  const rows: CsvPreviewRow[] = [];
  const validRecords: PaymentRecord[] = [];

  for (const [index, raw] of parsed.data.entries()) {
    const rowNumber = index + 2;
    const rowErrors: CsvPreviewError[] = [];
    const id = raw.id?.trim() ?? '';
    if (knownIds.has(id)) {
      const error = {
        code: 'duplicate_id' as const,
        rowNumber,
        message: `El identificador ${id} está duplicado.`,
      };
      rowErrors.push(error);
      duplicates.push({ id, rowNumber });
    }

    try {
      const date = normalizeDate(raw.date ?? '', input.format);
      const interestAmount = optionalAmount(raw, 'interest_amount', input.currency, input.format);
      const principalAmount = optionalAmount(raw, 'principal_amount', input.currency, input.format);
      const extraPrincipalAmount = optionalAmount(
        raw,
        'extra_principal_amount',
        input.currency,
        input.format,
      );
      const insuranceAmount = optionalAmount(raw, 'insurance_amount', input.currency, input.format);
      const feeAmount = optionalAmount(raw, 'fee_amount', input.currency, input.format);
      const record = createPaymentRecord({
        id,
        date,
        totalAmount: Money.from(
          normalizeAmount(raw.total_amount ?? '', input.format),
          input.currency,
        ),
        source: 'csv_import',
        sourceReference: `csv:${rowNumber}`,
        ...(interestAmount ? { interestAmount } : {}),
        ...(principalAmount ? { principalAmount } : {}),
        ...(extraPrincipalAmount ? { extraPrincipalAmount } : {}),
        ...(insuranceAmount ? { insuranceAmount } : {}),
        ...(feeAmount ? { feeAmount } : {}),
        ...(raw.notes?.trim() ? { notes: raw.notes.trim() } : {}),
      });
      if (rowErrors.length === 0) {
        knownIds.add(id);
        validRecords.push(record);
        rows.push({ rowNumber, raw, record, errors: rowErrors });
      } else {
        rows.push({ rowNumber, raw, errors: rowErrors });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Fila inválida.';
      const code: CsvPreviewErrorCode = /fecha/i.test(message)
        ? 'invalid_date'
        : /importe|decimal/i.test(message)
          ? 'invalid_amount'
          : 'invalid_record';
      rowErrors.push({ code, rowNumber, message });
      rows.push({ rowNumber, raw, errors: rowErrors });
    }
    errors.push(...rowErrors);
  }

  return {
    rows,
    validRecords,
    errors,
    duplicates,
    missingPeriods: detectMissingPeriods(validRecords),
  };
}
