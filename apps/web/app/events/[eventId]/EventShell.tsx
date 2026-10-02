"use client";

import Image from "next/image";
import Link from "next/link";
import { Activity, Banknote, ChevronDown, CircleDollarSign, LayoutDashboard, LogOut, ReceiptText, UsersRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { financialApi, migrateLegacyFinancialData } from "../../../lib/financial-api";
import type { PactEvent, PactUser } from "../../../lib/pact-types";
import { usePactAuth } from "../../components/PactAuthProvider";

const EventContext = createContext<PactEvent | null>(null);

export function useCurrentEvent(): PactEvent {
  const event = useContext(EventContext);
  if (!event) throw new Error("useCurrentEvent must be used within EventShell");
  return event;
}

const navItems = [
  { label: "Overview", segment: "", icon: LayoutDashboard },
  { label: "Funding", segment: "funding", icon: CircleDollarSign },
  { label: "Expenses", segment: "expenses", icon: ReceiptText },
  { label: "Payments", segment: "payments", icon: Banknote },
  { label: "People", segment: "people", icon: UsersRound },
  { label: "Activity", segment: "activity", icon: Activity },
] as const;

export default function EventShell({ eventId, children }: { eventId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready: authReady, user: authenticatedUser, signOut: endSession } = usePactAuth();
  const [event, setEvent] = useState<PactEvent | null>(null);
  const [user, setUser] = useState<PactUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    if (!authReady) return;
    if (!authenticatedUser) {
      router.replace("/auth");
      return;
    }
    let live=true;setUser(authenticatedUser);migrateLegacyFinancialData().then(()=>financialApi.getEvent(eventId)).then(storedEvent=>{if(!live)return;setEvent(storedEvent);setStatus("ready");}).catch(()=>live&&setStatus("missing"));return()=>{live=false};
  }, [authReady, authenticatedUser?.id, eventId, router]);

  async function signOut() {
    await endSession();
    router.replace("/auth");
  }

  if (status === "loading") return <main className="shell-loading" aria-label="Loading event workspace"><span /><span /><span /></main>;
  if (status === "missing" || !event) return <main className="missing-event"><Image src="/pact-icon.svg" alt="" width={54} height={60} /><h1>We couldn’t find this Pact.</h1><p>It may belong to another organizer or no longer be available.</p><Link className="app-primary-button" href="/dashboard">Back to your events</Link></main>;

  const basePath = `/events/${event.id}`;

  return <EventContext.Provider value={event}>
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link className="app-wordmark" href="/dashboard" aria-label="Pact dashboard"><Image src="/pact-primary-logo.svg" alt="Pact" width={112} height={34} priority /></Link>
        <Link className="event-switcher" href="/dashboard"><span><small>Active event</small><strong>{event.name}</strong></span><ChevronDown aria-hidden="true" /></Link>
        <nav className="app-nav" aria-label="Event navigation">{navItems.map((item) => {
          const Icon = item.icon;
          const href = item.segment ? `${basePath}/${item.segment}` : basePath;
          const active = item.segment ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
          return <Link key={item.label} href={href} aria-current={active ? "page" : undefined} className={active ? "active" : ""}><Icon aria-hidden="true" />{item.label}</Link>;
        })}</nav>
        <div className="sidebar-account"><span className="account-avatar" aria-hidden="true">{user?.name.charAt(0).toUpperCase()}</span><span><strong>{user?.name}</strong><small>{user?.email}</small></span><button type="button" onClick={signOut} aria-label="Sign out"><LogOut aria-hidden="true" /></button></div>
      </aside>
      <div className="app-main-column">
        <header className="mobile-app-header"><Link className="app-wordmark" href="/dashboard"><Image src="/pact-primary-logo.svg" alt="Pact" width={96} height={29} /></Link><strong>{event.name}</strong></header>
        <nav className="mobile-app-nav" aria-label="Event navigation">{navItems.map((item) => {
          const href = item.segment ? `${basePath}/${item.segment}` : basePath;
          const active = item.segment ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
          return <Link key={item.label} href={href} aria-current={active ? "page" : undefined} className={active ? "active" : ""}>{item.label}</Link>;
        })}</nav>
        <main className="app-content">{children}</main>
      </div>
    </div>
  </EventContext.Provider>;
}
