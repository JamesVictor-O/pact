import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "../../../../../lib/server/auth";
import { apiError } from "../../../../../lib/server/http";
import { findOrganizerAgreementByExpense, invoiceForAgreement, payoutForAgreement } from "../../../../../lib/server/agreement-repository";
export async function GET(request:NextRequest,{params}:{params:Promise<{expenseId:string}>}){try{const identity=await requireIdentity(request);const {expenseId}=await params;const agreement=await findOrganizerAgreementByExpense(expenseId,identity.userId);if(!agreement)return NextResponse.json({error:"Agreement not found"},{status:404});const [invoice,payout]=await Promise.all([invoiceForAgreement(agreement.id),payoutForAgreement(agreement.id)]);return NextResponse.json({agreement,invoice,payout});}catch(error){return apiError(error);}}
