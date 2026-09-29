import type { Metadata } from "next";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = { title: "Your events" };

export default function DashboardPage() {
  return <DashboardClient />;
}
