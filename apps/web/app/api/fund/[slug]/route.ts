import {NextResponse} from "next/server";
import {findPublicFundingRequest} from "../../../../lib/server/funding-request-repository";
import {apiError} from "../../../../lib/server/http";
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){try{const {slug}=await params,request=await findPublicFundingRequest(slug);return request?NextResponse.json(request):NextResponse.json({error:"Funding request not found"},{status:404});}catch(error){return apiError(error);}}
