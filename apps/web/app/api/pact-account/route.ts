import { NextRequest,NextResponse } from "next/server";
import { requireIdentity } from "../../../lib/server/auth";
import { pactAccountForUser } from "../../../lib/server/agreement-repository";
import { apiError } from "../../../lib/server/http";
export async function GET(request:NextRequest){try{const identity=await requireIdentity(request);return NextResponse.json({account:await pactAccountForUser(identity.userId)});}catch(error){return apiError(error);}}
