import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "../../../../lib/server/auth";
import { apiError } from "../../../../lib/server/http";
import { findAccessibleAgreement, invoiceForAgreement, payoutForAgreement } from "../../../../lib/server/agreement-repository";

export async function GET(request:NextRequest,{params}:{params:Promise<{agreementId:string}>}){try{const identity=await requireIdentity(request);const {agreementId}=await params;const agreement=await findAccessibleAgreement(agreementId,identity.userId,identity.email);if(!agreement)return NextResponse.json({error:"Agreement not found"},{status:404});const [invoice,payout]=await Promise.all([invoiceForAgreement(agreementId),payoutForAgreement(agreementId)]);return NextResponse.json({agreement,invoice,payout});}catch(error){return apiError(error);}}
