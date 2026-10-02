import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "../../../../../lib/server/auth";
import { provisionEventVault } from "../../../../../lib/server/event-vault";
import { apiError } from "../../../../../lib/server/http";
import { pactAccountForUser } from "../../../../../lib/server/agreement-repository";
import { authorizeEventVault } from "../../../../../lib/server/financial-repository";
import type { EventVaultAuthorization } from "../../../../../lib/pact-types";

export async function POST(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  try {
    const identity = await requireIdentity(request);
    const { eventId } = await context.params;
    const body=await request.json().catch(()=>({})) as {vaultAuthorization?:EventVaultAuthorization};
    if(body.vaultAuthorization){const authorization=body.vaultAuthorization;if(authorization.eventId!==eventId||new Date(authorization.deadline).getTime()<=Date.now())return NextResponse.json({error:"A current event vault authorization is required"},{status:400});const account=await pactAccountForUser(identity.userId);if(!account||account.signingAddress.toLowerCase()!==authorization.organizer.toLowerCase())return NextResponse.json({error:"The event vault must be authorized by your Mera account"},{status:403});await authorizeEventVault(eventId,identity.userId,authorization);}
    const event = await provisionEventVault(eventId, identity.userId);
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    return NextResponse.json({ event });
  } catch (error) { return apiError(error); }
}
