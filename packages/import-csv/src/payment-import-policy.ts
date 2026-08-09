import { createPaymentRecord, type PaymentRecord } from '@cuotaclara/domain';

export type PaymentImportMatch = Readonly<{
  incoming: PaymentRecord;
  existing: PaymentRecord;
}>;

export type PossiblePaymentDuplicate = Readonly<{
  incoming: PaymentRecord;
  matches: readonly PaymentRecord[];
}>;

export type PaymentImportClassification = Readonly<{
  newRecords: readonly PaymentRecord[];
  alreadyRegistered: readonly PaymentImportMatch[];
  conflicts: readonly PaymentImportMatch[];
  possibleDuplicates: readonly PossiblePaymentDuplicate[];
}>;

export type PaymentImportDecisions = Readonly<{
  conflicts?: Readonly<Record<string, 'keep_existing' | 'replace'>>;
  possibleDuplicates?: Readonly<Record<string, 'omit' | 'import'>>;
}>;

export type PaymentImportMergeResult = Readonly<{
  payments: readonly PaymentRecord[];
  imported: readonly PaymentRecord[];
  omitted: readonly PaymentRecord[];
  replaced: readonly Readonly<{ previous: PaymentRecord; replacement: PaymentRecord }>[];
  unresolvedConflicts: readonly PaymentImportMatch[];
  unresolvedPossibleDuplicates: readonly PossiblePaymentDuplicate[];
}>;

export function classifyPaymentImports(
  existingPayments: readonly PaymentRecord[],
  incomingPayments: readonly PaymentRecord[],
): PaymentImportClassification {
  const knownBySourcePaymentId = new Map<string, PaymentRecord>();
  const knownByFingerprint = new Map<string, PaymentRecord[]>();
  for (const payment of existingPayments) addKnownPayment(payment);

  const newRecords: PaymentRecord[] = [];
  const alreadyRegistered: PaymentImportMatch[] = [];
  const conflicts: PaymentImportMatch[] = [];
  const possibleDuplicates: PossiblePaymentDuplicate[] = [];

  for (const incoming of incomingPayments) {
    const sourcePaymentId = incoming.sourcePaymentId;
    if (!sourcePaymentId) continue;
    const sameReference = knownBySourcePaymentId.get(sourcePaymentId);
    if (sameReference) {
      const match = { incoming, existing: sameReference };
      if (samePaymentContent(sameReference, incoming)) alreadyRegistered.push(match);
      else conflicts.push(match);
      continue;
    }

    const matches = (knownByFingerprint.get(paymentFingerprint(incoming)) ?? []).filter(
      (payment) => payment.sourcePaymentId !== sourcePaymentId,
    );
    if (matches.length) possibleDuplicates.push({ incoming, matches: Object.freeze([...matches]) });
    else newRecords.push(incoming);
    addKnownPayment(incoming);
  }

  return Object.freeze({
    newRecords: Object.freeze(newRecords),
    alreadyRegistered: Object.freeze(alreadyRegistered),
    conflicts: Object.freeze(conflicts),
    possibleDuplicates: Object.freeze(possibleDuplicates),
  });

  function addKnownPayment(payment: PaymentRecord): void {
    if (payment.sourcePaymentId && !knownBySourcePaymentId.has(payment.sourcePaymentId)) {
      knownBySourcePaymentId.set(payment.sourcePaymentId, payment);
    }
    const fingerprint = paymentFingerprint(payment);
    const matches = knownByFingerprint.get(fingerprint) ?? [];
    matches.push(payment);
    knownByFingerprint.set(fingerprint, matches);
  }
}

export function mergePaymentImports(
  existingPayments: readonly PaymentRecord[],
  incomingPayments: readonly PaymentRecord[],
  decisions: PaymentImportDecisions = {},
): PaymentImportMergeResult {
  const classification = classifyPaymentImports(existingPayments, incomingPayments);
  const payments = [...existingPayments, ...classification.newRecords];
  const imported = [...classification.newRecords];
  const omitted = classification.alreadyRegistered.map(({ incoming }) => incoming);
  const replaced: Array<{ previous: PaymentRecord; replacement: PaymentRecord }> = [];
  const unresolvedConflicts: PaymentImportMatch[] = [];
  const unresolvedPossibleDuplicates: PossiblePaymentDuplicate[] = [];

  for (const conflict of classification.conflicts) {
    const decision = decisions.conflicts?.[decisionKey(conflict.incoming)];
    if (!decision) {
      unresolvedConflicts.push(conflict);
      continue;
    }
    if (decision === 'keep_existing') {
      omitted.push(conflict.incoming);
      continue;
    }
    const replacement = createPaymentRecord({ ...conflict.incoming, id: conflict.existing.id });
    const index = payments.findIndex(({ id }) => id === conflict.existing.id);
    if (index >= 0) payments[index] = replacement;
    replaced.push({ previous: conflict.existing, replacement });
  }

  for (const possible of classification.possibleDuplicates) {
    const decision = decisions.possibleDuplicates?.[decisionKey(possible.incoming)];
    if (!decision) {
      unresolvedPossibleDuplicates.push(possible);
      continue;
    }
    if (decision === 'omit') omitted.push(possible.incoming);
    else {
      payments.push(possible.incoming);
      imported.push(possible.incoming);
    }
  }

  return Object.freeze({
    payments: Object.freeze(payments),
    imported: Object.freeze(imported),
    omitted: Object.freeze(omitted),
    replaced: Object.freeze(replaced),
    unresolvedConflicts: Object.freeze(unresolvedConflicts),
    unresolvedPossibleDuplicates: Object.freeze(unresolvedPossibleDuplicates),
  });
}

function decisionKey(payment: PaymentRecord): string {
  return payment.sourcePaymentId ?? payment.id;
}

function samePaymentContent(left: PaymentRecord, right: PaymentRecord): boolean {
  return paymentContent(left) === paymentContent(right);
}

function paymentContent(payment: PaymentRecord): string {
  return JSON.stringify([
    payment.date,
    moneyValue(payment.totalAmount),
    optionalMoneyValue(payment.interestAmount),
    optionalMoneyValue(payment.principalAmount),
    optionalMoneyValue(payment.extraPrincipalAmount),
    optionalMoneyValue(payment.insuranceAmount),
    optionalMoneyValue(payment.feeAmount),
    payment.notes?.trim() || null,
  ]);
}

function paymentFingerprint(payment: PaymentRecord): string {
  return JSON.stringify([
    payment.date,
    moneyValue(payment.totalAmount),
    optionalMoneyValue(payment.interestAmount),
    optionalMoneyValue(payment.principalAmount),
    optionalMoneyValue(payment.extraPrincipalAmount),
    optionalMoneyValue(payment.insuranceAmount),
    optionalMoneyValue(payment.feeAmount),
  ]);
}

function moneyValue(payment: PaymentRecord['totalAmount']): readonly string[] {
  return [payment.currency, payment.toDecimalString()];
}

function optionalMoneyValue(payment: PaymentRecord['interestAmount']): readonly string[] | null {
  return payment ? moneyValue(payment) : null;
}
