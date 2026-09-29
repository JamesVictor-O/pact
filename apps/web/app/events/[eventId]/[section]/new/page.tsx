import { notFound } from "next/navigation";
import ComingNext from "../../ComingNext";

export default async function NewFinancialItemPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section !== "funding" && section !== "expenses") notFound();
  return <ComingNext section={section} action />;
}
