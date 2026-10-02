import assert from "node:assert/strict";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";
import { payoutVerificationMessage } from "./payout-verification.ts";

test("payout proof is bound to agreement, user, network, and checksum address", async () => {
  const account=privateKeyToAccount("0x0123456789012345678901234567890123456789012345678901234567890123");
  const message=payoutVerificationMessage({agreementId:"agreement_123",userId:"user_456",address:account.address.toLowerCase(),chainId:10143});
  assert.match(message,/Agreement: agreement_123/);
  assert.match(message,/Pact user: user_456/);
  assert.match(message,/Network chain ID: 10143/);
  assert.match(message,new RegExp(`Payout address: ${account.address}`));
  assert.match(message,/does not send a transaction or grant spending permission/);
  const signature=await account.signMessage({message});
  assert.equal(await verifyMessage({address:account.address,message,signature}),true);
  assert.equal(await verifyMessage({address:account.address,message:message.replace("agreement_123","agreement_999"),signature}),false);
});
