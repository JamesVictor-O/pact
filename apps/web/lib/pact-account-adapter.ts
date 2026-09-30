"use client";

import { createPasskeyWithPrfOutput, createSecp256k1SigningSession, getPasskeyPrfOutput } from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { hexToBytes, keccak256 } from "viem";

const CREDENTIAL_KEY = "pact.mera-credential.v1";
type StoredCredential = { credentialId: string; transports?: readonly string[] };

function privateKeyFromPrf(output: Uint8Array): Uint8Array { return hexToBytes(keccak256(output)); }

export class PactAccountAdapter {
  async setup(user: { name: string; email: string }) {
    const created = await createPasskeyWithPrfOutput({ rp: { id: window.location.hostname, name: "Pact" }, user: { name: user.email, displayName: user.name } });
    localStorage.setItem(CREDENTIAL_KEY, JSON.stringify({ credentialId: created.credentialId, transports: created.transports }));
    return this.withAccount(created.prfOutput, async (account) => ({ address: account.address }));
  }

  hasAccount(): boolean { return Boolean(localStorage.getItem(CREDENTIAL_KEY)); }

  async signAgreement(input: { agreementId: string; agreementHash: `0x${string}`; scheduleHash: `0x${string}`; invoiceHash: `0x${string}` }) {
    const stored = JSON.parse(localStorage.getItem(CREDENTIAL_KEY) ?? "null") as StoredCredential | null;
    if (!stored) throw new Error("Secure Pact account is not configured");
    const unlocked = await getPasskeyPrfOutput({ rpId: window.location.hostname, credential: stored });
    return this.withAccount(unlocked.prfOutput, async (account) => ({
      address: account.address,
      signature: await account.signTypedData({
        domain: { name: "Pact", version: "1", chainId: 10143 },
        primaryType: "AgreementAcceptance",
        types: { AgreementAcceptance: [{ name: "agreementId", type: "string" }, { name: "agreementHash", type: "bytes32" }, { name: "scheduleHash", type: "bytes32" }, { name: "invoiceHash", type: "bytes32" }] },
        message: input,
      }),
    }));
  }

  async signProposal(input: { agreementId: string; eventId: string; agreementHash: `0x${string}`; scheduleHash: `0x${string}`; currency: string; totalAmountMinor: number }) {
    const stored = JSON.parse(localStorage.getItem(CREDENTIAL_KEY) ?? "null") as StoredCredential | null;
    if (!stored) throw new Error("Secure Pact account is not configured");
    const unlocked = await getPasskeyPrfOutput({ rpId: window.location.hostname, credential: stored });
    return this.withAccount(unlocked.prfOutput, async (account) => ({ address: account.address, signature: await account.signTypedData({
      domain: { name: "PactAgreementRegistry", version: "1", chainId: 10143 }, primaryType: "AgreementProposal",
      types: { AgreementProposal: [{ name: "agreementId", type: "string" }, { name: "eventId", type: "string" }, { name: "agreementHash", type: "bytes32" }, { name: "scheduleHash", type: "bytes32" }, { name: "currency", type: "string" }, { name: "totalAmountMinor", type: "uint256" }] }, message: { ...input, totalAmountMinor: BigInt(input.totalAmountMinor) },
    }) }));
  }

  private async withAccount<T>(prfOutput: Uint8Array, action: (account: ReturnType<typeof toViemAccount>) => Promise<T>): Promise<T> {
    const session = createSecp256k1SigningSession({ privateKey: privateKeyFromPrf(prfOutput) });
    try { return await action(toViemAccount(session)); } finally { session.end(); }
  }
}

export const pactAccountAdapter = new PactAccountAdapter();
