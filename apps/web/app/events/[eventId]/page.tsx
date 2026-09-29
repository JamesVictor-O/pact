import type { Metadata } from "next";
import EventOverview from "./EventOverview";

export const metadata: Metadata = { title: "Event overview" };

export default function EventOverviewPage() {
  return <EventOverview />;
}
