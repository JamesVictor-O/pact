import { keccak256, toBytes } from "viem";
import type { AgreementSnapshot, Expense, Invoice, PaymentAgreement, PayoutProfile } from "./pact-types";

export function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
export function getPayeeName(expense: Expense): string { return expense.payeeName ?? expense.vendorName ?? "Payee"; }
export function getPayeeEmail(expense: Expense): string { return normalizeEmail(expense.payeeEmail ?? expense.vendorEmail ?? ""); }

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(",")}}`;
}

export function hashCanonical(value: unknown): `0x${string}` { return keccak256(toBytes(canonicalize(value))); }
export function hashAgreementSnapshot(snapshot: AgreementSnapshot) { return hashCanonical(snapshot); }
export function hashSchedule(snapshot: AgreementSnapshot) { return hashCanonical(snapshot.paymentSchedule); }

export type AgreementReadiness = { ready: boolean; reasons: string[] };
export function getAgreementPaymentReadiness(paymentAmount: number, fundedAmount: number, paidAmount: number, cancelled: boolean, agreement?: PaymentAgreement, invoice?: Invoice, payout?: PayoutProfile): AgreementReadiness {
  const reasons: string[] = [];
  if (cancelled) reasons.push("This scheduled payment is cancelled.");
  if (!agreement || agreement.status !== "active") reasons.push(agreement?.status === "awaiting_acceptance" ? "Agreement awaiting acceptance." : "Agreement is not active.");
  if (!invoice || invoice.status !== "confirmed") reasons.push("Invoice not confirmed.");
  if (!payout || payout.verificationStatus !== "verified") reasons.push("Payout setup incomplete.");
  if (fundedAmount < paymentAmount) reasons.push(`${Math.max(paymentAmount - fundedAmount, 0)} still needs funding.`);
  if (paidAmount >= paymentAmount) reasons.push("This payment has already been released.");
  return { ready: reasons.length === 0, reasons };
}
