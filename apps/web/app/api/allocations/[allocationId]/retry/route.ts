import {NextRequest,NextResponse} from "next/server";
import {requireIdentity} from "../../../../../lib/server/auth";
import {apiError} from "../../../../../lib/server/http";
import {relayAllocation} from "../../../../../lib/server/vault-execution";

export async function POST(request:NextRequest,{params}:{params:Promise<{allocationId:string}>}){try{const identity=await requireIdentity(request),{allocationId}=await params,allocation=await relayAllocation(allocationId,identity.userId);return allocation?NextResponse.json({allocation}):NextResponse.json({error:"Allocation not found"},{status:404});}catch(error){return apiError(error);}}
