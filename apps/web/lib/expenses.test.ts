import assert from "node:assert/strict";
import test from "node:test";
import { filterEventPayments, getEventPayments, getExpenseStatus, getExpenseSummary, getNextPayment, getOverdueFundingShortfall, getPaymentDueLabel, getPaymentFundingGap, getPaymentOperationalStatus, getPaymentReadiness, getPaymentStatus, getPaymentSummary } from "./expenses.ts";
import type { ExpensePayment, ExpenseRecord } from "./pact-types.ts";

function payment(overrides: Partial<ExpensePayment> = {}): ExpensePayment {
  return { id: "payment_1", expenseId: "expense_1", label: "Deposit", amount: 3_000, dueDate: "2026-10-05", fundedAmount: 0, paidAmount: 0, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", ...overrides };
}

function record(payments: ExpensePayment[], overrides: Partial<ExpenseRecord["expense"]> = {}): ExpenseRecord {
  return { expense: { id: "expense_1", eventId: "event_1", title: "Production", category: "production", vendorName: "Pixel Production", totalAmount: payments.reduce((sum, item) => sum + item.amount, 0), createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", ...overrides }, payments };
}

test("payment and expense statuses respect overdue, paid, and cancellation precedence", () => {
  const today = new Date("2026-10-10T12:00:00Z");
  assert.equal(getPaymentStatus(payment(), today), "overdue");
  assert.equal(getPaymentStatus(payment({ paidAmount: 3_000 }), today), "paid");
  assert.equal(getExpenseStatus(record([payment({ fundedAmount: 1_000 })]), today), "overdue");
  assert.equal(getExpenseStatus(record([payment({ paidAmount: 3_000 })]), today), "paid");
  assert.equal(getExpenseStatus(record([payment()], { cancelledAt: "2026-10-01T00:00:00.000Z" }), today), "cancelled");
});

test("expense summary derives commitments, funded, due soon, and unfunded from payments", () => {
  const today = new Date("2026-09-29T12:00:00Z");
  const first = record([payment({ amount: 3_000, fundedAmount: 3_000 }), payment({ id: "payment_2", label: "Final payment", amount: 5_000, dueDate: "2026-10-20" })]);
  const summary = getExpenseSummary([first], 30, today);
  assert.deepEqual(summary, { totalCommitted: 8_000, funded: 3_000, dueSoon: 8_000, unfunded: 5_000 });
});

test("next payment and funding gaps are derived per schedule item", () => {
  const later = payment({ id: "later", label: "Final", amount: 5_000, dueDate: "2026-10-20", fundedAmount: 1_000 });
  const earlier = payment({ id: "earlier", dueDate: "2026-10-05", fundedAmount: 3_000 });
  assert.equal(getNextPayment(record([later, earlier]))?.id, "earlier");
  assert.equal(getPaymentFundingGap(later), 4_000);
});

test("overdue shortfall preserves secured funds and reports only blocked payments", () => {
  const result = getOverdueFundingShortfall(record([
    payment({ amount: 50, fundedAmount: 0.03, dueDate: "2026-10-07" }),
    payment({ id: "payment_2", amount: 50, fundedAmount: 0, dueDate: "2026-10-08" }),
    payment({ id: "payment_3", amount: 25, fundedAmount: 25, paidAmount: 25, dueDate: "2026-10-01" }),
  ]), new Date("2026-10-09T12:00:00Z"));
  assert.deepEqual(result, { paymentCount: 2, secured: 0.03, gap: 99.97 });
});

test("operational status keeps overdue separate from funding and payout readiness", () => {
  const today = new Date("2026-10-10T12:00:00Z");
  const overdue = { expense: record([]).expense, payment: payment({ fundedAmount: 3_000 }) };
  assert.equal(getPaymentOperationalStatus(overdue, today), "overdue");
  assert.equal(getPaymentReadiness(overdue).ready, false);
  const verified = { ...overdue, expense: { ...overdue.expense, vendorPayoutStatus: "verified" as const } };
  const context = { agreement: { status: "active" }, invoice: { status: "confirmed" }, payout: { verificationStatus: "verified" } } as any;
  assert.equal(getPaymentReadiness(verified, context).ready, true);
  assert.equal(getPaymentOperationalStatus(verified, today), "overdue");
});

test("payment position uses active schedules as its single source", () => {
  const today = new Date("2026-09-29T12:00:00Z");
  const active = record([
    payment({ fundedAmount: 3_000 }),
    payment({ id: "payment_2", amount: 2_000, dueDate: undefined, fundedAmount: 500, paidAmount: 250 }),
  ], { vendorPayoutStatus: "verified" });
  const context = { agreement: { status: "active" }, invoice: { status: "confirmed" }, payout: { verificationStatus: "verified" } } as any;
  const summary = getPaymentSummary([active], 30, today, () => context);
  assert.deepEqual(summary, { dueSoon: 3_000, readyToPay: 3_000, fundingGap: 1_500, paidToDate: 250 });
  const cancelledAfterPayment = record([payment({ paidAmount: 1_000 })], { cancelledAt: "2026-09-20T00:00:00.000Z" });
  assert.equal(getPaymentSummary([cancelledAfterPayment], 30, today).paidToDate, 1_000);
});

test("payment filters and due labels handle attention, upcoming, and undated states", () => {
  const today = new Date("2026-09-29T12:00:00Z");
  const items = getEventPayments([record([
    payment({ dueDate: "2026-09-27" }),
    payment({ id: "payment_2", dueDate: "2026-09-30", fundedAmount: 3_000, paidAmount: 3_000 }),
    payment({ id: "payment_3", dueDate: undefined }),
  ])]);
  assert.equal(filterEventPayments(items, "attention", today).length, 2);
  assert.equal(filterEventPayments(items, "upcoming", today).length, 0);
  assert.equal(filterEventPayments(items, "paid", today).length, 1);
  assert.deepEqual(getPaymentDueLabel("2026-09-27", today), { date: "Sep 27", relative: "Overdue by 2 days" });
  assert.deepEqual(getPaymentDueLabel(undefined, today), { date: "No due date", relative: "Not included in upcoming totals" });
});
