"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CircleAlert, CircleDollarSign, FileCheck2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { getPaymentDueLabel, getPaymentFundingGap, getPaymentOperationalStatus, getPaymentReadiness, getVendorPayoutStatus, PAYMENT_OPERATIONAL_STATUS_LABELS, VENDOR_PAYOUT_STATUS_LABELS } from "../../../../../lib/expenses";
import { getPayeeEmail, getPayeeName } from "../../../../../lib/agreements";
import { formatEventCurrency } from "../../../../../lib/funding";
import { financialApi } from "../../../../../lib/financial-api";
import { getAgreementByExpense,type AgreementBundle } from "../../../../../lib/agreement-api";
import type { Allocation, ExpensePayment, ExpenseRecord, FundingSource } from "../../../../../lib/pact-types";
import { useCurrentEvent } from "../../EventShell";

export default function PaymentDetail({ paymentId }: { paymentId: string }) {
  const event = useCurrentEvent();
  const [record, setRecord] = useState<ExpenseRecord | null>(null);
  const [payment, setPayment] = useState<ExpensePayment | null>(null);
  const [bundle,setBundle]=useState<AgreementBundle|null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [allocations,setAllocations]=useState<Allocation[]>([]);const [sources,setSources]=useState<FundingSource[]>([]);

  useEffect(() => {
    let live=true;(async()=>{try {
      const stored = await financialApi.getPayment(paymentId);
      const storedPayment = stored?.payments.find((item) => item.id === paymentId) ?? null;
      if (!stored || !storedPayment || stored.expense.eventId !== event.id) { setStatus("missing"); return; }
      const [nextAllocations,nextSources]=await Promise.all([financialApi.paymentAllocations(paymentId),financialApi.listFunding(event.id)]);if(!live)return;setRecord(stored); setPayment(storedPayment);setAllocations(nextAllocations);setSources(nextSources);getAgreementByExpense(stored.expense.id).then(setBundle).catch(()=>setBundle(null)); setStatus("ready");
    } catch { if(live)setStatus("error"); }})();return()=>{live=false};
  }, [event.id, paymentId]);

  if (status === "loading") return <div className="funding-detail-skeleton" aria-label="Loading payment" />;
  if (status === "missing" || !record || !payment) return <section className="funding-error"><h1>Payment not found</h1><p>It may belong to another event or its expense schedule may have changed.</p><Link className="app-secondary-button" href={`/events/${event.id}/payments`}>Back to payments</Link></section>;
  if (status === "error") return <section className="funding-error" role="alert"><h1>We couldn’t load this payment.</h1><p>Return to the payment queue and try again.</p><Link className="app-secondary-button" href={`/events/${event.id}/payments`}>Back to payments</Link></section>;

  const item = { expense: record.expense, payment };
  const operationalStatus = getPaymentOperationalStatus(item);
  const agreement=bundle?.agreement;const invoice=bundle?.invoice??undefined;const payout=bundle?.payout??undefined;
  const readiness = getPaymentReadiness(item, { agreement, invoice, payout });
  const due = getPaymentDueLabel(payment.dueDate);
  const gap = getPaymentFundingGap(payment);
  const payoutStatus = payout?.verificationStatus??getVendorPayoutStatus(record.expense);
  const readinessReasons = readiness.reasons.map((reason) => reason.replace(/^([\d.]+)/, (amount) => formatEventCurrency(Number(amount), event.displayCurrency)));

  return <div className="payment-detail-page">
    <Link className="app-back-link" href={`/events/${event.id}/payments`}><ArrowLeft aria-hidden="true" /> Back to payments</Link>
    <header className="funding-detail-header"><div><p className="app-eyebrow">{record.expense.title} · {getPayeeName(record.expense)}</p><h1>{payment.label}</h1><span className={`funding-status payment-status-${operationalStatus}`}>{PAYMENT_OPERATIONAL_STATUS_LABELS[operationalStatus]}</span></div></header>
    <section className="source-financial-summary" aria-labelledby="payment-financial-heading"><div className="summary-heading"><h2 id="payment-financial-heading">Payment summary</h2><span>{event.displayCurrency}</span></div><div className="payment-summary-grid"><article><p>Amount</p><strong>{formatEventCurrency(payment.amount, event.displayCurrency)}</strong></article><article><p>Funded</p><strong>{formatEventCurrency(payment.fundedAmount, event.displayCurrency)}</strong></article><article><p>Funding gap</p><strong>{formatEventCurrency(gap, event.displayCurrency)}</strong></article><article><p>Paid</p><strong>{formatEventCurrency(payment.paidAmount, event.displayCurrency)}</strong></article><article><p>Due</p><strong>{due.date}</strong><span>{due.relative}</span></article></div></section>
    <section className={`payment-readiness ${readiness.ready ? "is-ready" : "needs-work"}`} aria-labelledby="payment-readiness-heading"><span className="payment-readiness-icon">{readiness.ready ? <Check aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}</span><div><p className="app-eyebrow">Payment readiness</p><h2 id="payment-readiness-heading">{readiness.ready ? "Ready for authorization" : "Not ready to pay"}</h2>{readiness.ready ? <p>The agreement is active, the invoice and payout destination are confirmed, and this payment is fully funded. The organizer can authorize its release once treasury execution is enabled.</p> : <ul>{readinessReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}</div></section>
    <section className="payment-value-flow" aria-labelledby="payment-value-flow-heading"><header><p className="app-eyebrow">Movement of value</p><h2 id="payment-value-flow-heading">From sponsor funding to this payee</h2></header><ol><li className={payment.fundedAmount>0?"complete":"current"}><CircleDollarSign aria-hidden="true"/><span><strong>Funds reach event treasury</strong><small>Only confirmed deposits count as received.</small></span></li><li className={payment.fundedAmount>=payment.amount?"complete":payment.fundedAmount>0?"current":""}><FileCheck2 aria-hidden="true"/><span><strong>Funds are allocated here</strong><small>{formatEventCurrency(payment.fundedAmount,event.displayCurrency)} of {formatEventCurrency(payment.amount,event.displayCurrency)} reserved.</small></span></li><li className={payment.paidAmount>=payment.amount?"complete":readiness.ready?"current":""}><Send aria-hidden="true"/><span><strong>Organizer authorizes release</strong><small>The treasury transfers only to the verified payout destination.</small></span></li></ol></section>
    <div className="payment-detail-grid">
      <article className="allocation-preview payment-funding-panel"><header><div><h2>Where this funding comes from</h2><p>Received money assigned to this scheduled payment.</p></div><span>{allocations.length} {allocations.length===1?"source":"sources"}</span></header><div><span><small>Funded</small><strong>{formatEventCurrency(payment.fundedAmount, event.displayCurrency)} / {formatEventCurrency(payment.amount, event.displayCurrency)}</strong></span><span><small>Funding gap</small><strong>{formatEventCurrency(gap, event.displayCurrency)}</strong></span></div>{allocations.length===0?<p className="payment-allocation-note">No funds allocated to this payment yet.</p>:<div className="payment-allocation-sources">{allocations.map(item=>{const source=sources.find(candidate=>candidate.id===item.fundingSourceId);return <Link key={item.id} href={`/events/${event.id}/funding/${item.fundingSourceId}`}><span><strong>{source?.name??"Funding source"}</strong><small>Received funds</small></span><strong>{formatEventCurrency(item.amount,event.displayCurrency)}</strong><ArrowRight aria-hidden="true"/></Link>})}</div>}</article>
      <aside className="source-details"><h2>Payee readiness</h2><dl><div><dt>Payee</dt><dd>{getPayeeName(record.expense)}</dd></div><div><dt>Email</dt><dd>{getPayeeEmail(record.expense)||"Not provided"}</dd></div><div><dt>Payout setup</dt><dd>{VENDOR_PAYOUT_STATUS_LABELS[payoutStatus]}</dd></div>{payout?.payoutAddress&&<div className="payout-address-row"><dt>Verified payout address</dt><dd><code>{payout.payoutAddress}</code></dd></div>}</dl></aside>
    </div>
    <section className="source-actions payment-source-expense"><div><h2>Source expense</h2><p>This payment comes from the expense schedule and updates whenever that schedule changes.</p></div><Link className="app-secondary-button" href={`/events/${event.id}/expenses/${record.expense.id}`}>View {record.expense.title} <ArrowRight aria-hidden="true" /></Link></section>
  </div>;
}
