import AgreementReview from "./AgreementReview";
export default async function AgreementPage({ params }: { params: Promise<{ agreementId: string }> }) { const { agreementId } = await params; return <AgreementReview agreementId={agreementId} />; }
