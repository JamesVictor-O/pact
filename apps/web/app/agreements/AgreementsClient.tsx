"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileCheck2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { agreementRepository } from "../../lib/pact-storage";
import type { PaymentAgreement } from "../../lib/pact-types";
import { usePactAuth } from "../components/PactAuthProvider";

export default function AgreementsClient() {
  const router = useRouter(); const { ready, user } = usePactAuth();
  const [agreements, setAgreements] = useState<PaymentAgreement[]>([]); const [loaded, setLoaded] = useState(false);
  useEffect(() => { if (!ready) return; if (!user) { router.replace("/auth"); return; } setAgreements(agreementRepository.listForEmail(user.email)); setLoaded(true); }, [ready, user, router]);
  if (!loaded) return <main className="agreement-shell"><div className="funding-detail-skeleton" aria-label="Loading agreements" /></main>;
  const groups = [{ title: "Needs your review", items: agreements.filter((item) => item.status === "awaiting_acceptance") }, { title: "Active", items: agreements.filter((item) => item.status === "active") }, { title: "Completed", items: agreements.filter((item) => item.status === "completed") }];
  return <main className="agreement-shell"><header className="agreement-topbar"><Link href="/dashboard"><Image src="/pact-primary-logo.svg" alt="Pact" width={104} height={32} /></Link><span>{user?.email}</span></header><div className="agreement-content"><p className="app-eyebrow">Your work with Pact</p><h1>Payment agreements</h1><p className="agreement-lede">Review payment terms and keep your payout details ready.</p>{agreements.length === 0 ? <section className="agreement-empty"><FileCheck2 aria-hidden="true" /><h2>No agreements yet</h2><p>Agreements connected to your verified email will appear here automatically.</p></section> : groups.filter((group) => group.items.length).map((group) => <section className="agreement-group" key={group.title}><h2>{group.title}</h2>{group.items.map((agreement) => <Link className="agreement-row" href={`/agreements/${agreement.id}`} key={agreement.id}><span><strong>{agreement.snapshot.eventName}</strong><small>{agreement.snapshot.title} · {agreement.snapshot.paymentSchedule.length} scheduled payments</small></span><span><strong>{new Intl.NumberFormat("en", { style: "currency", currency: agreement.currency, maximumFractionDigits: 0 }).format(agreement.totalAmountMinor / 100)}</strong><small>{agreement.status === "awaiting_acceptance" ? "Review agreement" : "View agreement"}</small></span><ArrowRight aria-hidden="true" /></Link>)}</section>)}</div></main>;
}
