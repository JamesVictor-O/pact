export type Amount = bigint;

export type FundingState = "committed" | "received" | "allocated";
export type ObligationState =
  | "unfunded"
  | "partially_funded"
  | "funded"
  | "paid";

export interface FundingPosition {
  committed: Amount;
  received: Amount;
  allocated: Amount;
}

export interface ObligationPosition {
  amount: Amount;
  allocated: Amount;
  paid: Amount;
}

export interface EventCoverage {
  committed: Amount;
  received: Amount;
  available: Amount;
  obligations: Amount;
  allocated: Amount;
  paid: Amount;
  uncovered: Amount;
}

export class DomainInvariantError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DomainInvariantError";
    this.code = code;
  }
}

export function assertAmount(value: Amount, field = "amount"): Amount {
  if (value < 0n) {
    throw new DomainInvariantError("NEGATIVE_AMOUNT", `${field} cannot be negative`);
  }
  return value;
}

export function availableFunds(position: FundingPosition): Amount {
  validateFundingPosition(position);
  return position.received - position.allocated;
}

export function validateFundingPosition(position: FundingPosition): void {
  assertAmount(position.committed, "committed");
  assertAmount(position.received, "received");
  assertAmount(position.allocated, "allocated");

  if (position.received > position.committed) {
    throw new DomainInvariantError(
      "RECEIPTS_EXCEED_COMMITMENT",
      "received funds cannot exceed the committed amount",
    );
  }
  if (position.allocated > position.received) {
    throw new DomainInvariantError(
      "OVER_ALLOCATION",
      "allocated funds cannot exceed received funds",
    );
  }
}

export function fundingState(position: FundingPosition): FundingState {
  validateFundingPosition(position);
  if (position.allocated === position.received && position.received > 0n) return "allocated";
  if (position.received > 0n) return "received";
  return "committed";
}

export function validateObligation(position: ObligationPosition): void {
  assertAmount(position.amount, "obligation amount");
  assertAmount(position.allocated, "obligation allocation");
  assertAmount(position.paid, "obligation payment");

  if (position.amount === 0n) {
    throw new DomainInvariantError("ZERO_OBLIGATION", "obligation amount must be positive");
  }
  if (position.allocated > position.amount) {
    throw new DomainInvariantError(
      "OBLIGATION_OVERFUNDED",
      "obligation allocation cannot exceed its amount",
    );
  }
  if (position.paid > position.allocated) {
    throw new DomainInvariantError(
      "PAYMENT_EXCEEDS_ALLOCATION",
      "paid amount cannot exceed the obligation allocation",
    );
  }
}

export function obligationState(position: ObligationPosition): ObligationState {
  validateObligation(position);
  if (position.paid === position.amount) return "paid";
  if (position.allocated === position.amount) return "funded";
  if (position.allocated > 0n) return "partially_funded";
  return "unfunded";
}

export function allocate(
  funding: FundingPosition,
  obligation: ObligationPosition,
  amount: Amount,
): { funding: FundingPosition; obligation: ObligationPosition } {
  validateFundingPosition(funding);
  validateObligation(obligation);
  assertPositive(amount, "allocation amount");

  if (amount > availableFunds(funding)) {
    throw new DomainInvariantError("INSUFFICIENT_AVAILABLE_FUNDS", "allocation exceeds available funds");
  }
  if (amount > obligation.amount - obligation.allocated) {
    throw new DomainInvariantError("OBLIGATION_OVERFUNDED", "allocation exceeds uncovered obligation amount");
  }

  return {
    funding: { ...funding, allocated: funding.allocated + amount },
    obligation: { ...obligation, allocated: obligation.allocated + amount },
  };
}

export function releasePayment(
  obligation: ObligationPosition,
  amount: Amount,
): ObligationPosition {
  validateObligation(obligation);
  assertPositive(amount, "payment amount");

  if (amount > obligation.allocated - obligation.paid) {
    throw new DomainInvariantError(
      "PAYMENT_EXCEEDS_ALLOCATION",
      "payment exceeds allocated and unpaid funds",
    );
  }
  return { ...obligation, paid: obligation.paid + amount };
}

export function calculateCoverage(
  funding: readonly FundingPosition[],
  obligations: readonly ObligationPosition[],
): EventCoverage {
  funding.forEach(validateFundingPosition);
  obligations.forEach(validateObligation);

  const committed = sum(funding.map((item) => item.committed));
  const received = sum(funding.map((item) => item.received));
  const allocated = sum(obligations.map((item) => item.allocated));
  const obligationsTotal = sum(obligations.map((item) => item.amount));
  const paid = sum(obligations.map((item) => item.paid));

  if (allocated > sum(funding.map((item) => item.allocated))) {
    throw new DomainInvariantError(
      "ALLOCATION_LEDGER_MISMATCH",
      "obligation allocations exceed funding-source allocations",
    );
  }

  return {
    committed,
    received,
    available: received - sum(funding.map((item) => item.allocated)),
    obligations: obligationsTotal,
    allocated,
    paid,
    uncovered: obligationsTotal - allocated,
  };
}

function assertPositive(value: Amount, field: string): void {
  assertAmount(value, field);
  if (value === 0n) {
    throw new DomainInvariantError("ZERO_AMOUNT", `${field} must be positive`);
  }
}

function sum(values: readonly Amount[]): Amount {
  return values.reduce((total, value) => total + value, 0n);
}
