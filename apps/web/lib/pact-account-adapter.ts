"use client";

import { createPasskeyWithPrfOutput, createSecp256k1SigningSession, getPasskeyPrfOutput } from "@category-labs/mera";
import { getAuthToken } from "@dynamic-labs/sdk-react-core";
import { toViemAccount } from "@category-labs/mera/viem";
import { hexToBytes, keccak256 } from "viem";
import { acceptanceTypes, canonicalBytes32, currencyBytes32, proposalDigest, proposalTypes, registryDomain } from "./agreement-typed-data";
import type { Invoice, PaymentAgreement } from "./pact-types";

const LEGACY_CREDENTIAL_KEY = "pact.mera-credential.v1";
const credentialKey = (userId:string) => `pact.mera-credential.v2:${userId}`;
type StoredCredential = { credentialId: string; transports?: readonly string[] };

function privateKeyFromPrf(output: Uint8Array): Uint8Array { return hexToBytes(keccak256(output)); }

export class PactAccountAdapter {
  async setup(user: { name: string; email: string }) {
    const created = await createPasskeyWithPrfOutput({ rp: { id: window.location.hostname, name: "Pact" }, user: { name: user.email, displayName: user.name } });
    localStorage.setItem(credentialKey(user.email.trim().toLowerCase()), JSON.stringify({ credentialId: created.credentialId, transports: created.transports }));
    return this.withAccount(created.prfOutput, async (account) => ({ address: account.address }));
  }

  async ensureAccount(user: { id:string;name:string;email:string }):Promise<void> {const key=credentialKey(user.email.trim().toLowerCase());if(localStorage.getItem(key))return;const legacy=localStorage.getItem(LEGACY_CREDENTIAL_KEY);if(legacy){const token=getAuthToken();if(token){const response=await fetch("/api/pact-account",{headers:{authorization:`Bearer ${token}`},cache:"no-store"});if(response.ok){const {account}=await response.json() as {account:{signingAddress:string}|null};if(account){localStorage.setItem(key,legacy);return;}}}}await this.setup(user);}

  async signAgreement(userId:string, agreement: PaymentAgreement, invoice: Invoice) {
    const stored = JSON.parse(localStorage.getItem(credentialKey(userId.trim().toLowerCase())) ?? "null") as StoredCredential | null;
    if (!stored) throw new Error("Secure Pact account is not configured");
    const unlocked = await getPasskeyPrfOutput({ rpId: window.location.hostname, credential: stored });
    const registry=this.registry();if(!agreement.organizerAddress||!agreement.proposalExpiresAt)throw new Error("Agreement proposal is incomplete");
    const digest=proposalDigest(registry.chainId,registry.address,{agreementId:canonicalBytes32(agreement.id),eventId:canonicalBytes32(agreement.eventId),organizer:agreement.organizerAddress as `0x${string}`,agreementHash:agreement.agreementHash as `0x${string}`,scheduleHash:agreement.scheduleHash as `0x${string}`,currencyCode:currencyBytes32(agreement.currency),totalAmountMinor:BigInt(agreement.totalAmountMinor),expiry:BigInt(Math.floor(new Date(agreement.proposalExpiresAt).getTime()/1000))});
    return this.withAccount(unlocked.prfOutput, async (account) => ({address:account.address,signature:await account.signTypedData({domain:registryDomain(registry.chainId,registry.address),primaryType:"AgreementAcceptance",types:acceptanceTypes,message:{proposalDigest:digest,payee:account.address,invoiceHash:invoice.documentHash as `0x${string}`}})}));
  }

  async signProposal(userId:string, agreement: PaymentAgreement, expiresAt: string) {
    const stored = JSON.parse(localStorage.getItem(credentialKey(userId.trim().toLowerCase())) ?? "null") as StoredCredential | null;
    if (!stored) throw new Error("Secure Pact account is not configured");
    const unlocked = await getPasskeyPrfOutput({ rpId: window.location.hostname, credential: stored });
    const registry=this.registry();return this.withAccount(unlocked.prfOutput, async (account) => ({address:account.address,signature:await account.signTypedData({domain:registryDomain(registry.chainId,registry.address),primaryType:"AgreementProposal",types:proposalTypes,message:{agreementId:canonicalBytes32(agreement.id),eventId:canonicalBytes32(agreement.eventId),organizer:account.address,agreementHash:agreement.agreementHash as `0x${string}`,scheduleHash:agreement.scheduleHash as `0x${string}`,currencyCode:currencyBytes32(agreement.currency),totalAmountMinor:BigInt(agreement.totalAmountMinor),expiry:BigInt(Math.floor(new Date(expiresAt).getTime()/1000))}})}));
  }

  private registry(){const address=process.env.NEXT_PUBLIC_PACT_AGREEMENT_REGISTRY_ADDRESS as `0x${string}`|undefined;if(!address)throw new Error("Agreement registry is not configured");return{address,chainId:Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID??10143)};}

  private async withAccount<T>(prfOutput: Uint8Array, action: (account: ReturnType<typeof toViemAccount>) => Promise<T>): Promise<T> {
    const session = createSecp256k1SigningSession({ privateKey: privateKeyFromPrf(prfOutput) });
    try { return await action(toViemAccount(session)); } finally { session.end(); }
  }
}

export const pactAccountAdapter = new PactAccountAdapter();
