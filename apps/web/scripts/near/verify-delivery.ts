/**
 * Re-check a NEAR delivery on public RPC, exactly as Pact does before marking a payout paid.
 *
 *   node --experimental-strip-types scripts/near/verify-delivery.ts <txHash> <recipient.near> <minimumAtomic> [tokenContract]
 *
 * Or discover candidates for a Private payout (Aurora withholds hashes):
 *
 *   node --experimental-strip-types scripts/near/verify-delivery.ts --discover <recipient.near> <sinceISO> <minimumAtomic>
 */
import { findNearDeliveryCandidates, verifyNearDeliveryOnChain } from "../../lib/near-delivery.ts";

const NEAR_USDC = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
const argv = process.argv.slice(2);

if (argv[0] === "--discover") {
  const [, recipient, since, minimum, token = NEAR_USDC] = argv;
  if (!recipient || !since || !minimum) { console.error("Usage: --discover <recipient.near> <sinceISO> <minimumAtomic>"); process.exit(1); }
  const candidates = await findNearDeliveryCandidates({ recipient, tokenContract: token, since: new Date(since) });
  console.log(`Candidates since ${since}: ${candidates.length}`);
  for (const hash of candidates) console.log(JSON.stringify(await verifyNearDeliveryOnChain(hash, { recipient, tokenContract: token, minimumAmountAtomic: minimum })));
} else {
  const [hash, recipient, minimum, token = NEAR_USDC] = argv;
  if (!hash || !recipient || !minimum) { console.error("Usage: <txHash> <recipient.near> <minimumAtomic> [tokenContract]"); process.exit(1); }
  const result = await verifyNearDeliveryOnChain(hash, { recipient, tokenContract: token, minimumAmountAtomic: minimum });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.verified ? 0 : 2);
}
