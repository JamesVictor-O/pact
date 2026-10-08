import assert from "node:assert/strict";
import test from "node:test";
import { getPayeePaymentState,summarizePayeeWorkspace } from "./payee-workspace.ts";
import type { PayeePayment,PaymentAgreement } from "./pact-types.ts";

const agreement={id:"a",eventId:"e",expenseId:"x",organizerUserId:"o",payeeId:"p",payeeEmail:"payee@example.com",totalAmountMinor:10000,currency:"USD",status:"active",snapshot:{agreementId:"a",eventId:"e",eventName:"Event",organizerUserId:"o",organizerDisplayName:"Organizer",expenseId:"x",title:"Production",category:"production",payeeName:"Payee",payeeEmail:"payee@example.com",totalAmountMinor:10000,currency:"USD",paymentSchedule:[],termsVersion:"v1",terms:"Terms"},agreementHash:"0x1",scheduleHash:"0x2",registrationStatus:"registered",createdAt:"2026-10-01T00:00:00Z",updatedAt:"2026-10-01T00:00:00Z"} satisfies PaymentAgreement;
const payment=(overrides:Partial<PayeePayment>={}):PayeePayment=>({id:"p1",agreementId:"a",eventId:"e",eventName:"Event",agreementTitle:"Production",label:"Deposit",currency:"USD",amountMinor:6000,fundedAmountMinor:6000,paidAmountMinor:0,dueDate:"2026-10-01",...overrides});

test("payee payment state distinguishes overdue, processing, and paid",()=>{const now=new Date("2026-10-08T12:00:00Z");assert.equal(getPayeePaymentState(payment(),agreement,now),"overdue");assert.equal(getPayeePaymentState(payment({processingStartedAt:"2026-10-08T10:00:00Z"}),agreement,now),"processing");assert.equal(getPayeePaymentState(payment({paidAmountMinor:6000}),agreement,now),"paid");});

test("payee summary keeps commitments, paid value, and outstanding value separate",()=>{const payments=[payment({paidAmountMinor:2000}),payment({id:"p2",label:"Balance",amountMinor:4000,dueDate:"2026-12-01"})];const summary=summarizePayeeWorkspace([agreement],payments,new Date("2026-10-08T12:00:00Z"));assert.deepEqual(summary.totals.get("USD"),{committed:10000,paid:2000,outstanding:8000});assert.equal(summary.overdue.length,1);assert.equal(summary.upcoming.length,1);});
