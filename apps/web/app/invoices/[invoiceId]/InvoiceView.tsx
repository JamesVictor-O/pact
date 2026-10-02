"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { getInvoice } from "../../../lib/agreement-api";
import type { Invoice } from "../../../lib/pact-types";
import { usePactAuth } from "../../components/PactAuthProvider";

const money = (minor: number, currency: string) => new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
export default function InvoiceView({ invoiceId }: { invoiceId: string }) {
  const { ready, user } = usePactAuth(); const [invoice, setInvoice] = useState<Invoice | null>(null); const [denied, setDenied] = useState(false);
  useEffect(() => { if (!ready || !user) return;let live=true;getInvoice(invoiceId).then(value=>live&&setInvoice(value)).catch(()=>live&&setDenied(true));return()=>{live=false}; }, [ready, user?.id, invoiceId]);
  if (denied) return <main className="invoice-page"><section className="funding-error"><h1>Invoice unavailable</h1><p>This invoice is only available to the people named on its agreement.</p></section></main>;
  if (!invoice) return <main className="invoice-page"><div className="funding-detail-skeleton" aria-label="Loading invoice" /></main>;
  return <main className="invoice-page"><div className="invoice-actions"><Link className="app-back-link" href={invoice.agreementId ? `/agreements/${invoice.agreementId}` : "/dashboard"}><ArrowLeft aria-hidden="true" /> Back</Link><button className="app-secondary-button" type="button" onClick={() => window.print()}><Printer aria-hidden="true" /> Print or save PDF</button></div><article className="invoice-document"><header><span>PACT</span><div><p>Invoice</p><strong>{invoice.invoiceNumber}</strong></div></header><div className="invoice-parties"><section><p>From</p><strong>{invoice.snapshot.issuerName}</strong><span>{invoice.snapshot.issuerEmail}</span></section><section><p>To</p><strong>{invoice.snapshot.recipientName}</strong><span>{invoice.snapshot.recipientEmail}</span></section></div><section className="invoice-description"><p>For</p><strong>{invoice.snapshot.description}</strong>{invoice.snapshot.agreementReference && <span>Agreement {invoice.snapshot.agreementReference}</span>}</section><div className="invoice-lines"><div><span>Description</span><span>Due</span><span>Amount</span></div>{invoice.snapshot.schedule.map((item) => <div key={item.paymentId}><strong>{item.label}</strong><span>{item.dueDate ?? "No due date"}</span><strong>{money(item.amountMinor, invoice.currency)}</strong></div>)}</div><footer><span>This is a Pact-generated payment-request document. Tax requirements may vary by jurisdiction.</span><strong>Total {money(invoice.amountMinor, invoice.currency)}</strong></footer></article></main>;
}
