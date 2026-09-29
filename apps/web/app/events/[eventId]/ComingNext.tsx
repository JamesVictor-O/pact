"use client";

import Link from "next/link";
import { ArrowLeft, Clock3 } from "lucide-react";
import { useCurrentEvent } from "./EventShell";

const content = {
  funding: { title: "Funding is coming next", body: "This will be where you add expected sources, record sponsor commitments, and see what has actually arrived." },
  expenses: { title: "Expenses are coming next", body: "This will be where you add vendor obligations, milestone amounts, and payment due dates." },
  payments: { title: "Payments are coming next", body: "Payment schedules and release controls will live here after funding and expenses are in place." },
  people: { title: "People are coming next", body: "Organizer, sponsor, and vendor access will be managed here in a later phase." },
  activity: { title: "Activity is coming next", body: "A clear record of financial changes will appear here as your Pact starts moving." },
} as const;

export default function ComingNext({ section, action = false }: { section: keyof typeof content; action?: boolean }) {
  const event = useCurrentEvent();
  const item = content[section];
  return <section className="coming-next"><span className="coming-next-icon"><Clock3 aria-hidden="true" /></span><p className="app-eyebrow">{action ? "Next phase" : section}</p><h1>{action ? `${section === "funding" ? "Add funding" : "Add expense"} is coming next` : item.title}</h1><p>{item.body}</p><Link href={`/events/${event.id}`} className="app-secondary-button"><ArrowLeft aria-hidden="true" /> Back to overview</Link></section>;
}
