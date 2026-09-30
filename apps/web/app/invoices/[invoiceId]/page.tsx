import InvoiceView from "./InvoiceView";
export default async function InvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) { const { invoiceId } = await params; return <InvoiceView invoiceId={invoiceId} />; }
