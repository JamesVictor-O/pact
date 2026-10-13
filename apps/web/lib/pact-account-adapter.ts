"use client";

import { createPasskeyWithPrfOutput, createSecp256k1SigningSession, getPasskeyPrfOutput, isMeraError } from "@category-labs/mera";
import { getAuthToken } from "@dynamic-labs/sdk-react-core";
import { toViemAccount } from "@category-labs/mera/viem";
import { hexToBytes, keccak256 } from "viem";
import { acceptanceTypes, canonicalBytes32, currencyBytes32, eventAllocationTypes, eventPaymentReleaseTypes, eventPaymentRouteTypes, eventVaultAuthorizationTypes, eventVaultDomain, eventVaultFactoryDomain, proposalDigest, proposalTypes, registryDomain } from "./agreement-typed-data";
import type { Invoice, MeraWithdrawalTransaction, PaymentAgreement, VaultExecutionChallenge } from "./pact-types";

const LEGACY_CREDENTIAL_KEY = "pact.mera-credential.v1";
const credentialKey = (userId:string) => `pact.mera-credential.v2:${userId}`;
type StoredCredential = { credentialId: string; transports?: readonly string[] };

function privateKeyFromPrf(output: Uint8Array): Uint8Array { return hexToBytes(keccak256(output)); }
function passkeyRpId():string { return process.env.NEXT_PUBLIC_PACT_PASSKEY_RP_ID?.trim()||window.location.hostname; }

export class PactAccountAdapter {
  async setup(user: { name: string; email: string }) {
    const created = await createPasskeyWithPrfOutput({ rp: { id: passkeyRpId(), name: "Pact" }, user: { name: user.email, displayName: user.name } });
    const credential={credentialId:created.credentialId,transports:created.transports} satisfies StoredCredential;
    localStorage.setItem(credentialKey(user.email.trim().toLowerCase()), JSON.stringify(credential));
    return this.withAccount(created.prfOutput, async (account) => ({ address: account.address,credential }));
  }

  async ensureAccount(user: { id:string;name:string;email:string }):Promise<{address:`0x${string}`}> {
    const key=credentialKey(user.email.trim().toLowerCase());
    const token=getAuthToken();
    const stored=localStorage.getItem(key);
    if(token){
      const response=await fetch("/api/pact-account",{headers:{authorization:`Bearer ${token}`},cache:"no-store"});
      if(response.ok){
        const {account}=await response.json() as {account:{signingAddress:`0x${string}`;credential?:StoredCredential}|null};
        if(account&&stored){const credential=JSON.parse(stored) as StoredCredential;const local=await this.unlockCredential(credential,account.signingAddress);await this.bindAccount(local.address,credential);return local;}
        const legacy=localStorage.getItem(LEGACY_CREDENTIAL_KEY);
        if(account&&legacy){const credential=JSON.parse(legacy) as StoredCredential;const local=await this.unlockCredential(credential,account.signingAddress);localStorage.setItem(key,legacy);await this.bindAccount(local.address,credential);return local;}
        if(account?.credential){const local=await this.unlockCredential(account.credential,account.signingAddress);localStorage.setItem(key,JSON.stringify(account.credential));return local;}
        if(account)return this.recoverSyncedAccount(key,account.signingAddress);
      }
    }
    if(stored){
      const credential=JSON.parse(stored) as StoredCredential;
      const unlocked=await getPasskeyPrfOutput({rpId:passkeyRpId(),credential});
      const account=await this.withAccount(unlocked.prfOutput,async value=>({address:value.address}));await this.bindAccount(account.address,credential);return account;
    }
    const account=await this.setup(user);await this.bindAccount(account.address,account.credential);return account;
  }

  private async recoverSyncedAccount(key:string,expectedAddress:`0x${string}`):Promise<{address:`0x${string}`}> {
    try {
      const unlocked=await getPasskeyPrfOutput({rpId:passkeyRpId()});
      const account=await this.withAccount(unlocked.prfOutput,async value=>({address:value.address}));
      if(account.address.toLowerCase()!==expectedAddress.toLowerCase())throw new Error("The selected passkey belongs to a different Pact signing account.");
      const credential={credentialId:unlocked.credentialId} satisfies StoredCredential;
      localStorage.setItem(key,JSON.stringify(credential));
      await this.bindAccount(account.address,credential);
      return account;
    } catch(error) {
      if(error instanceof Error&&error.message==="The selected passkey belongs to a different Pact signing account.")throw error;
      if(isMeraError(error)&&error.code==="PRF_UNAVAILABLE")throw new Error("This passkey provider cannot unlock your Pact signing account. Use the provider that holds your original Pact passkey.");
      throw new Error("Your Pact passkey could not be opened here. Use the same Pact website address and passkey provider, or choose the browser option to use a passkey from another device.");
    }
  }

