"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, LoaderCircle, LockKeyhole, Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EXPENSE_CATEGORY_LABELS } from "../../../../lib/expenses";
import { getPayeeEmail, getPayeeName } from "../../../../lib/agreements";
import { createAgreementForExpense, getAgreementByExpense, submitProposal } from "../../../../lib/agreement-api";
import { pactAccountAdapter } from "../../../../lib/pact-account-adapter";
import { financialApi } from "../../../../lib/financial-api";
import { formatEventCurrency } from "../../../../lib/funding";
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpensePaymentInput, type ExpenseRecord } from "../../../../lib/pact-types";
import { useCurrentEvent } from "../EventShell";
import { usePactAuth } from "../../../components/PactAuthProvider";

type ScheduleType = "single" | "deposit" | "custom";
type PaymentValue = { key: string; id?: string; label: string; amount: string; dueDate: string; fundedAmount: number; paidAmount: number };
type FormValues = { title: string; payeeName: string; payeeEmail: string; category: ExpenseCategory | ""; totalAmount: string; scheduleType: ScheduleType; payments: PaymentValue[] };
type FieldErrors = Partial<Record<"title" | "payeeName" | "payeeEmail" | "category" | "totalAmount" | "schedule", string>>;

function key() { return `row_${Math.random().toString(36).slice(2)}`; }
function parseAmount(value: string) { return Number(value.replace(/,/g, "").trim()); }
function amountString(value: number) { return value > 0 ? String(value) : ""; }
function newPayment(label = "Payment", amount = ""): PaymentValue { return { key: key(), label, amount, dueDate: "", fundedAmount: 0, paidAmount: 0 }; }
const emptyValues: FormValues = { title: "", payeeName: "", payeeEmail: "", category: "", totalAmount: "", scheduleType: "single", payments: [newPayment()] };

function inferSchedule(record: ExpenseRecord): ScheduleType {
  if (record.payments.length === 1) return "single";
  if (record.payments.length === 2 && record.payments[0]?.label === "Deposit" && record.payments[1]?.label === "Final balance") return "deposit";
  return "custom";
}

function fromRecord(record: ExpenseRecord): FormValues {
  return { title: record.expense.title, payeeName: getPayeeName(record.expense), payeeEmail: getPayeeEmail(record.expense), category: record.expense.category, totalAmount: String(record.expense.totalAmount), scheduleType: inferSchedule(record), payments: record.payments.map((payment) => ({ key: key(), id: payment.id, label: payment.label, amount: String(payment.amount), dueDate: payment.dueDate ?? "", fundedAmount: payment.fundedAmount, paidAmount: payment.paidAmount })) };
}

function validate(values: FormValues, currency = "USD"): FieldErrors {
  const errors: FieldErrors = {};
  const total = parseAmount(values.totalAmount);
  if (!values.title.trim()) errors.title = "Enter what the event is paying for.";
  if (!values.payeeName.trim()) errors.payeeName = "Enter who the event is paying.";
  if (!/^\S+@\S+\.\S+$/.test(values.payeeEmail.trim())) errors.payeeEmail = "Enter the payee’s verified email address.";
  if (!values.category) errors.category = "Choose an expense category.";
  if (!values.totalAmount.trim() || !Number.isFinite(total) || total <= 0) errors.totalAmount = "Enter a total amount greater than zero.";
  if (values.payments.length === 0 || values.payments.some((payment) => !payment.label.trim() || !payment.amount.trim() || !Number.isFinite(parseAmount(payment.amount)) || parseAmount(payment.amount) <= 0)) errors.schedule = "Every payment needs a label and an amount greater than zero.";
  else if (values.payments.some((payment) => parseAmount(payment.amount) < Math.max(payment.fundedAmount, payment.paidAmount))) errors.schedule = "A payment amount cannot be lower than money already funded or paid.";
  else if (Number.isFinite(total)) {
    if (values.scheduleType === "deposit" && parseAmount(values.payments[0]?.amount ?? "0") >= total) {
      errors.schedule = "The deposit must be less than the expense total so a final balance remains.";
      return errors;
    }
    const scheduleTotal = values.payments.reduce((sum, payment) => sum + parseAmount(payment.amount), 0);
    const difference = Math.round((scheduleTotal - total) * 100) / 100;
    if (difference < 0) errors.schedule = `Your payment schedule is ${formatEventCurrency(Math.abs(difference), currency)} short of the expense total.`;
    if (difference > 0) errors.schedule = `Your payment schedule exceeds the expense total by ${formatEventCurrency(difference, currency)}.`;
  }
  return errors;
}

