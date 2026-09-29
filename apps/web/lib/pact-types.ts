export const DISPLAY_CURRENCIES = ["USD", "NGN", "EUR", "GBP"] as const;
export const EVENT_TYPES = [
  "Conference",
  "Community Event",
  "Concert",
  "Corporate Event",
  "Creator Event",
  "Wedding",
  "Other",
] as const;

export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];
export type EventType = (typeof EVENT_TYPES)[number];

export const FUNDING_SOURCE_TYPES = [
  "organizer",
  "sponsor",
  "partner",
  "ticket_revenue",
  "grant",
  "other",
] as const;

export type FundingSourceType = (typeof FUNDING_SOURCE_TYPES)[number];
export type FundingSourceStatus = "expected" | "partially_received" | "received" | "overdue" | "cancelled";

export const EXPENSE_CATEGORIES = ["venue", "production", "catering", "security", "travel", "media", "equipment", "contractor", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ExpenseStatus = "unfunded" | "partially_funded" | "funded" | "partially_paid" | "paid" | "overdue" | "cancelled";
export type ExpensePaymentStatus = "unfunded" | "partially_funded" | "funded" | "paid" | "overdue" | "cancelled";
export type VendorPayoutStatus = "missing" | "pending" | "verified";
export type PaymentOperationalStatus = "needs_funding" | "partially_funded" | "payout_setup_needed" | "ready_to_pay" | "overdue" | "processing" | "paid" | "cancelled";

export interface PactUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface PactEvent {
  id: string;
  ownerId: string;
  name: string;
  date: string;
  estimatedBudget: number;
  displayCurrency: DisplayCurrency;
  eventType?: EventType;
  status: "active";
  createdAt: string;
}

export type NewPactEvent = Pick<
  PactEvent,
  "name" | "date" | "estimatedBudget" | "displayCurrency" | "eventType"
>;

export interface FundingSource {
  id: string;
  eventId: string;
  type: FundingSourceType;
  name: string;
  committedAmount: number;
  receivedAmount: number;
  expectedDate?: string;
  notes?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type FundingSourceInput = Pick<
  FundingSource,
  "type" | "name" | "committedAmount" | "receivedAmount" | "expectedDate" | "notes"
>;

export interface Expense {
  id: string;
  eventId: string;
  title: string;
  category: ExpenseCategory;
  vendorName: string;
  vendorEmail?: string;
  vendorPayoutStatus?: VendorPayoutStatus;
  totalAmount: number;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpensePayment {
  /** A scheduled obligation. Actual vendor transfers will use a separate execution record in a later phase. */
  id: string;
  expenseId: string;
  label: string;
  amount: number;
  dueDate?: string;
  fundedAmount: number;
  paidAmount: number;
  processingStartedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ExpensePaymentInput = Pick<ExpensePayment, "label" | "amount" | "dueDate" | "fundedAmount" | "paidAmount"> & { id?: string };
export type ExpenseInput = Pick<Expense, "title" | "category" | "vendorName" | "vendorEmail" | "totalAmount"> & { payments: ExpensePaymentInput[] };
export type ExpenseRecord = { expense: Expense; payments: ExpensePayment[] };
