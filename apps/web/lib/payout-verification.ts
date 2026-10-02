import { getAddress } from "viem";

export function payoutVerificationMessage(input:{agreementId:string;userId:string;address:string;chainId:number}) {
  return [
    "Verify this wallet as a Pact payout destination.",
    "",
    `Agreement: ${input.agreementId}`,
    `Pact user: ${input.userId}`,
    `Network chain ID: ${input.chainId}`,
    `Payout address: ${getAddress(input.address)}`,
    "",
    "This does not send a transaction or grant spending permission.",
  ].join("\n");
}
