import { hashTypedData, keccak256, stringToHex, toBytes, type Address, type Hex } from "viem";

export const REGISTRY_DOMAIN_NAME = "PactAgreementRegistry";
export const REGISTRY_DOMAIN_VERSION = "1";
export const EVENT_VAULT_FACTORY_DOMAIN_NAME = "PactEventVaultFactory";

export function canonicalBytes32(value: string): Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value) ? value as Hex : keccak256(toBytes(value));
}

export function currencyBytes32(currency: string): Hex {
  return stringToHex(currency.toUpperCase(), { size: 32 });
}

export const proposalTypes = {
  AgreementProposal: [
    { name: "agreementId", type: "bytes32" }, { name: "eventId", type: "bytes32" },
    { name: "organizer", type: "address" }, { name: "agreementHash", type: "bytes32" },
    { name: "scheduleHash", type: "bytes32" }, { name: "currencyCode", type: "bytes32" },
    { name: "totalAmountMinor", type: "uint256" }, { name: "expiry", type: "uint64" },
  ],
} as const;

export const acceptanceTypes = {
  AgreementAcceptance: [
    { name: "proposalDigest", type: "bytes32" }, { name: "payee", type: "address" },
    { name: "invoiceHash", type: "bytes32" },
  ],
} as const;

export const eventVaultAuthorizationTypes = {
  EventVaultAuthorization: [
    { name: "eventId", type: "bytes32" },
    { name: "organizer", type: "address" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

export function eventVaultFactoryDomain(chainId: number, verifyingContract: Address) {
  return { name: EVENT_VAULT_FACTORY_DOMAIN_NAME, version: "1", chainId, verifyingContract } as const;
}

export function registryDomain(chainId: number, verifyingContract: Address) {
  return { name: REGISTRY_DOMAIN_NAME, version: REGISTRY_DOMAIN_VERSION, chainId, verifyingContract } as const;
}

export type ProposalMessage = {
  agreementId: Hex; eventId: Hex; organizer: Address; agreementHash: Hex; scheduleHash: Hex;
  currencyCode: Hex; totalAmountMinor: bigint; expiry: bigint;
};

export function proposalDigest(chainId: number, registry: Address, message: ProposalMessage): Hex {
  return hashTypedData({ domain: registryDomain(chainId, registry), types: proposalTypes, primaryType: "AgreementProposal", message });
}