  private async unlockCredential(credential:StoredCredential,expectedAddress:`0x${string}`):Promise<{address:`0x${string}`}> {
    try {
      const unlocked=await getPasskeyPrfOutput({rpId:passkeyRpId(),credential});
      const account=await this.withAccount(unlocked.prfOutput,async value=>({address:value.address}));
      if(account.address.toLowerCase()!==expectedAddress.toLowerCase())throw new Error("This device passkey does not match your Pact signing account.");
      return account;
    } catch(error) {
      if(error instanceof Error&&error.message==="This device passkey does not match your Pact signing account.")throw error;
      if(isMeraError(error)&&error.code==="PRF_UNAVAILABLE")throw new Error("This passkey provider cannot unlock your Pact signing account. Use the provider that holds your original Pact passkey.");
      throw new Error("Your Pact passkey could not be opened here. Use the same Pact website address and passkey provider, or choose the browser option to use a passkey from another device.");
    }
  }

  async signEventVault(userId:string,eventId:string,deadline:string) {
    const stored=JSON.parse(localStorage.getItem(credentialKey(userId.trim().toLowerCase()))??"null") as StoredCredential|null;
    if(!stored)throw new Error("Secure Pact account is not configured");
    const unlocked=await getPasskeyPrfOutput({rpId:passkeyRpId(),credential:stored});
    const address=process.env.NEXT_PUBLIC_PACT_EVENT_VAULT_FACTORY_ADDRESS as `0x${string}`|undefined;
    if(!address)throw new Error("Event vault factory is not configured");
    const chainId=Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID??10143);
    return this.withAccount(unlocked.prfOutput,async account=>({address:account.address,signature:await account.signTypedData({domain:eventVaultFactoryDomain(chainId,address),primaryType:"EventVaultAuthorization",types:eventVaultAuthorizationTypes,message:{eventId:canonicalBytes32(eventId),organizer:account.address,deadline:BigInt(Math.floor(new Date(deadline).getTime()/1000))}})}));
  }

  async signAllocation(userId:string,challenge:VaultExecutionChallenge) {
    return this.signVaultInstruction(userId,challenge,"EventAllocation");
  }

  async signPaymentRelease(userId:string,challenge:VaultExecutionChallenge) {
    if(!challenge.payoutAddress)throw new Error("The verified payout destination is missing");
    return this.signVaultInstruction(userId,challenge,"EventPaymentRelease");
  }

  async signWithdrawal(userId:string,transaction:MeraWithdrawalTransaction){
    const stored=JSON.parse(localStorage.getItem(credentialKey(userId.trim().toLowerCase()))??"null") as StoredCredential|null;
    if(!stored)throw new Error("Secure Pact account is not configured on this device");
    const unlocked=await getPasskeyPrfOutput({rpId:passkeyRpId(),credential:stored});
    return this.withAccount(unlocked.prfOutput,async account=>account.signTransaction({type:"eip1559",chainId:transaction.chainId,nonce:transaction.nonce,to:transaction.to,data:transaction.data,value:BigInt(transaction.value),gas:BigInt(transaction.gas),maxFeePerGas:BigInt(transaction.maxFeePerGas),maxPriorityFeePerGas:BigInt(transaction.maxPriorityFeePerGas)}));
  }

  async signAgreement(userId:string, agreement: PaymentAgreement, invoice: Invoice) {
    const stored = JSON.parse(localStorage.getItem(credentialKey(userId.trim().toLowerCase())) ?? "null") as StoredCredential | null;
    if (!stored) throw new Error("Secure Pact account is not configured");
    const unlocked = await getPasskeyPrfOutput({ rpId: passkeyRpId(), credential: stored });
    const registry=this.registry();if(!agreement.organizerAddress||!agreement.proposalExpiresAt)throw new Error("Agreement proposal is incomplete");
    const digest=proposalDigest(registry.chainId,registry.address,{agreementId:canonicalBytes32(agreement.id),eventId:canonicalBytes32(agreement.eventId),organizer:agreement.organizerAddress as `0x${string}`,agreementHash:agreement.agreementHash as `0x${string}`,scheduleHash:agreement.scheduleHash as `0x${string}`,currencyCode:currencyBytes32(agreement.currency),totalAmountMinor:BigInt(agreement.totalAmountMinor),expiry:BigInt(Math.floor(new Date(agreement.proposalExpiresAt).getTime()/1000))});
    return this.withAccount(unlocked.prfOutput, async (account) => ({address:account.address,signature:await account.signTypedData({domain:registryDomain(registry.chainId,registry.address),primaryType:"AgreementAcceptance",types:acceptanceTypes,message:{proposalDigest:digest,payee:account.address,invoiceHash:invoice.documentHash as `0x${string}`}})}));
  }

  async signProposal(userId:string, agreement: PaymentAgreement, expiresAt: string) {
    const stored = JSON.parse(localStorage.getItem(credentialKey(userId.trim().toLowerCase())) ?? "null") as StoredCredential | null;
    if (!stored) throw new Error("Secure Pact account is not configured");
    const unlocked = await getPasskeyPrfOutput({ rpId: passkeyRpId(), credential: stored });
    const registry=this.registry();return this.withAccount(unlocked.prfOutput, async (account) => ({address:account.address,signature:await account.signTypedData({domain:registryDomain(registry.chainId,registry.address),primaryType:"AgreementProposal",types:proposalTypes,message:{agreementId:canonicalBytes32(agreement.id),eventId:canonicalBytes32(agreement.eventId),organizer:account.address,agreementHash:agreement.agreementHash as `0x${string}`,scheduleHash:agreement.scheduleHash as `0x${string}`,currencyCode:currencyBytes32(agreement.currency),totalAmountMinor:BigInt(agreement.totalAmountMinor),expiry:BigInt(Math.floor(new Date(expiresAt).getTime()/1000))}})}));
  }

  private registry(){const address=process.env.NEXT_PUBLIC_PACT_AGREEMENT_REGISTRY_ADDRESS as `0x${string}`|undefined;if(!address)throw new Error("Agreement registry is not configured");return{address,chainId:Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID??10143)};}

  private async signVaultInstruction(userId:string,challenge:VaultExecutionChallenge,kind:"EventAllocation"|"EventPaymentRelease"){
    const stored=JSON.parse(localStorage.getItem(credentialKey(userId.trim().toLowerCase()))??"null") as StoredCredential|null;
    if(!stored)throw new Error("Secure Pact account is not configured");
    const unlocked=await getPasskeyPrfOutput({rpId:passkeyRpId(),credential:stored});
    const chainId=Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID??10143);
    return this.withAccount(unlocked.prfOutput,async account=>{
      if(account.address.toLowerCase()!==challenge.organizer.toLowerCase())throw new Error("This passkey does not control the event account");
      const common={agreementId:canonicalBytes32(challenge.agreementId),paymentId:canonicalBytes32(challenge.paymentId),amount:BigInt(challenge.amountAtomic),nonce:BigInt(challenge.nonce),deadline:BigInt(Math.floor(new Date(challenge.deadline).getTime()/1000))};
      const signature=kind==="EventAllocation"
        ?await account.signTypedData({domain:eventVaultDomain(chainId,challenge.vaultAddress),primaryType:"EventAllocation",types:eventAllocationTypes,message:common})
        :challenge.settlementMode==="aurora"&&challenge.payoutRouteQuoteId
          ?await account.signTypedData({domain:eventVaultDomain(chainId,challenge.vaultAddress),primaryType:"EventPaymentRoute",types:eventPaymentRouteTypes,message:{...common,routeId:canonicalBytes32(challenge.payoutRouteQuoteId),depositAddress:challenge.payoutAddress!}})
          :await account.signTypedData({domain:eventVaultDomain(chainId,challenge.vaultAddress),primaryType:"EventPaymentRelease",types:eventPaymentReleaseTypes,message:{...common,payoutAddress:challenge.payoutAddress!}});
      return{...challenge,signature};
    });
  }

  private async bindAccount(address:`0x${string}`,credential?:StoredCredential){const token=getAuthToken();if(!token)throw new Error("Your authenticated session is unavailable");const response=await fetch("/api/pact-account",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({address,credential})});if(!response.ok){const body=await response.json().catch(()=>({})) as {error?:string};throw new Error(body.error??"Pact could not bind your Mera account");}}

  private async withAccount<T>(prfOutput: Uint8Array, action: (account: ReturnType<typeof toViemAccount>) => Promise<T>): Promise<T> {
    const session = createSecp256k1SigningSession({ privateKey: privateKeyFromPrf(prfOutput) });
    try { return await action(toViemAccount(session)); } finally { session.end(); }
  }
}

export const pactAccountAdapter = new PactAccountAdapter();
