import type { DisplayCurrency, PayeePayment, PaymentAgreement } from "./pact-types";

export type PayeePaymentState="awaiting_agreement"|"upcoming"|"overdue"|"processing"|"paid"|"cancelled";

const activeAgreement=(agreement?:PaymentAgreement)=>agreement?.status==="active"||agreement?.status==="completed";

export function getPayeePaymentState(payment:PayeePayment,agreement?:PaymentAgreement,today=new Date()):PayeePaymentState{
  if(payment.cancelledAt||agreement?.status==="cancelled")return"cancelled";
  if(payment.paidAmountMinor>=payment.amountMinor)return"paid";
  if(payment.processingStartedAt)return"processing";
  if(!activeAgreement(agreement))return"awaiting_agreement";
  if(payment.dueDate){const due=new Date(`${payment.dueDate}T23:59:59Z`);if(due.getTime()<today.getTime())return"overdue";}
  return"upcoming";
}

export function summarizePayeeWorkspace(agreements:PaymentAgreement[],payments:PayeePayment[],today=new Date()){
  const byId=new Map(agreements.map(item=>[item.id,item]));
  const totals=new Map<DisplayCurrency,{committed:number;paid:number;outstanding:number}>();
  for(const agreement of agreements){if(agreement.status==="cancelled"||agreement.status==="declined")continue;const current=totals.get(agreement.currency)??{committed:0,paid:0,outstanding:0};current.committed+=agreement.totalAmountMinor;totals.set(agreement.currency,current);}
  for(const payment of payments){const agreement=byId.get(payment.agreementId);if(!agreement||agreement.status==="cancelled"||agreement.status==="declined")continue;const current=totals.get(payment.currency)??{committed:0,paid:0,outstanding:0};current.paid+=Math.min(payment.paidAmountMinor,payment.amountMinor);current.outstanding+=Math.max(payment.amountMinor-payment.paidAmountMinor,0);totals.set(payment.currency,current);}
  const ordered=payments.map(payment=>({payment,state:getPayeePaymentState(payment,byId.get(payment.agreementId),today)}));
  return{totals,overdue:ordered.filter(item=>item.state==="overdue"),upcoming:ordered.filter(item=>item.state==="upcoming"||item.state==="processing"),paid:ordered.filter(item=>item.state==="paid")};
}

export function formatPayeeDate(value?:string){if(!value)return"Date to be confirmed";return new Intl.DateTimeFormat("en",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T00:00:00Z`));}
