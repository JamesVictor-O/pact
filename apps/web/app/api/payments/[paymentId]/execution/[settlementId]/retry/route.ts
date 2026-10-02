import {NextRequest,NextResponse} from "next/server";
import {requireIdentity} from "../../../../../../../lib/server/auth";
import {apiError} from "../../../../../../../lib/server/http";
import {relayPayment} from "../../../../../../../lib/server/vault-execution";

export async function POST(request:NextRequest,{params}:{params:Promise<{paymentId:string;settlementId:string}>}){try{const identity=await requireIdentity(request),{settlementId}=await params,settlement=await relayPayment(settlementId,identity.userId);return settlement?NextResponse.json({settlement}):NextResponse.json({error:"Payment attempt not found"},{status:404});}catch(error){return apiError(error);}}