export default function ExpenseForm({ expenseId }: { expenseId?: string }) {
  const event = useCurrentEvent();
  const { user } = usePactAuth();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"loading" | "idle" | "submitting" | "missing" | "locked">(expenseId ? "loading" : "idle");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => { if (!expenseId) return;let live=true;financialApi.getExpense(expenseId).then(async record=>{if(!live)return;if(record.expense.eventId!==event.id){setStatus("missing");return;}setValues(fromRecord(record));try{const bundle=await getAgreementByExpense(expenseId);if(!live)return;const accepted=Boolean(bundle.agreement.acceptedAt)||["acceptance_signed","registration_pending","active","completed"].includes(bundle.agreement.status);setStatus(accepted?"locked":"idle");}catch(error){if(!live)return;setStatus(error instanceof Error&&error.message==="Agreement not found"?"idle":"missing");}}).catch(()=>live&&setStatus("missing"));return()=>{live=false}; }, [event.id, expenseId]);

  function setField(field: keyof Omit<FormValues, "payments" | "scheduleType">, value: string) { setValues((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined, ...(field === "totalAmount" ? { schedule: undefined } : {}) })); }
  function changeTotal(value: string) { setValues((current) => { const oldTotal = parseAmount(current.totalAmount); const nextTotal = parseAmount(value); const payments = current.payments.map((payment) => ({ ...payment })); if (current.scheduleType === "single" && payments[0] && (!payments[0].amount || parseAmount(payments[0].amount) === oldTotal)) payments[0].amount = Number.isFinite(nextTotal) ? amountString(nextTotal) : ""; if (current.scheduleType === "deposit" && payments[1]) { const deposit = parseAmount(payments[0]?.amount ?? ""); payments[1].amount = Number.isFinite(nextTotal) && Number.isFinite(deposit) ? amountString(Math.max(nextTotal - deposit, 0)) : ""; } return { ...current, totalAmount: value, payments }; }); setErrors((current) => ({ ...current, totalAmount: undefined, schedule: undefined })); }
  function changeSchedule(type: ScheduleType) { const total = parseAmount(values.totalAmount); setValues((current) => ({ ...current, scheduleType: type, payments: type === "single" ? [newPayment("Payment", Number.isFinite(total) ? amountString(total) : "")] : type === "deposit" ? [newPayment("Deposit"), newPayment("Final balance", Number.isFinite(total) ? amountString(total) : "")] : [newPayment()] })); setErrors((current) => ({ ...current, schedule: undefined })); }
  function updatePayment(index: number, field: "label" | "amount" | "dueDate", value: string) { setValues((current) => { const payments = current.payments.map((payment) => ({ ...payment })); if (!payments[index]) return current; payments[index][field] = value; if (current.scheduleType === "deposit" && index === 0 && field === "amount" && payments[1]) { const total = parseAmount(current.totalAmount); const deposit = parseAmount(value); payments[1].amount = Number.isFinite(total) && Number.isFinite(deposit) ? amountString(Math.max(total - deposit, 0)) : ""; } return { ...current, payments }; }); setErrors((current) => ({ ...current, schedule: undefined })); }
  function addPayment() { setValues((current) => ({ ...current, payments: [...current.payments, newPayment(`Payment ${current.payments.length + 1}`)] })); }
  function removePayment(index: number) { setValues((current) => current.payments.length <= 1 ? current : ({ ...current, payments: current.payments.filter((_, paymentIndex) => paymentIndex !== index) })); setErrors((current) => ({ ...current, schedule: undefined })); }

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault(); if (status !== "idle") return;
    const nextErrors = validate(values, event.displayCurrency); setErrors(nextErrors); const first = Object.keys(nextErrors)[0] as keyof FieldErrors | undefined;
    if (first) { requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`#${first}`)?.focus()); return; }
    setStatus("submitting"); setSubmitError("");
    try {
      const payments: ExpensePaymentInput[] = values.payments.map((payment) => ({ id: payment.id, label: payment.label.trim(), amount: parseAmount(payment.amount), dueDate: payment.dueDate || undefined, fundedAmount: payment.fundedAmount, paidAmount: payment.paidAmount }));
      const input = { title: values.title.trim(), payeeName: values.payeeName.trim(), payeeEmail: values.payeeEmail.trim(), category: values.category as ExpenseCategory, totalAmount: parseAmount(values.totalAmount), payments };
      const saved = expenseId ? await financialApi.updateExpense(expenseId, input) : await financialApi.createExpense(event.id, input); if (!saved) throw new Error("Expense not found");
      if (!expenseId) {
        if (!user) throw new Error("Authentication required");
        const agreement = await createAgreementForExpense(saved, event, user);
        await pactAccountAdapter.ensureAccount(user);
        const expiresAt=new Date(Date.now()+30*24*60*60*1000).toISOString();
        const signed = await pactAccountAdapter.signProposal(user.email,agreement,expiresAt);
        await submitProposal(agreement.id,{...signed,expiresAt});
      }
      router.replace(`/events/${event.id}/expenses/${saved.expense.id}?${expenseId ? "updated" : "created"}=1`);
    } catch (error) { setStatus("idle"); setSubmitError(error instanceof Error ? error.message : "We couldn’t save this expense. Your details are still here—please try again."); }
  }

  if (status === "loading") return <div className="funding-form-skeleton" aria-label="Loading expense" />;
  if (status === "locked") return <section className="expense-edit-locked"><span><LockKeyhole aria-hidden="true" /></span><p className="app-eyebrow">Accepted agreement</p><h1>This expense is locked.</h1><p>The payee has accepted the amount and payment schedule. Pact keeps those signed terms unchanged.</p><Link className="app-secondary-button" href={`/events/${event.id}/expenses/${expenseId}`}>Back to expense</Link></section>;
  if (status === "missing") return <section className="funding-error"><h1>Expense not found</h1><p>It may have been removed or belong to another event.</p><Link className="app-secondary-button" href={`/events/${event.id}/expenses`}>Back to expenses</Link></section>;
  const scheduleTotal = values.payments.reduce((sum, payment) => sum + (Number.isFinite(parseAmount(payment.amount)) ? parseAmount(payment.amount) : 0), 0);

  return <div className="funding-form-page expense-form-page"><Link className="app-back-link" href={expenseId ? `/events/${event.id}/expenses/${expenseId}` : `/events/${event.id}/expenses`}><ArrowLeft aria-hidden="true" /> Back to expenses</Link><header><p className="app-eyebrow">{expenseId ? "Edit expense" : "New expense"}</p><h1>{expenseId ? "Update the expense" : "Add an expense"}</h1><p>Record what your event needs to pay and how the payment is scheduled.</p></header>
    <form ref={formRef} className="funding-source-form expense-form" onSubmit={submit} noValidate aria-busy={status === "submitting"}>
      <section className="expense-form-section" aria-labelledby="expense-details-heading"><h2 id="expense-details-heading">Expense details</h2><div className="form-field"><label htmlFor="title">What are you paying for? <span>Required</span></label><input id="title" type="text" placeholder="Production" value={values.title} onChange={(e) => setField("title", e.target.value)} onBlur={() => setErrors((current) => ({ ...current, title: validate(values, event.displayCurrency).title }))} aria-invalid={errors.title ? "true" : undefined} aria-describedby={errors.title ? "title-error" : undefined} />{errors.title && <p id="title-error" className="field-error">{errors.title}</p>}</div>
      <div className="form-row"><div className="form-field"><label htmlFor="payeeName">Who are you paying? <span>Required</span></label><input id="payeeName" autoComplete="organization" placeholder="James Lmd or Pixel Production" value={values.payeeName} onChange={(e) => setField("payeeName", e.target.value)} aria-invalid={errors.payeeName ? "true" : undefined} aria-describedby={errors.payeeName ? "payeeName-error" : undefined} />{errors.payeeName && <p id="payeeName-error" className="field-error">{errors.payeeName}</p>}</div><div className="form-field"><label htmlFor="payeeEmail">Email <span>Required</span></label><input id="payeeEmail" type="email" autoComplete="email" spellCheck={false} placeholder="james@example.com" value={values.payeeEmail} onChange={(e) => setField("payeeEmail", e.target.value)} aria-invalid={errors.payeeEmail ? "true" : undefined} aria-describedby={errors.payeeEmail ? "payeeEmail-error" : undefined} />{errors.payeeEmail && <p id="payeeEmail-error" className="field-error">{errors.payeeEmail}</p>}</div></div>
      <div className="form-row"><div className="form-field"><label htmlFor="category">Category <span>Required</span></label><select id="category" value={values.category} onChange={(e) => setField("category", e.target.value)} aria-invalid={errors.category ? "true" : undefined} aria-describedby={errors.category ? "category-error" : undefined}><option value="">Select a category</option>{EXPENSE_CATEGORIES.map((category) => <option value={category} key={category}>{EXPENSE_CATEGORY_LABELS[category]}</option>)}</select>{errors.category && <p id="category-error" className="field-error">{errors.category}</p>}</div><div className="form-field"><label htmlFor="totalAmount">Total amount <span>Required</span></label><div className="currency-input"><span>{event.displayCurrency}</span><input id="totalAmount" type="text" inputMode="decimal" placeholder="8,000" value={values.totalAmount} onChange={(e) => changeTotal(e.target.value)} aria-invalid={errors.totalAmount ? "true" : undefined} aria-describedby={errors.totalAmount ? "totalAmount-error" : undefined} /></div>{errors.totalAmount && <p id="totalAmount-error" className="field-error">{errors.totalAmount}</p>}</div></div></section>

      <section className="expense-form-section schedule-section" aria-labelledby="schedule-heading"><div className="expense-section-heading"><div><h2 id="schedule-heading">How will this be paid?</h2><p>The schedule must add up to the expense total.</p></div></div><fieldset className="schedule-type-fieldset"><legend className="sr-only">Payment schedule type</legend><div className="schedule-type-grid">{(["single", "deposit", "custom"] as const).map((type) => <label className={values.scheduleType === type ? "selected" : ""} key={type}><input type="radio" name="scheduleType" checked={values.scheduleType === type} onChange={() => changeSchedule(type)} /><span>{type === "single" ? "Single payment" : type === "deposit" ? "Deposit + balance" : "Custom payment schedule"}</span></label>)}</div></fieldset>
      <div className="payment-editor" id="schedule" tabIndex={errors.schedule ? -1 : undefined}>{values.payments.map((payment, index) => <div className="payment-editor-row" key={payment.key}><div className="form-field"><label htmlFor={`payment-label-${index}`}>Payment name</label><input id={`payment-label-${index}`} type="text" value={payment.label} onChange={(e) => updatePayment(index, "label", e.target.value)} readOnly={values.scheduleType === "deposit"} /></div><div className="form-field"><label htmlFor={`payment-amount-${index}`}>Amount</label><div className="currency-input"><span>{event.displayCurrency}</span><input id={`payment-amount-${index}`} type="text" inputMode="decimal" value={payment.amount} onChange={(e) => updatePayment(index, "amount", e.target.value)} readOnly={values.scheduleType === "deposit" && index === 1} /></div></div><div className="form-field"><label htmlFor={`payment-date-${index}`}>Due date <span>Optional</span></label><input id={`payment-date-${index}`} type="date" value={payment.dueDate} onChange={(e) => updatePayment(index, "dueDate", e.target.value)} /></div>{values.scheduleType === "custom" && <button className="remove-payment" type="button" onClick={() => removePayment(index)} disabled={values.payments.length === 1} aria-label={`Remove ${payment.label || `payment ${index + 1}`}`}><Trash2 aria-hidden="true" /></button>}</div>)}</div>
      {values.scheduleType === "custom" && <button className="add-payment-button" type="button" onClick={addPayment}><Plus aria-hidden="true" /> Add payment</button>}
      <div className="schedule-totals"><span><small>Schedule total</small><strong>{formatEventCurrency(scheduleTotal, event.displayCurrency)}</strong></span><span><small>Expense total</small><strong>{formatEventCurrency(parseAmount(values.totalAmount) || 0, event.displayCurrency)}</strong></span></div>{errors.schedule && <p className="form-submit-error" role="alert">{errors.schedule}</p>}</section>
      {submitError && <p className="form-submit-error" role="alert">{submitError}</p>}<div className="funding-form-actions"><Link className="app-secondary-button" href={expenseId ? `/events/${event.id}/expenses/${expenseId}` : `/events/${event.id}/expenses`}>Cancel</Link><button className="app-primary-button" type="submit" disabled={status === "submitting"}>{status === "submitting" ? <><LoaderCircle className="button-spinner" aria-hidden="true" /> Saving…</> : <>{expenseId ? "Save changes" : "Create payment agreement"}<ArrowRight aria-hidden="true" /></>}</button></div>
    </form>
  </div>;
}
