"use client";

import Link from "next/link";
import { ArrowRight, Check, Plus, ReceiptText } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EXPENSE_STATUS_LABELS, getExpenseFundedAmount, getExpenseStatus, getExpenseSummary, getNextPayment } from "../../../../lib/expenses";
import { getPayeeName } from "../../../../lib/agreements";
import { formatEventCurrency, formatFundingDate } from "../../../../lib/funding";
import { financialApi } from "../../../../lib/financial-api";
import type { ExpenseRecord } from "../../../../lib/pact-types";
import { useCurrentEvent } from "../EventShell";

export default function ExpensesPage() {
  const event = useCurrentEvent();
  const searchParams = useSearchParams();
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const loadExpenses = useCallback(async () => {
    try { setRecords(await financialApi.listExpenses(event.id)); setStatus("ready"); }
    catch { setStatus("error"); }
  }, [event.id]);
  useEffect(() => {void loadExpenses()}, [loadExpenses]);

  if (status === "loading") return <div className="funding-page funding-loading" aria-label="Loading expenses"><span /><span /><span /></div>;
  if (status === "error") return <section className="funding-error" role="alert"><h1>We couldn’t load expenses.</h1><p>Your event is still safe. Try loading the expenses again.</p><button className="app-secondary-button" type="button" onClick={()=>void loadExpenses()}>Try again</button></section>;

  const summary = getExpenseSummary(records);
  const metrics = [
    { label: "Total committed", value: summary.totalCommitted, note: "Across active expenses" },
    { label: "Funded", value: summary.funded, note: "Allocated to payments" },
    { label: "Due next 30 days", value: summary.dueSoon, note: "Unpaid scheduled payments" },
    { label: "Unfunded", value: summary.unfunded, note: "Commitments without coverage" },
  ];

  return <div className="expenses-page">
    {(searchParams.get("added") === "1" || searchParams.get("updated") === "1") && <div className="app-banner app-banner-success" role="status"><Check aria-hidden="true" /><span><strong>Expense {searchParams.get("updated") === "1" ? "updated" : "added"}.</strong> The event’s obligations now reflect the latest schedule.</span></div>}
    <header className="funding-header"><div><p className="app-eyebrow">Event finances</p><h1>Expenses</h1><p>Track what this event has committed to pay, who needs to be paid, and whether upcoming payments are covered.</p></div><Link className="app-primary-button" href={`/events/${event.id}/expenses/new`}><Plus aria-hidden="true" /> Add expense</Link></header>
    <section className="funding-summary" aria-labelledby="expense-summary-heading"><div className="summary-heading"><h2 id="expense-summary-heading">Expense position</h2><span>{event.displayCurrency}</span></div><div className="summary-grid">{metrics.map((metric) => <article key={metric.label}><p>{metric.label}</p><strong>{formatEventCurrency(metric.value, event.displayCurrency)}</strong><span>{metric.note}</span></article>)}</div></section>
    <section className="funding-sources-section" aria-labelledby="expenses-heading"><header><div><h2 id="expenses-heading">Expenses</h2><p>Every payee commitment and payment schedule for this event.</p></div><span>{records.length} {records.length === 1 ? "expense" : "expenses"}</span></header>
      {records.length === 0 ? <div className="funding-empty"><span><ReceiptText aria-hidden="true" /></span><h3>No expenses yet</h3><p>Add venues, production, catering, contractors, and other costs so Pact can track what your event needs to pay.</p><Link className="app-primary-button" href={`/events/${event.id}/expenses/new`}>Add expense <ArrowRight aria-hidden="true" /></Link></div> : <div className="funding-table-wrap"><div className="expense-table" aria-label="Expenses">
        <div className="expense-table-head" aria-hidden="true"><span>Expense</span><span>Payee</span><span>Total</span><span>Next payment</span><span>Funded</span><span>Status</span><span /></div>
        {records.map((record) => { const expenseStatus = getExpenseStatus(record); const next = getNextPayment(record); return <Link className="expense-table-row" href={`/events/${event.id}/expenses/${record.expense.id}`} key={record.expense.id} aria-label={`View ${record.expense.title}, ${EXPENSE_STATUS_LABELS[expenseStatus]}`}>
          <span className="funding-source-name"><strong>{record.expense.title}</strong><small>{record.payments.length} {record.payments.length === 1 ? "payment" : "payments"}</small></span><span data-label="Payee">{getPayeeName(record.expense)}</span><span data-label="Total">{formatEventCurrency(record.expense.totalAmount, event.displayCurrency)}</span><span data-label="Next payment">{next ? `${formatEventCurrency(next.amount, event.displayCurrency)} · ${formatFundingDate(next.dueDate)}` : "—"}</span><span data-label="Funded">{formatEventCurrency(getExpenseFundedAmount(record), event.displayCurrency)}</span><span data-label="Status"><i className={`funding-status expense-status-${expenseStatus}`}>{EXPENSE_STATUS_LABELS[expenseStatus]}</i></span><ArrowRight aria-hidden="true" />
        </Link>; })}
      </div></div>}
    </section>
  </div>;
}
