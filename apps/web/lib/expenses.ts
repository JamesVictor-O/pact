import type { Expense, ExpenseCategory, ExpensePayment, ExpensePaymentStatus, ExpenseRecord, ExpenseStatus, PaymentOperationalStatus, VendorPayoutStatus } from "./pact-types";
import { getAgreementPaymentReadiness } from "./agreements.ts";
import type { Invoice, PaymentAgreement, PayoutProfile } from "./pact-types";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  venue: "Venue", production: "Production", catering: "Catering", security: "Security", travel: "Travel",
  media: "Media", equipment: "Equipment", contractor: "Contractor", other: "Other",
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  unfunded: "Unfunded", partially_funded: "Partially funded", funded: "Funded", partially_paid: "Partially paid",
  paid: "Paid", overdue: "Overdue", cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<ExpensePaymentStatus, string> = {
  unfunded: "Unfunded", partially_funded: "Partially funded", funded: "Funded", paid: "Paid", overdue: "Overdue", cancelled: "Cancelled",
};

export const PAYMENT_OPERATIONAL_STATUS_LABELS: Record<PaymentOperationalStatus, string> = {
  needs_funding: "Needs funding", partially_funded: "Partially funded", payout_setup_needed: "Payout setup needed",
  ready_to_pay: "Ready to pay", overdue: "Overdue", processing: "Processing", paid: "Paid", cancelled: "Cancelled",
};

export const VENDOR_PAYOUT_STATUS_LABELS: Record<VendorPayoutStatus, string> = {
  missing: "Not configured", pending: "Pending", verified: "Verified",
};

export type EventPayment = { expense: Expense; payment: ExpensePayment };
export type PaymentFilter = "all" | "attention" | "ready" | "upcoming" | "paid";

function localDateValue(date = new Date()): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function getPaymentStatus(payment: ExpensePayment, today = new Date()): ExpensePaymentStatus {
  if (payment.cancelledAt) return "cancelled";
  if (payment.paidAmount >= payment.amount) return "paid";
  if (payment.dueDate && payment.dueDate < localDateValue(today)) return "overdue";
  if (payment.fundedAmount >= payment.amount) return "funded";
  if (payment.fundedAmount > 0) return "partially_funded";
  return "unfunded";
}

export function getVendorPayoutStatus(expense: Expense): VendorPayoutStatus {
  return expense.vendorPayoutStatus ?? "missing";
}

export function getEventPayments(records: ExpenseRecord[]): EventPayment[] {
  return records.flatMap((record) => record.payments.map((payment) => ({ expense: record.expense, payment })))
    .sort((a, b) => {
      if (!a.payment.dueDate && !b.payment.dueDate) return a.payment.createdAt.localeCompare(b.payment.createdAt);
      if (!a.payment.dueDate) return 1;
      if (!b.payment.dueDate) return -1;
      return a.payment.dueDate.localeCompare(b.payment.dueDate);
    });
}

export function getPaymentOperationalStatus(item: EventPayment, today = new Date()): PaymentOperationalStatus {
  const { expense, payment } = item;
  if (expense.cancelledAt || payment.cancelledAt) return "cancelled";
  if (payment.paidAmount >= payment.amount) return "paid";
  if (payment.processingStartedAt) return "processing";
  if (getPaymentStatus(payment, today) === "overdue") return "overdue";
  if (payment.fundedAmount >= payment.amount) return getVendorPayoutStatus(expense) === "verified" ? "ready_to_pay" : "payout_setup_needed";
  if (payment.fundedAmount > 0) return "partially_funded";
  return "needs_funding";
}

export type PaymentReadinessContext = { agreement?: PaymentAgreement; invoice?: Invoice; payout?: PayoutProfile };
export function getPaymentReadiness(item: EventPayment, context: PaymentReadinessContext = {}): { ready: boolean; reasons: string[] } {
  const { expense, payment } = item;
  if (payment.processingStartedAt) return { ready: false, reasons: ["This payment is already being processed."] };
  return getAgreementPaymentReadiness(payment.amount, payment.fundedAmount, payment.paidAmount, Boolean(expense.cancelledAt || payment.cancelledAt), context.agreement, context.invoice, context.payout);
}

export function getExpenseFundedAmount(record: ExpenseRecord): number {
  return record.payments.filter((payment) => !payment.cancelledAt).reduce((total, payment) => total + Math.min(payment.fundedAmount, payment.amount), 0);
}

export function getExpensePaidAmount(record: ExpenseRecord): number {
  return record.payments.filter((payment) => !payment.cancelledAt).reduce((total, payment) => total + Math.min(payment.paidAmount, payment.amount), 0);
}

export function getExpenseOutstandingAmount(record: ExpenseRecord): number {
  return Math.max(record.expense.totalAmount - getExpensePaidAmount(record), 0);
}

export function getPaymentFundingGap(payment: ExpensePayment): number {
  return Math.max(payment.amount - payment.fundedAmount, 0);
}

export function getExpenseFundingGap(record: ExpenseRecord): number {
  return record.payments.filter((payment) => !payment.cancelledAt).reduce((total, payment) => total + getPaymentFundingGap(payment), 0);
}

