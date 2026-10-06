import type { FundingSource, FundingSourceStatus, FundingSourceType } from "./pact-types";

export const FUNDING_TYPE_LABELS: Record<FundingSourceType, string> = {
  organizer: "Organizer funds",
  sponsor: "Sponsor",
  partner: "Partner",
  ticket_revenue: "Ticket revenue",
  grant: "Grant",
  other: "Other",
};

export const FUNDING_STATUS_LABELS: Record<FundingSourceStatus, string> = {
  expected: "Expected",
  partially_received: "Partially received",
  received: "Received",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export function getFundingSourceStatus(source: FundingSource, today = new Date()): FundingSourceStatus {
  if (source.cancelledAt) return "cancelled";
  if (source.receivedAmount >= source.committedAmount) return "received";

  const todayValue = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
  if (source.expectedDate && source.expectedDate < todayValue) return "overdue";
  if (source.receivedAmount > 0) return "partially_received";
  return "expected";
}

export type FundingSummary = {
  committed: number;
  received: number;
  stillExpected: number;
  available: number;
  allocated: number;
  released: number;
};

export function getFundingSummary(
  sources: FundingSource[],
  ledger: { allocated?: number; released?: number } = {},
): FundingSummary {
  const activeSources = sources.filter((source) => !source.cancelledAt);
  const committed = activeSources.reduce((total, source) => total + source.committedAmount, 0);
  const received = sources.reduce((total, source) => total + source.receivedAmount, 0);
  const allocated = ledger.allocated ?? 0;
  const released = ledger.released ?? 0;

  return {
    committed,
    received,
    stillExpected: activeSources.reduce((total, source) => total + Math.max(source.committedAmount - source.receivedAmount, 0), 0),
    available: Math.max(received - allocated - released, 0),
    allocated,
    released,
  };
}

export function formatEventCurrency(value: number, currency: string): string {
  if (!Number.isFinite(value)) return "--";
  if (Object.is(value, -0)) value = 0;
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (value !== 0 && Math.abs(value) < 0.01) return `${value < 0 ? "-" : ""}<${formatter.format(0.01)}`;
  return formatter.format(value);
}

export function formatMinorCurrency(valueMinor: number, currency: string): string {
  return formatEventCurrency(valueMinor / 100, currency);
}

export function formatFundingDate(date?: string, long = false): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en", {
    month: long ? "long" : "short",
    day: "numeric",
    year: long ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
