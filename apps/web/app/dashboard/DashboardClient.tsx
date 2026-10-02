"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppTopbar from "../components/AppTopbar";
import { financialApi, migrateLegacyFinancialData } from "../../lib/financial-api";
import { listAgreements } from "../../lib/agreement-api";
import type { PactEvent, PactUser } from "../../lib/pact-types";
import { usePactAuth } from "../components/PactAuthProvider";

function formatDate(date: string): string {
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00Z` : date);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parsed);
}

export default function DashboardClient() {
  const router = useRouter();
  const { ready: authReady, user: authenticatedUser } = usePactAuth();
  const [user, setUser] = useState<PactUser | null>(null);
  const [events, setEvents] = useState<PactEvent[]>([]);
  const [pendingAgreements, setPendingAgreements] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authReady) return;
    if (!authenticatedUser) {
      router.replace("/auth");
      return;
    }
    let live=true;migrateLegacyFinancialData().then(()=>Promise.all([financialApi.listEvents(),listAgreements().catch(()=>[])])).then(([ownerEvents,agreements])=>{if(!live)return;if(ownerEvents.length===0){router.replace("/events/new");return;}setUser(authenticatedUser);setEvents(ownerEvents);setPendingAgreements(agreements.filter(item=>item.status==="awaiting_acceptance").length);setLoading(false);}).catch(()=>{if(live)setLoading(false);});return()=>{live=false};
  }, [authReady, authenticatedUser?.id, router]);

  return <main className="app-standalone"><AppTopbar userName={user?.name} compact /><div className="dashboard-shell">
    {pendingAgreements > 0 && <Link className="app-banner app-banner-info dashboard-agreement-banner" href="/agreements"><strong>{pendingAgreements} {pendingAgreements === 1 ? "agreement" : "agreements"} waiting for review</strong><ArrowRight aria-hidden="true" /></Link>}
    <header className="dashboard-heading"><div><p className="app-eyebrow">Organizer workspace</p><h1>Your events</h1><p>Open a Pact to review its financial position and next obligations.</p></div><Link className="app-secondary-button" href="/events/new"><Plus aria-hidden="true" /> New Pact</Link></header>
    {loading ? <div className="event-list-skeleton" aria-label="Loading your events"><span /><span /></div> : <section className="event-list" aria-label="Your events">{events.map((event) => <Link href={`/events/${event.id}`} key={event.id} className="event-list-row"><span className="event-list-icon"><CalendarDays aria-hidden="true" /></span><span><strong>{event.name}</strong><small>{formatDate(event.date)} · {event.displayCurrency}</small></span><span className="event-list-status"><i /> Active</span><ArrowRight aria-hidden="true" /></Link>)}</section>}
  </div></main>;
}
