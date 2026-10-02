"use client";
import { getAuthToken } from "@dynamic-labs/sdk-react-core";
import type { Allocation, CreatePactEventInput, ExpenseInput, ExpenseRecord, FundingRequest, FundingSource, FundingSourceInput, PactEvent } from "./pact-types";
async function request<T>(path:string,init?:RequestInit){const token=getAuthToken();if(!token)throw new Error("Your authenticated session is unavailable");const response=await fetch(path,{...init,headers:{"content-type":"application/json",authorization:`Bearer ${token}`,...init?.headers},cache:"no-store"});const body=await response.json();if(!response.ok)throw new Error(body.error??"Request failed");return body as T;}
export const financialApi={
  listEvents:async()=>(await request<{events:PactEvent[]}>("/api/events")).events,
  getEvent:async(id:string)=>(await request<{event:PactEvent}>(`/api/events/${id}`)).event,
  createEvent:async(input:CreatePactEventInput)=>(await request<{event:PactEvent}>("/api/events",{method:"POST",body:JSON.stringify(input)})).event,
  retryEventVault:async(id:string,vaultAuthorization?:CreatePactEventInput["vaultAuthorization"])=>(await request<{event:PactEvent}>(`/api/events/${id}/vault`,{method:"POST",body:JSON.stringify({vaultAuthorization})})).event,
  listFunding:async(eventId:string)=>(await request<{sources:FundingSource[]}>(`/api/events/${eventId}/funding`)).sources,
  getFunding:async(id:string)=>(await request<{source:FundingSource}>(`/api/funding/${id}`)).source,
  createFunding:async(eventId:string,input:FundingSourceInput)=>(await request<{source:FundingSource}>(`/api/events/${eventId}/funding`,{method:"POST",body:JSON.stringify(input)})).source,
  updateFunding:async(id:string,input:FundingSourceInput)=>(await request<{source:FundingSource}>(`/api/funding/${id}`,{method:"PATCH",body:JSON.stringify(input)})).source,
  cancelFunding:async(id:string)=>(await request<{source:FundingSource}>(`/api/funding/${id}`,{method:"DELETE"})).source,
  fundingRequests:async(id:string)=>(await request<{requests:FundingRequest[]}>(`/api/funding/${id}/requests`)).requests,
  createFundingRequest:async(id:string,amount?:number)=>(await request<{request:FundingRequest}>(`/api/funding/${id}/requests`,{method:"POST",body:JSON.stringify({amount})})).request,
  listExpenses:async(eventId:string)=>(await request<{records:ExpenseRecord[]}>(`/api/events/${eventId}/expenses`)).records,
  getExpense:async(id:string)=>(await request<{record:ExpenseRecord}>(`/api/expenses/${id}`)).record,
  getPayment:async(id:string)=>(await request<{record:ExpenseRecord}>(`/api/payments/${id}`)).record,
  createExpense:async(eventId:string,input:ExpenseInput)=>(await request<{record:ExpenseRecord}>(`/api/events/${eventId}/expenses`,{method:"POST",body:JSON.stringify(input)})).record,
  updateExpense:async(id:string,input:ExpenseInput)=>(await request<{record:ExpenseRecord}>(`/api/expenses/${id}`,{method:"PATCH",body:JSON.stringify(input)})).record,
  cancelExpense:async(id:string)=>(await request<{record:ExpenseRecord}>(`/api/expenses/${id}`,{method:"DELETE"})).record,
  sourceAllocations:async(id:string)=>(await request<{allocations:Allocation[]}>(`/api/funding/${id}/allocations`)).allocations,
  paymentAllocations:async(id:string)=>(await request<{allocations:Allocation[]}>(`/api/payments/${id}/allocations`)).allocations,
  allocate:async(sourceId:string,paymentId:string,amount:number)=>(await request<{allocation:Allocation}>(`/api/funding/${sourceId}/allocations`,{method:"POST",body:JSON.stringify({paymentId,amount})})).allocation,
  reverseAllocation:async(id:string)=>(await request<{allocation:Allocation}>(`/api/allocations/${id}`,{method:"DELETE"})).allocation,
};

export async function migrateLegacyFinancialData(){if(typeof window==="undefined"||localStorage.getItem("pact.financial-server-migration.v1")==="done")return;const read=<T,>(key:string,fallback:T):T=>{try{return JSON.parse(localStorage.getItem(key)??"") as T}catch{return fallback}};const events=read<PactEvent[]>("pact.preview.events.v1",[]).map(event=>({...event,ownerId:event.ownerId.replace(/^dynamic_/,"")})),sources=read<FundingSource[]>("pact.funding-sources.v1",[]),records=read<ExpenseRecord[]>("pact.expense-records.v1",[]);if(events.length||sources.length||records.length)await request("/api/finance/import",{method:"POST",body:JSON.stringify({events,sources,records})});localStorage.setItem("pact.financial-server-migration.v1","done");}
