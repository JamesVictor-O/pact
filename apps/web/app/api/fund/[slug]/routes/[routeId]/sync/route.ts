import { NextRequest, NextResponse } from "next/server";
import { AuroraIntentsError } from "../../../../../../../lib/server/aurora-intents";
import { syncAuroraRoute } from "../../../../../../../lib/server/aurora-repository";
import { apiError } from "../../../../../../../lib/server/http";

export async function POST(_:NextRequest,{params}:{params:Promise<{slug:string;routeId:string}>}){try{const {slug,routeId}=await params;const route=await syncAuroraRoute(slug,routeId);return route?NextResponse.json({route}):NextResponse.json({error:"Deposit route not found"},{status:404});}catch(error){if(error instanceof AuroraIntentsError)return NextResponse.json({error:error.message,retryAfter:error.retryAfter},{status:error.status});if(error instanceof Error&&["Aurora destination verification is not configured","Aurora did not return a destination transaction hash","Aurora destination transaction did not succeed","Aurora settlement did not transfer USDC to the event account","Aurora settlement amount cannot be represented in USD cents"].includes(error.message))return NextResponse.json({error:error.message},{status:409});return apiError(error);}}
