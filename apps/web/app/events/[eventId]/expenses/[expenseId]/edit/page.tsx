import ExpenseForm from "../../ExpenseForm";
export default async function EditExpensePage({ params }: { params: Promise<{ expenseId: string }> }) { const { expenseId } = await params; return <ExpenseForm expenseId={expenseId} />; }
