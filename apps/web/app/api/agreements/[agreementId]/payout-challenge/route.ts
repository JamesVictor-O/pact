import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { payoutVerificationMessage } from "../../../../../lib/payout-verification";
import { requireIdentity } from "../../../../../lib/server/auth";
import { findAccessibleAgreement } from "../../../../../lib/server/agreement-repository";
import { apiError } from "../../../../../lib/server/http";

export async function POST(request:NextRequest,{params}:{params:Promise<{agreementId:string}>}) {
  try {
    const identity=await requireIdentity(request);const {agreementId}=await params;
    const agreement=await findAccessibleAgreement(agreementId,identity.userId,identity.email);
    if(!agreement||agreement.payeeEmail!==identity.email)return NextResponse.json({error:"Agreement not found"},{status:404});
    const body=await request.json() as {address?:string};
    if(!body.address||!isAddress(body.address))return NextResponse.json({error:"Enter a valid EVM wallet address"},{status:400});
    const chainId=Number(process.env.MONAD_CHAIN_ID??10143);const address=getAddress(body.address);
    return NextResponse.json({address,chainId,message:payoutVerificationMessage({agreementId,userId:identity.userId,address,chainId})});
  } catch(error) { return apiError(error); }
}
