import {NextRequest,NextResponse} from "next/server";
import {requireIdentity} from "../../../lib/server/auth";
import {apiError} from "../../../lib/server/http";
import {auroraPayoutAvailability,listAuroraPayoutAssets} from "../../../lib/server/aurora-payout";
import type {PayoutAssetOption} from "../../../lib/pact-types";

export async function GET(request:NextRequest){try{await requireIdentity(request);const availability=auroraPayoutAvailability();let assets:PayoutAssetOption[]=[];try{assets=await listAuroraPayoutAssets();}catch{assets=[];}return NextResponse.json({assets,enabled:availability.enabled,reason:availability.reason});}catch(error){return apiError(error);}}
