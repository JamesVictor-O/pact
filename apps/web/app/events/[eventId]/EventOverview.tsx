"use client";

import Link from "next/link";
import { ArrowRight, Check, CircleDollarSign, ReceiptText } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getExpenseSummary, getUpcomingPayments } from "../../../lib/expenses";
import { formatEventCurrency, getFundingSummary, type FundingSummary } from "../../../lib/funding";
import { expenseRepository, fundingRepository } from "../../../lib/pact-storage";
import type { ExpenseRecord } from "../../../lib/pact-types";
import { useCurrentEvent } from "./EventShell";

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export default function EventOverview() {
  const event = useCurrentEvent();
  const searchParams = useSearchParams();
  const justCreated = searchParams.get("created") === "1";
  const [funding, setFunding] = useState<FundingSummary>(() => getFundingSummary([]));
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);

  useEffect(() => {
    setFunding(getFundingSummary(fundingRepository.listByEvent(event.id)));
    setExpenses(expenseRepository.listByEvent(event.id));
  }, [event.id]);

  const expenseSummary = getExpenseSummary(expenses);
  const upcomingPayments = getUpcomingPayments(expenses).slice(0, 3);
  const summary = [
    { label: "Estimated budget", value: formatEventCurrency(event.estimatedBudget, event.displayCurrency), note: "Working plan" },
    { label: "Funding received", value: formatEventCurrency(funding.received, event.displayCurrency), note: funding.received > 0 ? `${formatEventCurrency(funding.stillExpected, event.displayCurrency)} still expected` : "No funding received" },
    { label: "Committed to vendors", value: formatEventCurrency(expenseSummary.totalCommitted, event.displayCurrency), note: expenseSummary.totalCommitted > 0 ? `${formatEventCurrency(expenseSummary.unfunded, event.displayCurrency)} unfunded` : "No expenses added" },
    { label: "Available", value: formatEventCurrency(funding.available, event.displayCurrency), note: "Received minus allocated" },
  ];

  return <div className="overview-page">
    {justCreated && <div className="app-banner app-banner-success" role="status"><Check aria-hidden="true" /><span><strong>Your Pact is ready.</strong> Start by adding where money will come from or what the event needs to pay.</span></div>}
    <header className="overview-header"><div><p className="app-eyebrow">Event overview</p><h1>{event.name}</h1><p>{formatDate(event.date)}{event.eventType ? ` · ${event.eventType}` : ""}</p></div><span className="status-pill"><i /> Active</span></header>

    <section className="financial-summary" aria-labelledby="financial-summary-heading">
      <div className="summary-heading"><h2 id="financial-summary-heading">Financial position</h2><span>{event.displayCurrency}</span></div>
      <div className="summary-grid">{summary.map((item) => <article key={item.label}><p>{item.label}</p><strong>{item.value}</strong><span>{item.note}</span></article>)}</div>
    </section>

    <section className="first-run" aria-labelledby="first-run-heading">
      <div className="first-run-copy"><p className="app-eyebrow">Your first financial actions</p><h2 id="first-run-heading">Start building your event finances</h2><p>Track where your money is coming from and what your event needs to pay.</p></div>
      <div className="first-action-grid">
        <Link href={`/events/${event.id}/funding/new`} className="first-action first-action-primary"><span><CircleDollarSign aria-hidden="true" /></span><div><strong>Add funding</strong><p>Add a sponsor commitment or another expected source.</p></div><ArrowRight aria-hidden="true" /></Link>
        <Link href={`/events/${event.id}/expenses/new`} className="first-action"><span><ReceiptText aria-hidden="true" /></span><div><strong>Add expense</strong><p>Record a vendor cost, amount, and due date.</p></div><ArrowRight aria-hidden="true" /></Link>
      </div>
    </section>

    {upcomingPayments.length === 0 ? <section className="upcoming-empty" aria-labelledby="upcoming-heading"><div><h2 id="upcoming-heading">Upcoming payments</h2><p>Payments due in the next 30 days will appear here.</p></div><span>Nothing due soon</span></section> : <section className="overview-upcoming" aria-labelledby="upcoming-heading"><header><div><h2 id="upcoming-heading">Upcoming payments</h2><p>Unpaid schedule items due in the next 30 days.</p></div><Link href={`/events/${event.id}/payments?filter=upcoming`}>View payments <ArrowRight aria-hidden="true" /></Link></header><div>{upcomingPayments.map(({ expense, payment }) => <Link key={payment.id} href={`/events/${event.id}/payments/${payment.id}`}><span><strong>{payment.label}</strong><small>{expense.title} · {expense.vendorName}</small></span><span><strong>{formatEventCurrency(payment.amount - payment.paidAmount, event.displayCurrency)}</strong><small>{formatDate(payment.dueDate as string)}</small></span></Link>)}</div></section>}
  </div>;
}
