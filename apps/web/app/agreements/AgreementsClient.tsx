"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileCheck2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { listAgreements } from "../../lib/agreement-api";
import { formatMinorCurrency } from "../../lib/funding";
import type { PaymentAgreement } from "../../lib/pact-types";
import { usePactAuth } from "../components/PactAuthProvider";

export default function AgreementsClient() {
  const router = useRouter(); const { ready, user } = usePactAuth();
  const [agreements, setAgreements] = useState<PaymentAgreement[]>([]); const [loaded, setLoaded] = useState(false);
  const [error,setError]=useState("");
  useEffect(() => { if (!ready) return; if (!user) { router.replace("/auth?intent=payee"); return; } let live=true;listAgreements().then(items=>{if(live){setAgreements(items);setLoaded(true);}}).catch(()=>{if(live){setError("We couldn’t load your agreements. Try again.");setLoaded(true);}});return()=>{live=false}; }, [ready, user?.id, router]);
  if (!loaded) return <main className="agreement-shell"><div className="funding-detail-skeleton" aria-label="Loading agreements" /></main>;
  const groups = [{ title: "Needs your review", items: agreements.filter((item) => item.status === "awaiting_acceptance") },{title:"Finalizing",items:agreements.filter(item=>item.status==="acceptance_signed"||item.status==="registration_pending")}, { title: "Active", items: agreements.filter((item) => item.status === "active") }, { title: "Completed", items: agreements.filter((item) => item.status === "completed") }];
  return <main className="agreement-shell"><header className="agreement-topbar"><Link href="/dashboard"><Image src="/pact-primary-logo.svg" alt="Pact" width={104} height={32} /></Link><span>{user?.email}</span></header><div className="agreement-content"><p className="app-eyebrow">Your work with Pact</p><h1>Payment agreements</h1><p className="agreement-lede">Review payment terms and keep your payout details ready.</p>{error?<section className="funding-error" role="alert"><h2>Agreements unavailable</h2><p>{error}</p><button className="app-secondary-button" type="button" onClick={()=>location.reload()}>Try again</button></section>:agreements.length === 0 ? <section className="agreement-empty"><FileCheck2 aria-hidden="true" /><h2>No agreements yet</h2><p>Agreements connected to your verified email will appear here automatically.</p></section> : groups.filter((group) => group.items.length).map((group) => <section className="agreement-group" key={group.title}><h2>{group.title}</h2>{group.items.map((agreement) => <Link className="agreement-row" href={`/agreements/${agreement.id}`} key={agreement.id}><span><strong>{agreement.snapshot.eventName}</strong><small>{agreement.snapshot.title} · {agreement.snapshot.paymentSchedule.length} scheduled payments</small></span><span><strong>{formatMinorCurrency(agreement.totalAmountMinor, agreement.currency)}</strong><small>{agreement.status === "awaiting_acceptance" ? "Review agreement":agreement.status==="active"?"Active":"Finalizing agreement"}</small></span><ArrowRight aria-hidden="true" /></Link>)}</section>)}</div></main>;
}
