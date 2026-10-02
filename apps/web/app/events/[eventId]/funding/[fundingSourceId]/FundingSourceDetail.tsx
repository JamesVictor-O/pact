"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Ban, Check, Copy, LoaderCircle, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { formatEventCurrency, formatFundingDate, FUNDING_STATUS_LABELS, FUNDING_TYPE_LABELS, getFundingSourceStatus } from "../../../../../lib/funding";
import { financialApi } from "../../../../../lib/financial-api";
import type { Allocation, ExpenseRecord, FundingRequest, FundingSource } from "../../../../../lib/pact-types";
import { useCurrentEvent } from "../../EventShell";

export default function FundingSourceDetail({ sourceId }: { sourceId: string }) {
  const event = useCurrentEvent();
  const [source, setSource] = useState<FundingSource | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [actionError, setActionError] = useState("");
  const [requests,setRequests]=useState<FundingRequest[]>([]);const [creatingRequest,setCreatingRequest]=useState(false);const [copiedRequest,setCopiedRequest]=useState("");
  const [records,setRecords]=useState<ExpenseRecord[]>([]);const [allocations,setAllocations]=useState<Allocation[]>([]);const [paymentId,setPaymentId]=useState("");const [amount,setAmount]=useState("");const [allocating,setAllocating]=useState(false);const [reversing,setReversing]=useState("");

  const load=useCallback(async()=>{try{const [stored,expenses,nextAllocations,nextRequests]=await Promise.all([financialApi.getFunding(sourceId),financialApi.listExpenses(event.id),financialApi.sourceAllocations(sourceId),financialApi.fundingRequests(sourceId)]);if(stored.eventId!==event.id){setStatus("missing");return;}setSource(stored);setRecords(expenses);setAllocations(nextAllocations);setRequests(nextRequests);setStatus("ready");}catch{setStatus("error");}},[event.id,sourceId]);
  useEffect(()=>{void load()},[load]);

  async function cancelSource() {
    try {
      const updated = await financialApi.cancelFunding(sourceId);
      if (!updated) throw new Error("Funding source not found");
      setSource(updated);
      setConfirmingCancel(false);
    } catch {
      setActionError("We couldn’t cancel this funding source. Please try again.");
    }
  }
  async function allocate(e:FormEvent){e.preventDefault();const value=Number(amount.replace(/,/g,""));if(!paymentId||!Number.isFinite(value)||value<=0){setActionError("Choose a payment and enter an amount greater than zero.");return;}setAllocating(true);setActionError("");try{await financialApi.allocate(sourceId,paymentId,value);setAmount("");setPaymentId("");await load();}catch(error){setActionError(error instanceof Error?error.message:"We couldn’t save this allocation. Please try again.");}finally{setAllocating(false);}}
  async function reverse(id:string){setReversing(id);setActionError("");try{await financialApi.reverseAllocation(id);await load();}catch{setActionError("We couldn’t remove this allocation. Please try again.");}finally{setReversing("");}}
  async function createRequest(){setCreatingRequest(true);setActionError("");try{const request=await financialApi.createFundingRequest(sourceId);setRequests(current=>[request,...current]);}catch(error){setActionError(error instanceof Error?error.message:"We couldn’t create this funding request. Please try again.");}finally{setCreatingRequest(false);}}
  async function copyRequest(request:FundingRequest){const url=`${window.location.origin}/fund/${request.publicSlug}`;try{await navigator.clipboard.writeText(url);setCopiedRequest(request.id);window.setTimeout(()=>setCopiedRequest(""),2000);}catch{setActionError("Copy failed. Open the funding link and copy it from your browser.");}}

  if (status === "loading") return <div className="funding-detail-skeleton" aria-label="Loading funding source" />;
  if (status === "missing" || !source) return <section className="funding-error"><h1>Funding source not found</h1><p>It may have been removed or belong to another event.</p><Link className="app-secondary-button" href={`/events/${event.id}/funding`}>Back to funding</Link></section>;
  if (status === "error") return <section className="funding-error" role="alert"><h1>We couldn’t load this source.</h1><p>Return to the funding page and try again.</p><Link className="app-secondary-button" href={`/events/${event.id}/funding`}>Back to funding</Link></section>;

  const sourceStatus = getFundingSourceStatus(source);
  const stillExpected = Math.max(source.committedAmount - source.receivedAmount, 0);
  const allocated=allocations.reduce((sum,item)=>sum+item.amount,0);const unallocated = Math.max(source.receivedAmount-allocated,0);const payments=records.flatMap(record=>record.payments.map(payment=>({record,payment}))).filter(({record,payment})=>!record.expense.cancelledAt&&!payment.cancelledAt&&payment.fundedAmount<payment.amount);

  return <div className="funding-detail-page">
    <Link className="app-back-link" href={`/events/${event.id}/funding`}><ArrowLeft aria-hidden="true" /> Back to funding</Link>
    <header className="funding-detail-header"><div><p className="app-eyebrow">{FUNDING_TYPE_LABELS[source.type]}</p><h1>{source.name}</h1><span className={`funding-status funding-status-${sourceStatus}`}>{FUNDING_STATUS_LABELS[sourceStatus]}</span></div><Link className="app-secondary-button" href={`/events/${event.id}/funding/${source.id}/edit`}><Pencil aria-hidden="true" /> Edit funding source</Link></header>

    <section className="source-financial-summary" aria-labelledby="source-summary-heading"><div className="summary-heading"><h2 id="source-summary-heading">Financial summary</h2><span>{event.displayCurrency}</span></div><div className="summary-grid">
      <article><p>Committed</p><strong>{formatEventCurrency(source.committedAmount, event.displayCurrency)}</strong><span>Original commitment</span></article>
      <article><p>Received</p><strong>{formatEventCurrency(source.receivedAmount, event.displayCurrency)}</strong><span>Actually received</span></article>
      <article><p>Still expected</p><strong>{formatEventCurrency(stillExpected, event.displayCurrency)}</strong><span>Remaining commitment</span></article>
      <article><p>Expected by</p><strong className="summary-date">{formatFundingDate(source.expectedDate, true)}</strong><span>{source.expectedDate ? "Planned arrival" : "No date set"}</span></article>
    </div></section>

    <section className="source-actions funding-request-panel" aria-labelledby="funding-requests-heading"><div><p className="app-eyebrow">Sponsor collection</p><h2 id="funding-requests-heading">Funding requests</h2><p>Create a receivable invoice and shareable link. A request records what is due; only a confirmed treasury deposit will increase received funds.</p></div><button className="app-primary-button" type="button" onClick={()=>void createRequest()} disabled={creatingRequest||stillExpected<=0}>{creatingRequest?<><LoaderCircle className="button-spinner" aria-hidden="true"/> Creating…</>:<><Send aria-hidden="true"/> Create funding request</>}</button>{requests.length>0&&<div className="funding-request-list">{requests.map(request=><div key={request.id}><span><strong>{formatEventCurrency(request.amount,event.displayCurrency)}</strong><small>{request.status==="sent"?"Awaiting sponsor payment":request.status.replaceAll("_"," ")}</small></span><Link className="app-secondary-button" href={`/fund/${request.publicSlug}`} target="_blank">Open <ArrowRight aria-hidden="true"/></Link><button className="app-secondary-button" type="button" onClick={()=>void copyRequest(request)}>{copiedRequest===request.id?<Check aria-hidden="true"/>:<Copy aria-hidden="true"/>}{copiedRequest===request.id?"Copied":"Copy link"}</button></div>)}</div>}</section>

    <section className="funding-detail-grid">
      <article className="allocation-preview allocation-manager"><header><div><h2>Where this funding goes</h2><p>Assign received funds to scheduled payments.</p></div><span>{formatEventCurrency(unallocated,event.displayCurrency)} available</span></header>{allocations.length===0?<div className="allocation-empty"><span><strong>No allocations yet</strong><small>Received funds remain available until you assign them.</small></span></div>:<div className="allocation-list">{allocations.map(item=>{const target=records.flatMap(record=>record.payments.map(payment=>({record,payment}))).find(({payment})=>payment.id===item.paymentId);return <div className="allocation-row" key={item.id}><Link href={`/events/${event.id}/payments/${item.paymentId}`}><span><strong>{target?.payment.label??"Scheduled payment"}</strong><small>{target?.record.expense.title??"Expense"}</small></span><strong>{formatEventCurrency(item.amount,event.displayCurrency)}</strong><ArrowRight aria-hidden="true"/></Link><button type="button" onClick={()=>void reverse(item.id)} disabled={reversing===item.id} aria-label={`Remove allocation to ${target?.payment.label??"scheduled payment"}`}>{reversing===item.id?<LoaderCircle className="button-spinner" aria-hidden="true"/>:<Trash2 aria-hidden="true"/>}</button></div>})}</div>}<form className="allocation-form" onSubmit={allocate}><div className="form-field"><label htmlFor="allocation-payment">Payment <span>Required</span></label><select id="allocation-payment" value={paymentId} onChange={e=>setPaymentId(e.target.value)}><option value="">Select a scheduled payment</option>{payments.map(({record,payment})=><option value={payment.id} key={payment.id}>{record.expense.title} — {payment.label} ({formatEventCurrency(payment.amount-payment.fundedAmount,event.displayCurrency)} gap)</option>)}</select></div><div className="form-field"><label htmlFor="allocation-amount">Amount <span>Required</span></label><div className="currency-input"><span>{event.displayCurrency}</span><input id="allocation-amount" type="text" inputMode="decimal" autoComplete="off" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/></div></div><button className="app-primary-button" type="submit" disabled={allocating||unallocated<=0||payments.length===0}>{allocating?<><LoaderCircle className="button-spinner" aria-hidden="true"/> Allocating…</>:<><Plus aria-hidden="true"/> Allocate funds</>}</button></form></article>
      <aside className="source-details"><h2>Source details</h2><dl><div><dt>Type</dt><dd>{FUNDING_TYPE_LABELS[source.type]}</dd></div><div><dt>Expected date</dt><dd>{formatFundingDate(source.expectedDate, true)}</dd></div><div><dt>Last updated</dt><dd>{new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(source.updatedAt))}</dd></div>{source.notes && <div><dt>Notes</dt><dd>{source.notes}</dd></div>}</dl></aside>
    </section>

    <section className="source-actions" aria-labelledby="source-actions-heading"><div><h2 id="source-actions-heading">Source status</h2><p>Cancel this source if the remaining commitment is no longer expected. Funds already received remain recorded.</p></div>{sourceStatus !== "cancelled" && !confirmingCancel && <button className="destructive-text-button" type="button" onClick={() => setConfirmingCancel(true)}><Ban aria-hidden="true" /> Mark as cancelled</button>}{confirmingCancel && <div className="cancel-confirmation"><p>Stop counting this source as an active commitment?</p><div><button className="app-secondary-button" type="button" onClick={() => setConfirmingCancel(false)}>Keep active</button><button className="destructive-button" type="button" onClick={cancelSource}>Mark as cancelled</button></div></div>}{sourceStatus === "cancelled" && <span className="cancelled-note">This source is cancelled.</span>}{actionError && <p className="field-error" role="alert">{actionError}</p>}</section>
  </div>;
}
