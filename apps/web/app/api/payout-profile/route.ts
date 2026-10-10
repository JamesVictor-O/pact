import {NextRequest,NextResponse} from "next/server";
import {getAddress,isAddress,verifyMessage,type Address,type Hex} from "viem";
import {isValidPayoutAddress,payoutChainFamily} from "../../../lib/payout-destinations";
import {payoutPreferenceVerificationMessage} from "../../../lib/payout-verification";
import {requireIdentity} from "../../../lib/server/auth";
import {pactAccountForUser,updatePayoutPreference} from "../../../lib/server/agreement-repository";
import {findSupportedPayoutAsset} from "../../../lib/server/aurora-payout";
import {apiError} from "../../../lib/server/http";

export async function PATCH(request:NextRequest){
  try{
    const identity=await requireIdentity(request),body=await request.json() as {mode?:"mera"|"external_wallet";assetId?:string;address?:string;message?:string;signature?:Hex;confirmed?:boolean};
    const account=await pactAccountForUser(identity.userId);
    if(!account)return NextResponse.json({error:"Secure your Pact account before choosing a payout destination"},{status:409});
    if(body.mode==="mera"){
      const payout=await updatePayoutPreference(identity.userId,{type:"mera",address:account.signingAddress,preference:{chain:"monad",assetId:"monad:usdc",assetSymbol:"USDC",assetDecimals:Number(process.env.PACT_SETTLEMENT_TOKEN_DECIMALS??6),address:account.signingAddress,verification:"pact_account"}});
      return payout?NextResponse.json({payout}):NextResponse.json({error:"Payout profile not found"},{status:404});
    }
    if(body.mode!=="external_wallet"||!body.assetId||!body.address)return NextResponse.json({error:"Choose a network and enter its receiving address"},{status:400});
    const asset=await findSupportedPayoutAsset(body.assetId);
    if(!asset)return NextResponse.json({error:"This payout option is no longer available"},{status:400});
    let address=body.address.trim();
    if(!isValidPayoutAddress(asset.blockchain,address))return NextResponse.json({error:`Enter a valid ${asset.blockchain} receiving address`},{status:400});
    let verification:"wallet_signature"|"payee_confirmation"="payee_confirmation";
    if(payoutChainFamily(asset.blockchain)==="evm"){
      if(!isAddress(address)||!body.message||!body.signature)return NextResponse.json({error:"Verify this wallet before saving it"},{status:400});
      address=getAddress(address);const expected=payoutPreferenceVerificationMessage({userId:identity.userId,address,assetId:asset.assetId});
      if(body.message!==expected||!await verifyMessage({address:address as Address,message:expected,signature:body.signature}))return NextResponse.json({error:"Wallet verification is invalid or expired"},{status:400});
      verification="wallet_signature";
    }else if(!body.confirmed)return NextResponse.json({error:"Confirm that this receiving address belongs to you"},{status:400});
    const payout=await updatePayoutPreference(identity.userId,{type:"external_wallet",address,preference:{chain:asset.blockchain,assetId:asset.assetId,assetSymbol:asset.symbol,assetDecimals:asset.decimals,address,verification}});
    return payout?NextResponse.json({payout}):NextResponse.json({error:"Payout profile not found"},{status:404});
  }catch(error){return apiError(error);}
}
