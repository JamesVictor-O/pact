import {NextRequest,NextResponse} from "next/server";
import {getAddress,isAddress} from "viem";
import {payoutPreferenceVerificationMessage} from "../../../../lib/payout-verification";
import {requireIdentity} from "../../../../lib/server/auth";
import {findSupportedPayoutAsset} from "../../../../lib/server/aurora-payout";
import {apiError} from "../../../../lib/server/http";

export async function POST(request:NextRequest){
  try{
    const identity=await requireIdentity(request),body=await request.json() as {assetId?:string;address?:string};
    if(!body.assetId)return NextResponse.json({error:"Choose a payout network"},{status:400});
    const asset=await findSupportedPayoutAsset(body.assetId);
    if(!asset)return NextResponse.json({error:"This payout option is no longer available"},{status:400});
    if(!body.address||!isAddress(body.address))return NextResponse.json({error:"Enter a valid wallet address for this network"},{status:400});
    const address=getAddress(body.address),message=payoutPreferenceVerificationMessage({userId:identity.userId,address,assetId:asset.assetId});
    return NextResponse.json({address,message});
  }catch(error){return apiError(error);}
}
