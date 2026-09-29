import FundingSourceForm from "../../FundingSourceForm";

export default async function EditFundingSourcePage({ params }: { params: Promise<{ fundingSourceId: string }> }) {
  const { fundingSourceId } = await params;
  return <FundingSourceForm sourceId={fundingSourceId} />;
}
