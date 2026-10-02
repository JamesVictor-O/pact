import {NextRequest,NextResponse} from "next/server";
import {requireIdentity} from "../../../../../../lib/server/auth";
import {apiError} from "../../../../../../lib/server/http";
import {createAllocationChallenge} from "../../../../../../lib/server/vault-execution";

export async function POST(request:NextRequest,{params}:{params:Promise<{sourceId:string}>}){try{const identity=await requireIdentity(request),{sourceId}=await params,body=await request.json() as {paymentId:string;amount:number};return NextResponse.json({challenge:await createAllocationChallenge(sourceId,body.paymentId,body.amount,identity.userId)});}catch(error){return apiError(error);}}
