"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDollarSign, Plus, UserRound, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAgreement, listAgreements, type AgreementBundle } from "../../../../lib/agreement-api";
import { getPayeeEmail, getPayeeName } from "../../../../lib/agreements";
import { formatEventCurrency, FUNDING_STATUS_LABELS, FUNDING_TYPE_LABELS, getFundingSourceStatus } from "../../../../lib/funding";
import { financialApi } from "../../../../lib/financial-api";
import type { ExpenseRecord, FundingSource, PaymentAgreement } from "../../../../lib/pact-types";
import { useCurrentEvent } from "../EventShell";

type PersonAgreementState = "not_created" | "awaiting" | "finalizing" | "active" | "completed" | "declined" | "cancelled";
type Person = {
  email: string;
  name: string;
  initials: string;
  records: ExpenseRecord[];
  agreements: PaymentAgreement[];
  bundles: AgreementBundle[];
  totalCommitted: number;
  paid: number;
  agreementState: PersonAgreementState;
  payoutReady: boolean;
};

const supporterTypes = new Set<FundingSource["type"]>(["sponsor", "donor", "partner", "grant", "other"]);

const agreementLabels: Record<PersonAgreementState, string> = {
  not_created: "Agreement not created",
  awaiting: "Awaiting acceptance",
  finalizing: "Finalizing agreement",
  active: "Active",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0]![0]}${parts.at(-1)![0]}` : parts[0]?.slice(0, 2) || "P").toUpperCase();
}

function agreementState(agreements: PaymentAgreement[]): PersonAgreementState {
  if (!agreements.length) return "not_created";
  if (agreements.some((agreement) => ["acceptance_signed", "registration_pending"].includes(agreement.status))) return "finalizing";
  if (agreements.some((agreement) => agreement.status === "awaiting_acceptance" || agreement.status === "draft")) return "awaiting";
  if (agreements.some((agreement) => agreement.status === "active")) return "active";
  if (agreements.every((agreement) => agreement.status === "completed")) return "completed";
  if (agreements.some((agreement) => agreement.status === "declined")) return "declined";
  return "cancelled";
}

function buildPeople(records: ExpenseRecord[], agreements: PaymentAgreement[], bundles: AgreementBundle[]) {
  const groups = new Map<string, { records: ExpenseRecord[]; agreements: PaymentAgreement[]; bundles: AgreementBundle[] }>();
  for (const record of records) {
    const email = getPayeeEmail(record.expense).trim().toLowerCase();
    if (!email) continue;
    const group = groups.get(email) ?? { records: [], agreements: [], bundles: [] };
    group.records.push(record);
    groups.set(email, group);
  }
  for (const agreement of agreements) {
    const email = agreement.payeeEmail.trim().toLowerCase();
    const group = groups.get(email) ?? { records: [], agreements: [], bundles: [] };
    group.agreements.push(agreement);
    groups.set(email, group);
  }
  for (const bundle of bundles) {
    const email = bundle.agreement.payeeEmail.trim().toLowerCase();
    const group = groups.get(email) ?? { records: [], agreements: [], bundles: [] };
    group.bundles.push(bundle);
    groups.set(email, group);
  }

  return [...groups.entries()].map<Person>(([email, group]) => {
    const name = group.records[0] ? getPayeeName(group.records[0].expense) : group.agreements[0]?.snapshot.payeeName ?? email;
    return {
      email,
      name,
      initials: initials(name),
      records: group.records,
      agreements: group.agreements,
      bundles: group.bundles,
      totalCommitted: group.records.reduce((sum, record) => sum + (record.expense.cancelledAt ? 0 : record.expense.totalAmount), 0),
      paid: group.records.reduce((sum, record) => sum + record.payments.reduce((paymentSum, payment) => paymentSum + payment.paidAmount, 0), 0),
      agreementState: agreementState(group.agreements),
      payoutReady: group.bundles.some((bundle) => bundle.payout?.verificationStatus === "verified"),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export default function PeoplePage() {
  const event = useCurrentEvent();
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [sources, setSources] = useState<FundingSource[]>([]);
  const [agreements, setAgreements] = useState<PaymentAgreement[]>([]);
  const [bundles, setBundles] = useState<AgreementBundle[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const loadPeople = useCallback(async () => {
    setStatus("loading");
    try {
      const [expenseRecords, fundingSources, accessibleAgreements] = await Promise.all([financialApi.listExpenses(event.id), financialApi.listFunding(event.id), listAgreements()]);
      const eventAgreements = accessibleAgreements.filter((agreement) => agreement.eventId === event.id);
      const bundleResults = await Promise.allSettled(eventAgreements.map((agreement) => getAgreement(agreement.id)));
      setRecords(expenseRecords);
      setSources(fundingSources);
      setAgreements(eventAgreements);
      setBundles(bundleResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [event.id]);

  useEffect(() => { void loadPeople(); }, [loadPeople]);
  const people = useMemo(() => buildPeople(records, agreements, bundles), [records, agreements, bundles]);
  const supporters = useMemo(() => sources.filter((source) => supporterTypes.has(source.type)), [sources]);

  if (status === "loading") return <div className="people-page people-loading" aria-label="Loading people"><span /><span /><span /></div>;
  if (status === "error") return <section className="funding-error" role="alert"><h1>We couldn’t load people.</h1><p>Your event records are still safe. Try loading this page again.</p><button className="app-secondary-button" type="button" onClick={() => void loadPeople()}>Try again</button></section>;

  const activeAgreements = agreements.filter((agreement) => agreement.status === "active").length;
  const awaitingAcceptance = agreements.filter((agreement) => ["draft", "awaiting_acceptance", "acceptance_signed", "registration_pending"].includes(agreement.status)).length;
  const payoutSetupNeeded = people.filter((person) => person.agreements.some((agreement) => agreement.status === "active") && !person.payoutReady).length;
  const metrics = [
    { label: "Supporters", value: supporters.length, note: "Sponsors, donors, and partners" },
    { label: "Payees", value: people.length, note: "People and companies to pay" },
    { label: "Active agreements", value: activeAgreements, note: "Accepted and finalized" },
    { label: "Needs attention", value: awaitingAcceptance + payoutSetupNeeded, note: "Acceptance or payout setup" },
  ];

  return <div className="people-page">
    <header className="funding-header"><div><p className="app-eyebrow">Event relationships</p><h1>People</h1><p>See who supports this event, who needs to be paid, and what each relationship needs next.</p></div><div className="people-header-actions"><Link className="app-secondary-button" href={`/events/${event.id}/expenses/new`}><UserRound aria-hidden="true" /> Add payee</Link><Link className="app-primary-button" href={`/events/${event.id}/funding/new`}><Plus aria-hidden="true" /> Add supporter</Link></div></header>

    <section className="people-summary" aria-labelledby="people-summary-heading"><div className="summary-heading"><h2 id="people-summary-heading">Relationship overview</h2><span>Live</span></div><div className="summary-grid">{metrics.map((metric) => <article key={metric.label}><p>{metric.label}</p><strong>{metric.value}</strong><span>{metric.note}</span></article>)}</div></section>

    <section className="people-directory" aria-labelledby="supporters-heading"><header><div><p className="app-eyebrow">Money in</p><h2 id="supporters-heading">Supporters</h2><p>Sponsors, donors, partners, and funders helping make this event possible.</p></div><span>{supporters.length} {supporters.length === 1 ? "supporter" : "supporters"}</span></header>
      {supporters.length === 0 ? <div className="people-section-empty"><span><CircleDollarSign aria-hidden="true" /></span><div><h3>No supporters yet</h3><p>Add a sponsor, donor, partner, or grant to start tracking incoming commitments.</p></div><Link className="app-secondary-button" href={`/events/${event.id}/funding/new`}>Add supporter <ArrowRight aria-hidden="true" /></Link></div> : <div className="supporter-list">
        {supporters.map((source) => { const sourceStatus = getFundingSourceStatus(source); return <Link className="supporter-row" href={`/events/${event.id}/funding/${source.id}`} key={source.id} aria-label={`View ${source.name}, ${FUNDING_STATUS_LABELS[sourceStatus]}`}>
          <span className="supporter-icon" aria-hidden="true"><CircleDollarSign /></span><span className="supporter-name"><strong>{source.name}</strong><small>{FUNDING_TYPE_LABELS[source.type]}</small></span><span data-label="Committed"><small>Committed</small><strong>{formatEventCurrency(source.committedAmount, event.displayCurrency)}</strong></span><span data-label="Received"><small>Received</small><strong>{formatEventCurrency(source.receivedAmount, event.displayCurrency)}</strong></span><i className={`funding-status funding-status-${sourceStatus}`}>{FUNDING_STATUS_LABELS[sourceStatus]}</i><ArrowRight aria-hidden="true" />
        </Link>; })}
      </div>}
    </section>

    <section className="people-directory people-payees" aria-labelledby="people-directory-heading"><header><div><p className="app-eyebrow">Money out</p><h2 id="people-directory-heading">Payees</h2><p>One view per person, even when they have several expenses.</p></div><span>{people.length} {people.length === 1 ? "payee" : "payees"}</span></header>
      {people.length === 0 ? <div className="funding-empty"><span><UsersRound aria-hidden="true" /></span><h3>No payees yet</h3><p>Payees appear here when you add the first expense and payment schedule for this event.</p><Link className="app-primary-button" href={`/events/${event.id}/expenses/new`}>Add your first payee <ArrowRight aria-hidden="true" /></Link></div> : <div className="people-list">
        {people.map((person) => {
          const active = person.agreements.some((agreement) => agreement.status === "active");
          const href = person.records[0] ? `/events/${event.id}/expenses/${person.records[0].expense.id}` : `/events/${event.id}/expenses`;
          return <article className="people-row" key={person.email}>
            <span className="people-avatar" aria-hidden="true">{person.initials}</span>
            <div className="people-identity"><strong>{person.name}</strong><small>{person.email}</small></div>
            <div className="people-cell" data-label="Work"><strong>{person.records.length} {person.records.length === 1 ? "expense" : "expenses"}</strong><small>{formatEventCurrency(person.totalCommitted, event.displayCurrency)} committed</small></div>
            <div className="people-cell" data-label="Agreement"><span className={`people-state people-state-${person.agreementState}`}>{agreementLabels[person.agreementState]}</span>{person.agreements.length > 1 && <small>{person.agreements.length} agreements</small>}</div>
            <div className="people-cell" data-label="Payout"><strong className={person.payoutReady ? "people-ready" : ""}>{person.payoutReady ? <><CheckCircle2 aria-hidden="true" /> Ready</> : active ? "Setup needed" : "Not ready"}</strong><small>{formatEventCurrency(person.paid, event.displayCurrency)} paid</small></div>
            <Link className="people-open" href={href} aria-label={`View ${person.name}`}><UserRound aria-hidden="true" /><span>View</span><ArrowRight aria-hidden="true" /></Link>
          </article>;
        })}
      </div>}
    </section>
  </div>;
}
