import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "../../../../../lib/server/auth";
import { findAccessibleAgreement } from "../../../../../lib/server/agreement-repository";
import { apiError } from "../../../../../lib/server/http";
import { finalizeAgreementRegistration } from "../../../../../lib/server/registry";
export async function POST(request:NextRequest,{params}:{params:Promise<{agreementId:string}>}){try{const identity=await requireIdentity(request);const {agreementId}=await params;const agreement=await findAccessibleAgreement(agreementId,identity.userId,identity.email);if(!agreement)return NextResponse.json({error:"Agreement not found"},{status:404});if(!["acceptance_signed","registration_pending"].includes(agreement.status))return NextResponse.json({error:"Agreement is not awaiting registration"},{status:409});return NextResponse.json({agreement:await finalizeAgreementRegistration(agreement.id)});}catch(error){return apiError(error);}}
