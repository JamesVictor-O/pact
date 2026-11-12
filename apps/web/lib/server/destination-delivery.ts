import "server-only";
import { payoutChainFamily } from "../payout-destinations";
import { findNearDeliveryCandidates, nearTokenContract, verifyNearDeliveryOnChain, type NearDeliveryEvidence } from "../near-delivery";
import { oneOrNull } from "./database";

export type DeliveryRoute = {
  id: string;
  destination_chain: string;
  destination_asset_id: string;
  recipient_address: string;
  minimum_amount_out_atomic: string;
  amount_out_atomic: string;
  confidentiality?: string | null;
  created_at?: Date;
};

export type DestinationDecision =
  | { delivered: true; hash: string; explorerUrl: string | null; evidence: NearDeliveryEvidence | null }
  | { delivered: false; reason: string };

function nearRpcUrls() {
  return process.env.NEAR_RPC_URLS?.split(",").map(url => url.trim()).filter(Boolean);
}

async function claimedByAnotherRoute(routeId: string, chain: string, hash: string) {
  return Boolean(await oneOrNull(`select 1 from payout_route_quotes where destination_chain=$1 and destination_transaction_hash=$2 and id<>$3`, [chain, hash, routeId]));
}

/**
 * Decide whether a routed payout has actually arrived on its destination chain.
 *
 * NEAR destinations are re-checked on public NEAR RPC (receiver, NEP-141 token,
 * amount ≥ quoted minimum, finality). Aurora's reported hash is treated as a
 * hint; when Aurora withholds hashes (Private routes) Pact discovers incoming
 * transfers to the payee and verifies them the same way.
 *
 * Other destination families keep the previous rule: Aurora must report a
 * destination transaction hash. Private routing is only offered for NEAR
 * destinations, where Pact can verify delivery without Aurora's hash.
 */
export async function decideDestinationDelivery(route: DeliveryRoute, reported: Array<{ hash: string; explorerUrl?: string }>): Promise<DestinationDecision> {
  if (payoutChainFamily(route.destination_chain) !== "near") {
    const first = reported[0];
    if (!first?.hash) return { delivered: false, reason: "Aurora reports success without destination transaction evidence" };
    return { delivered: true, hash: first.hash, explorerUrl: first.explorerUrl ?? null, evidence: null };
  }

  const tokenContract = nearTokenContract(route.destination_asset_id);
  if (!tokenContract) return { delivered: false, reason: `Unsupported NEAR payout asset ${route.destination_asset_id}` };
  const expected = { recipient: route.recipient_address, tokenContract, minimumAmountAtomic: route.minimum_amount_out_atomic };

  const reportedHashes = reported.map(item => item.hash).filter(Boolean);
  const discovered = reportedHashes.length === 0;
  let candidates = reportedHashes;
  if (discovered) {
    // Private (confidential) routes: Aurora withholds hashes. Look at what the payee actually received.
    const since = new Date((route.created_at ?? new Date(Date.now() - 24 * 60 * 60 * 1000)).getTime() - 60_000);
    candidates = await findNearDeliveryCandidates({ recipient: route.recipient_address, tokenContract, since });
    if (candidates.length === 0) return { delivered: false, reason: "No USDC delivery to the payee's NEAR account is visible yet" };
  }

  // Discovered transfers must also fit the quote: no more than 2% above the quoted output.
  const ceiling = (BigInt(route.amount_out_atomic) * BigInt(102)) / BigInt(100);
  const reasons: string[] = [];
  const verified: NearDeliveryEvidence[] = [];
  for (const hash of candidates) {
    if (await claimedByAnotherRoute(route.id, route.destination_chain, hash)) { reasons.push(`${hash} already settles another payment`); continue; }
    const result = await verifyNearDeliveryOnChain(hash, expected, { rpcUrls: nearRpcUrls() });
    if (!result.verified) { reasons.push(result.reason); continue; }
    if (discovered && BigInt(result.amountAtomic) > ceiling) { reasons.push(`${hash} is larger than this payout's quote`); continue; }
    verified.push(result);
    if (!discovered) break;
  }
  if (verified.length === 1) return { delivered: true, hash: verified[0].transactionHash, explorerUrl: verified[0].explorerUrl, evidence: verified[0] };
  // Same rule as inbound attribution: never guess which transfer belongs to which payment.
  if (verified.length > 1) return { delivered: false, reason: "More than one NEAR transfer matches this private payout; Pact will not guess which one settles it" };
  return { delivered: false, reason: `NEAR delivery could not be verified: ${reasons.join("; ")}`.slice(0, 500) };
}
