import {NextRequest,NextResponse} from "next/server";
import {requireIdentity} from "../../../../../lib/server/auth";
import {apiError} from "../../../../../lib/server/http";
import {createPaymentChallenge,executePayment,paymentExecutionState} from "../../../../../lib/server/vault-execution";
import type {VaultExecutionAuthorization} from "../../../../../lib/pact-types";

export async function GET(request:NextRequest,{params}:{params:Promise<{paymentId:string}>}){try{const identity=await requireIdentity(request),{paymentId}=await params;return NextResponse.json({settlements:await paymentExecutionState(paymentId,identity.userId)});}catch(error){return apiError(error);}}
export async function POST(request:NextRequest,{params}:{params:Promise<{paymentId:string}>}){try{const identity=await requireIdentity(request),{paymentId}=await params,body=await request.json() as {authorization?:VaultExecutionAuthorization};if(!body.authorization)return NextResponse.json({challenge:await createPaymentChallenge(paymentId,identity.userId)});const settlement=await executePayment(paymentId,identity.userId,body.authorization);return NextResponse.json({settlement},{status:201});}catch(error){return apiError(error);}}
