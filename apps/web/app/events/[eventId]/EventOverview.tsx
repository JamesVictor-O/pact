"use client";

import Link from "next/link";
import { ArrowRight, Check, CircleDollarSign, ReceiptText } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCurrentEvent } from "./EventShell";

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export default function EventOverview() {
  const event = useCurrentEvent();
  const searchParams = useSearchParams();
  const justCreated = searchParams.get("created") === "1";
  const zero = formatCurrency(0, event.displayCurrency);
  const summary = [
    { label: "Estimated budget", value: formatCurrency(event.estimatedBudget, event.displayCurrency), note: "Working plan" },
    { label: "Funding received", value: zero, note: "No funding added" },
    { label: "Committed to vendors", value: zero, note: "No expenses added" },
    { label: "Available", value: zero, note: "Received minus allocated" },
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

    <section className="upcoming-empty" aria-labelledby="upcoming-heading"><div><h2 id="upcoming-heading">Upcoming payments</h2><p>Vendor payment schedules will appear here once you add an expense.</p></div><span>Nothing due yet</span></section>
  </div>;
}
