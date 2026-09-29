import PaymentDetail from "./PaymentDetail";

export default async function PaymentDetailPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  return <PaymentDetail paymentId={paymentId} />;
}
