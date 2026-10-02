import {NextResponse} from "next/server";
import {reconcilePublicFundingReceipt} from "../../../../../lib/server/funding-request-repository";
import {apiError} from "../../../../../lib/server/http";
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){try{const {slug}=await params,{transactionHash}=await request.json() as {transactionHash?:string};if(!transactionHash)return NextResponse.json({error:"Transaction hash is required"},{status:400});const receipt=await reconcilePublicFundingReceipt(slug,transactionHash);return receipt?NextResponse.json({receipt}):NextResponse.json({error:"Funding request not found"},{status:404});}catch(error){return apiError(error);}}
