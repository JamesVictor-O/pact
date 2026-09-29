import ExpenseDetail from "./ExpenseDetail";
export default async function ExpenseDetailPage({ params }: { params: Promise<{ expenseId: string }> }) { const { expenseId } = await params; return <ExpenseDetail expenseId={expenseId} />; }
