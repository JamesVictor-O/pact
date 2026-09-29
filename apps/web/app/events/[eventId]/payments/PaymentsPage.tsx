"use client";

import Link from "next/link";
import { ArrowRight, ReceiptText } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { filterEventPayments, getEventPayments, getPaymentDueLabel, getPaymentFundingGap, getPaymentOperationalStatus, getPaymentSummary, PAYMENT_OPERATIONAL_STATUS_LABELS, type PaymentFilter } from "../../../../lib/expenses";
import { formatEventCurrency } from "../../../../lib/funding";
import { expenseRepository } from "../../../../lib/pact-storage";
import type { ExpenseRecord } from "../../../../lib/pact-types";
import { useCurrentEvent } from "../EventShell";

const filters: Array<{ value: PaymentFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "attention", label: "Needs attention" },
  { value: "ready", label: "Ready to pay" },
  { value: "upcoming", label: "Upcoming" },
  { value: "paid", label: "Paid" },
];

function isPaymentFilter(value: string | null): value is PaymentFilter {
  return filters.some((filter) => filter.value === value);
}

export default function PaymentsPage() {
  const event = useCurrentEvent();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter");
  const activeFilter = isPaymentFilter(filterParam) ? filterParam : "all";
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const loadPayments = useCallback(() => {
    try { setRecords(expenseRepository.listByEvent(event.id)); setStatus("ready"); }
    catch { setStatus("error"); }
  }, [event.id]);

  useEffect(() => loadPayments(), [loadPayments]);

  if (status === "loading") return <div className="funding-page funding-loading" aria-label="Loading payments"><span /><span /><span /></div>;
  if (status === "error") return <section className="funding-error" role="alert"><h1>We couldn’t load payments.</h1><p>Your payment schedules are still safe. Try loading the queue again.</p><button className="app-secondary-button" type="button" onClick={loadPayments}>Try again</button></section>;

  const allPayments = getEventPayments(records);
  const visiblePayments = filterEventPayments(allPayments, activeFilter);
  const summary = getPaymentSummary(records);
  const metrics = [
    { label: "Due next 30 days", value: summary.dueSoon, note: "Unpaid scheduled payments" },
    { label: "Ready to pay", value: summary.readyToPay, note: "Funded and payout-ready" },
    { label: "Funding gap", value: summary.fundingGap, note: "Coverage still needed" },
    { label: "Paid to date", value: summary.paidToDate, note: "Released to vendors" },
  ];

  return <div className="payments-page">
    <header className="funding-header"><div><p className="app-eyebrow">Event finances</p><h1>Payments</h1><p>Track upcoming vendor payments, see what is funded, and know what is ready to pay.</p></div></header>
    <section className="funding-summary" aria-labelledby="payment-position-heading"><div className="summary-heading"><h2 id="payment-position-heading">Payment position</h2><span>{event.displayCurrency}</span></div><div className="summary-grid">{metrics.map((metric) => <article key={metric.label}><p>{metric.label}</p><strong>{formatEventCurrency(metric.value, event.displayCurrency)}</strong><span>{metric.note}</span></article>)}</div></section>
    <section className="funding-sources-section payment-queue-section" aria-labelledby="payment-queue-heading">
      <header><div><h2 id="payment-queue-heading">Payment queue</h2><p>Scheduled payments from your event expenses appear here automatically.</p></div><span>{allPayments.length} {allPayments.length === 1 ? "payment" : "payments"}</span></header>
      {allPayments.length === 0 ? <div className="funding-empty"><span><ReceiptText aria-hidden="true" /></span><h3>No scheduled payments yet</h3><p>Payments appear here when you add an expense and define how it will be paid.</p><Link className="app-primary-button" href={`/events/${event.id}/expenses/new`}>Add expense <ArrowRight aria-hidden="true" /></Link></div> : <>
        <nav className="payment-filters" aria-label="Filter payments">{filters.map((filter) => <Link key={filter.value} className={activeFilter === filter.value ? "active" : ""} aria-current={activeFilter === filter.value ? "page" : undefined} href={filter.value === "all" ? `/events/${event.id}/payments` : `/events/${event.id}/payments?filter=${filter.value}`}>{filter.label}</Link>)}</nav>
        {visiblePayments.length === 0 ? <div className="payment-filter-empty"><h3>No payments match this view</h3><p>Try another filter to see the rest of the payment queue.</p><Link className="app-secondary-button" href={`/events/${event.id}/payments`}>View all payments</Link></div> : <div className="funding-table-wrap"><div className="payment-table" aria-label="Payment queue">
          <div className="payment-table-head" aria-hidden="true"><span>Payment</span><span>Expense</span><span>Vendor</span><span>Amount</span><span>Due</span><span>Funding</span><span>Status</span><span /></div>
          {visiblePayments.map((item) => { const { expense, payment } = item; const operationalStatus = getPaymentOperationalStatus(item); const due = getPaymentDueLabel(payment.dueDate); const gap = getPaymentFundingGap(payment); return <Link className="payment-table-row" href={`/events/${event.id}/payments/${payment.id}`} key={payment.id} aria-label={`View ${payment.label}, ${PAYMENT_OPERATIONAL_STATUS_LABELS[operationalStatus]}`}>
            <span className="funding-source-name"><strong>{payment.label}</strong>{gap > 0 && <small>{formatEventCurrency(gap, event.displayCurrency)} gap</small>}</span><span data-label="Expense">{expense.title}</span><span data-label="Vendor">{expense.vendorName}</span><span data-label="Amount">{formatEventCurrency(payment.amount, event.displayCurrency)}</span><span className="payment-due" data-label="Due"><strong>{due.date}</strong><small>{due.relative}</small></span><span data-label="Funding">{formatEventCurrency(payment.fundedAmount, event.displayCurrency)} / {formatEventCurrency(payment.amount, event.displayCurrency)}</span><span data-label="Status"><i className={`funding-status payment-status-${operationalStatus}`}>{PAYMENT_OPERATIONAL_STATUS_LABELS[operationalStatus]}</i></span><ArrowRight aria-hidden="true" />
          </Link>; })}
        </div></div>}
      </>}
    </section>
  </div>;
}
