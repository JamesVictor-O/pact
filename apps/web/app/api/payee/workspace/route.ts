import { NextRequest,NextResponse } from "next/server";
import { getPayeeWorkspace } from "../../../../lib/server/agreement-repository";
import { requireIdentity } from "../../../../lib/server/auth";
import { apiError } from "../../../../lib/server/http";

export async function GET(request:NextRequest){try{const identity=await requireIdentity(request);return NextResponse.json(await getPayeeWorkspace(identity.userId,identity.email));}catch(error){return apiError(error);}}
