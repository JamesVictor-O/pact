import FundingSourceDetail from "./FundingSourceDetail";

export default async function FundingSourcePage({ params }: { params: Promise<{ fundingSourceId: string }> }) {
  const { fundingSourceId } = await params;
  return <FundingSourceDetail sourceId={fundingSourceId} />;
}
