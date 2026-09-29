"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { getPaymentDueLabel, getPaymentFundingGap, getPaymentOperationalStatus, getPaymentReadiness, getVendorPayoutStatus, PAYMENT_OPERATIONAL_STATUS_LABELS, VENDOR_PAYOUT_STATUS_LABELS } from "../../../../../lib/expenses";
import { formatEventCurrency } from "../../../../../lib/funding";
import { expenseRepository } from "../../../../../lib/pact-storage";
import type { ExpensePayment, ExpenseRecord } from "../../../../../lib/pact-types";
import { useCurrentEvent } from "../../EventShell";

export default function PaymentDetail({ paymentId }: { paymentId: string }) {
  const event = useCurrentEvent();
  const [record, setRecord] = useState<ExpenseRecord | null>(null);
  const [payment, setPayment] = useState<ExpensePayment | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");

  useEffect(() => {
    try {
      const stored = expenseRepository.findPaymentById(paymentId);
      const storedPayment = stored?.payments.find((item) => item.id === paymentId) ?? null;
      if (!stored || !storedPayment || stored.expense.eventId !== event.id) { setStatus("missing"); return; }
      setRecord(stored); setPayment(storedPayment); setStatus("ready");
    } catch { setStatus("error"); }
  }, [event.id, paymentId]);

  if (status === "loading") return <div className="funding-detail-skeleton" aria-label="Loading payment" />;
  if (status === "missing" || !record || !payment) return <section className="funding-error"><h1>Payment not found</h1><p>It may belong to another event or its expense schedule may have changed.</p><Link className="app-secondary-button" href={`/events/${event.id}/payments`}>Back to payments</Link></section>;
  if (status === "error") return <section className="funding-error" role="alert"><h1>We couldn’t load this payment.</h1><p>Return to the payment queue and try again.</p><Link className="app-secondary-button" href={`/events/${event.id}/payments`}>Back to payments</Link></section>;

  const item = { expense: record.expense, payment };
  const operationalStatus = getPaymentOperationalStatus(item);
  const readiness = getPaymentReadiness(item);
  const due = getPaymentDueLabel(payment.dueDate);
  const gap = getPaymentFundingGap(payment);
  const payoutStatus = getVendorPayoutStatus(record.expense);
  const readinessReasons = readiness.reasons.map((reason) => reason.replace(/^([\d.]+)/, (amount) => formatEventCurrency(Number(amount), event.displayCurrency)));

  return <div className="payment-detail-page">
    <Link className="app-back-link" href={`/events/${event.id}/payments`}><ArrowLeft aria-hidden="true" /> Back to payments</Link>
    <header className="funding-detail-header"><div><p className="app-eyebrow">{record.expense.title} · {record.expense.vendorName}</p><h1>{payment.label}</h1><span className={`funding-status payment-status-${operationalStatus}`}>{PAYMENT_OPERATIONAL_STATUS_LABELS[operationalStatus]}</span></div></header>
    <section className="source-financial-summary" aria-labelledby="payment-financial-heading"><div className="summary-heading"><h2 id="payment-financial-heading">Payment summary</h2><span>{event.displayCurrency}</span></div><div className="payment-summary-grid"><article><p>Amount</p><strong>{formatEventCurrency(payment.amount, event.displayCurrency)}</strong></article><article><p>Funded</p><strong>{formatEventCurrency(payment.fundedAmount, event.displayCurrency)}</strong></article><article><p>Funding gap</p><strong>{formatEventCurrency(gap, event.displayCurrency)}</strong></article><article><p>Paid</p><strong>{formatEventCurrency(payment.paidAmount, event.displayCurrency)}</strong></article><article><p>Due</p><strong>{due.date}</strong><span>{due.relative}</span></article></div></section>
    <section className={`payment-readiness ${readiness.ready ? "is-ready" : "needs-work"}`} aria-labelledby="payment-readiness-heading"><span className="payment-readiness-icon">{readiness.ready ? <Check aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}</span><div><p className="app-eyebrow">Payment readiness</p><h2 id="payment-readiness-heading">{readiness.ready ? "Ready to pay" : "Not ready to pay"}</h2>{readiness.ready ? <p>This payment is fully funded and the vendor payout destination is verified.</p> : <ul>{readinessReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}</div></section>
    <div className="payment-detail-grid">
      <article className="allocation-preview payment-funding-panel"><header><div><h2>Funding</h2><p>Coverage assigned to this scheduled payment.</p></div><span>Planning view</span></header><div><span><small>Funded</small><strong>{formatEventCurrency(payment.fundedAmount, event.displayCurrency)} / {formatEventCurrency(payment.amount, event.displayCurrency)}</strong></span><span><small>Funding gap</small><strong>{formatEventCurrency(gap, event.displayCurrency)}</strong></span></div>{payment.fundedAmount <= 0 && <p className="payment-allocation-note">No funds allocated to this payment yet.</p>}</article>
      <aside className="source-details"><h2>Vendor readiness</h2><dl><div><dt>Vendor</dt><dd>{record.expense.vendorName}</dd></div><div><dt>Email</dt><dd>{record.expense.vendorEmail ?? "Not provided"}</dd></div><div><dt>Payout setup</dt><dd>{VENDOR_PAYOUT_STATUS_LABELS[payoutStatus]}</dd></div></dl></aside>
    </div>
    <section className="source-actions payment-source-expense"><div><h2>Source expense</h2><p>This payment comes from the expense schedule and updates whenever that schedule changes.</p></div><Link className="app-secondary-button" href={`/events/${event.id}/expenses/${record.expense.id}`}>View {record.expense.title} <ArrowRight aria-hidden="true" /></Link></section>
  </div>;
}