export function getExpenseStatus(record: ExpenseRecord, today = new Date()): ExpenseStatus {
  if (record.expense.cancelledAt) return "cancelled";
  const activePayments = record.payments.filter((payment) => !payment.cancelledAt);
  if (activePayments.some((payment) => getPaymentStatus(payment, today) === "overdue")) return "overdue";
  if (activePayments.length > 0 && activePayments.every((payment) => payment.paidAmount >= payment.amount)) return "paid";
  if (getExpensePaidAmount(record) > 0) return "partially_paid";
  if (activePayments.length > 0 && activePayments.every((payment) => payment.fundedAmount >= payment.amount)) return "funded";
  if (getExpenseFundedAmount(record) > 0) return "partially_funded";
  return "unfunded";
}

export function getNextPayment(record: ExpenseRecord): ExpensePayment | null {
  const unpaid = record.payments.filter((payment) => !payment.cancelledAt && payment.paidAmount < payment.amount);
  return unpaid.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return a.createdAt.localeCompare(b.createdAt);
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  })[0] ?? null;
}

export function getUpcomingPayments(records: ExpenseRecord[], days = 30, today = new Date()): Array<{ expense: Expense; payment: ExpensePayment }> {
  const start = localDateValue(today);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);
  const end = localDateValue(endDate);
  return records.flatMap((record) => record.expense.cancelledAt ? [] : record.payments
    .filter((payment) => !payment.cancelledAt && payment.paidAmount < payment.amount && payment.dueDate && payment.dueDate >= start && payment.dueDate <= end)
    .map((payment) => ({ expense: record.expense, payment })))
    .sort((a, b) => (a.payment.dueDate ?? "").localeCompare(b.payment.dueDate ?? ""));
}

export function getOverduePayments(records: ExpenseRecord[], today = new Date()): EventPayment[] {
  return getEventPayments(records).filter((item) => getPaymentOperationalStatus(item, today) === "overdue");
}

export function getReadyToPayPayments(records: ExpenseRecord[], resolve: (expenseId: string) => PaymentReadinessContext = () => ({})): EventPayment[] {
  return getEventPayments(records).filter((item) => getPaymentReadiness(item, resolve(item.expense.id)).ready);
}

export function filterEventPayments(items: EventPayment[], filter: PaymentFilter, today = new Date(), resolve: (expenseId: string) => PaymentReadinessContext = () => ({})): EventPayment[] {
  const todayValue = localDateValue(today);
  return items.filter((item) => {
    const status = getPaymentOperationalStatus(item, today);
    if (filter === "attention") return status === "overdue" || status === "needs_funding" || status === "partially_funded" || status === "payout_setup_needed";
    if (filter === "ready") return getPaymentReadiness(item, resolve(item.expense.id)).ready;
    if (filter === "upcoming") return !item.expense.cancelledAt && !item.payment.cancelledAt && item.payment.paidAmount < item.payment.amount && Boolean(item.payment.dueDate && item.payment.dueDate >= todayValue);
    if (filter === "paid") return status === "paid";
    return true;
  });
}

export function getPaymentSummary(records: ExpenseRecord[], days = 30, today = new Date(), resolve: (expenseId: string) => PaymentReadinessContext = () => ({})) {
  const activeUnpaid = getEventPayments(records).filter(({ expense, payment }) => !expense.cancelledAt && !payment.cancelledAt && payment.paidAmount < payment.amount);
  const dueSoon = getUpcomingPayments(records, days, today).reduce((total, { payment }) => total + Math.max(payment.amount - payment.paidAmount, 0), 0);
  const readyToPay = activeUnpaid.filter((item) => getPaymentReadiness(item, resolve(item.expense.id)).ready).reduce((total, { payment }) => total + Math.max(payment.amount - payment.paidAmount, 0), 0);
  const fundingGap = activeUnpaid.reduce((total, { payment }) => total + getPaymentFundingGap(payment), 0);
  // Cancelling an expense stops future obligations, but must not erase money already released.
  const paidToDate = getEventPayments(records).filter(({ payment }) => !payment.cancelledAt).reduce((total, { payment }) => total + Math.min(payment.paidAmount, payment.amount), 0);
  return { dueSoon, readyToPay, fundingGap, paidToDate };
}

export function getPaymentDueLabel(dueDate: string | undefined, today = new Date()): { date: string; relative: string } {
  if (!dueDate) return { date: "No due date", relative: "Not included in upcoming totals" };
  const target = new Date(`${dueDate}T00:00:00Z`);
  const current = new Date(`${localDateValue(today)}T00:00:00Z`);
  const days = Math.round((target.getTime() - current.getTime()) / 86_400_000);
  const date = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(target);
  if (days === 0) return { date, relative: "Due today" };
  if (days === 1) return { date, relative: "Due tomorrow" };
  if (days === -1) return { date, relative: "Overdue by 1 day" };
  if (days < -1) return { date, relative: `Overdue by ${Math.abs(days)} days` };
  return { date, relative: days <= 30 ? `Due in ${days} days` : "Scheduled" };
}

export function getExpenseSummary(records: ExpenseRecord[], days = 30, today = new Date()) {
  const active = records.filter((record) => !record.expense.cancelledAt);
  const totalCommitted = active.reduce((total, record) => total + record.expense.totalAmount, 0);
  const funded = active.reduce((total, record) => total + getExpenseFundedAmount(record), 0);
  const dueSoon = getUpcomingPayments(active, days, today).reduce((total, item) => total + Math.max(item.payment.amount - item.payment.paidAmount, 0), 0);
  return { totalCommitted, funded, dueSoon, unfunded: Math.max(totalCommitted - funded, 0) };
}
