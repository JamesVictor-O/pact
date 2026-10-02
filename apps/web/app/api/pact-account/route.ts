import { NextRequest,NextResponse } from "next/server";
import { requireIdentity } from "../../../lib/server/auth";
import { bindPactAccount, pactAccountForUser } from "../../../lib/server/agreement-repository";
import { apiError } from "../../../lib/server/http";
export async function GET(request:NextRequest){try{const identity=await requireIdentity(request);return NextResponse.json({account:await pactAccountForUser(identity.userId)});}catch(error){return apiError(error);}}
export async function POST(request:NextRequest){try{const identity=await requireIdentity(request);const body=await request.json() as {address?:string};if(!body.address||!/^0x[0-9a-fA-F]{40}$/.test(body.address))return NextResponse.json({error:"A valid Mera address is required"},{status:400});await bindPactAccount(identity.userId,body.address);return NextResponse.json({account:{signingAddress:body.address}});}catch(error){return apiError(error);}}
