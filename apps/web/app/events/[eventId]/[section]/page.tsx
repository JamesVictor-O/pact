import { notFound } from "next/navigation";
import ComingNext from "../ComingNext";

const sections = ["funding", "expenses", "payments", "people", "activity"] as const;

export default async function EventSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section as (typeof sections)[number])) notFound();
  return <ComingNext section={section as (typeof sections)[number]} />;
}
