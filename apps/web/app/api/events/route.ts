import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "../../../lib/server/auth";
import { createEvent, listEvents } from "../../../lib/server/financial-repository";
import { apiError } from "../../../lib/server/http";
import type { CreatePactEventInput } from "../../../lib/pact-types";
import { pactAccountForUser } from "../../../lib/server/agreement-repository";
import { provisionEventVault } from "../../../lib/server/event-vault";

export async function GET(request: NextRequest) {
  try { const identity = await requireIdentity(request); return NextResponse.json({ events: await listEvents(identity.userId) }); }
  catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await requireIdentity(request);
    const body = await request.json() as CreatePactEventInput;
    const authorization = body.vaultAuthorization;
    if (!body.id?.startsWith("event_") || authorization?.eventId !== body.id || !body.name?.trim() || !body.date || !body.displayCurrency || !Number.isFinite(body.estimatedBudget) || body.estimatedBudget < 0) return NextResponse.json({ error: "Complete the required event and vault details" }, { status: 400 });
    const account = await pactAccountForUser(identity.userId);
    if (!account || account.signingAddress.toLowerCase() !== authorization.organizer.toLowerCase()) return NextResponse.json({ error: "The event vault must be authorized by your Mera account" }, { status: 403 });
    if (new Date(authorization.deadline).getTime() <= Date.now()) return NextResponse.json({ error: "Event vault authorization has expired" }, { status: 400 });
    await createEvent(identity.userId, { ...body, name: body.name.trim() });
    const event = await provisionEventVault(body.id, identity.userId);
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) { return apiError(error); }
}
