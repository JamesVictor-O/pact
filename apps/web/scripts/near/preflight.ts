/**
 * NEAR canary preflight. Read-only: moves no funds.
 *
 *   cd apps/web
 *   node --env-file=.env.local --experimental-strip-types scripts/near/preflight.ts \
 *     --near-account <payee.near> --vault <0xNewFactoryEventVault> [--amount 1000000]
 *
 * 1. Aurora's token catalog lists native NEAR USDC (same catalog the payout settings page loads).
 * 2. The NEAR payee account exists (Aurora returns an opaque 500 for unknown accounts).
 * 3. The vault was created by the route-resolution factory (has a routeResolver).
 * 4. Dry-run quotes (dry: true) for every direction × confidentiality mode the canaries use.
 *
 * Writes evidence to docs/near-canary/preflight-<timestamp>.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createPublicClient, http, parseAbi, type Address } from "viem";
import { nearAccountExists } from "../../lib/near-delivery.ts";

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((pairs, value, index, all) => (value.startsWith("--") ? [...pairs, [value.slice(2), all[index + 1]]] : pairs), []));
const nearAccount = args["near-account"];
const vault = args.vault as Address | undefined;
const amount = args.amount ?? "1000000";
if (!nearAccount || !vault) { console.error("Usage: preflight.ts --near-account <payee.near> --vault <0xEventVault> [--amount 1000000]"); process.exit(1); }

const key = process.env.AURORA_INTENTS_API_KEY;
const base = (process.env.AURORA_INTENTS_BASE_URL ?? "https://intents-api.aurora.dev").replace(/\/$/, "");
const monadUsdc = process.env.AURORA_PAYOUT_ORIGIN_ASSET_ID;
if (!key || !monadUsdc) { console.error("AURORA_INTENTS_API_KEY and AURORA_PAYOUT_ORIGIN_ASSET_ID are required"); process.exit(1); }
const NEAR_USDC = "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
const evidence: Record<string, unknown> = { ranAt: new Date().toISOString(), nearAccount, vault, amountAtomic: amount };
const pass = (label: string, ok: boolean, detail?: unknown) => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : `  ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`); return ok; };

// 1. Catalog
const catalog = await (await fetch(`${base}/api/tokens/${encodeURIComponent(key)}`)).json() as { tokens: Array<{ assetId: string; blockchain: string; symbol: string; decimals: number; contractAddress?: string }> };
const nearUsdc = catalog.tokens.find(token => token.assetId === NEAR_USDC);
const monad = catalog.tokens.find(token => token.assetId === monadUsdc);
evidence.catalog = { size: catalog.tokens.length, nearUsdc, monadUsdc: monad };
pass("Aurora catalog lists NEAR USDC", Boolean(nearUsdc && nearUsdc.blockchain === "near" && nearUsdc.decimals === 6), nearUsdc?.assetId);
pass("Aurora catalog lists Monad USDC origin", Boolean(monad?.contractAddress?.toLowerCase() === process.env.PACT_SETTLEMENT_TOKEN_ADDRESS?.toLowerCase()), monad?.contractAddress);

// 2. NEAR account
const exists = await nearAccountExists(nearAccount);
evidence.nearAccountExists = exists;
pass(`NEAR account ${nearAccount} exists`, exists);

// 3. Vault from the route-resolution factory (provenance via the factory registry, not just a getter)
if (process.env.MONAD_RPC_URL && process.env.PACT_EVENT_VAULT_FACTORY_ADDRESS) {
  const client = createPublicClient({ transport: http(process.env.MONAD_RPC_URL) });
  const factory = process.env.PACT_EVENT_VAULT_FACTORY_ADDRESS as Address;
  try {
    const eventId = await client.readContract({ address: vault, abi: parseAbi(["function eventId() view returns(bytes32)"]), functionName: "eventId" });
    const registered = await client.readContract({ address: factory, abi: parseAbi(["function eventVaults(bytes32) view returns(address)"]), functionName: "eventVaults", args: [eventId] });
    const resolver = await client.readContract({ address: vault, abi: parseAbi(["function routeResolver() view returns(address)"]), functionName: "routeResolver" });
    evidence.vault = { factory, eventId, registered, resolver };
    pass(`Vault was created by the route-resolution factory ${factory}`, registered.toLowerCase() === vault.toLowerCase(), registered);
  } catch (error) {
    evidence.vault = null;
    pass("Vault was created by the route-resolution factory", false, error instanceof Error ? error.message.split("\n")[0] : String(error));
  }
}

// 4. Dry-run quotes
const deadline = new Date(Date.now() + 20 * 60 * 1000).toISOString();
const quotes: Record<string, unknown> = {};
for (const direction of ["outbound", "inbound"] as const) {
  for (const confidentiality of ["public", "basic", "advanced"] as const) {
    const body = direction === "outbound"
      ? { originAsset: monadUsdc, destinationAsset: NEAR_USDC, refundTo: vault, recipient: nearAccount }
      : { originAsset: NEAR_USDC, destinationAsset: monadUsdc, refundTo: nearAccount, recipient: vault };
    const response = await fetch(`${base}/api/quote/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dry: true, swapType: "EXACT_INPUT", depositType: "ORIGIN_CHAIN", refundType: "ORIGIN_CHAIN", recipientType: "DESTINATION_CHAIN", amount, slippageTolerance: 100, deadline, confidentiality, ...body }),
    });
    const json = await response.json() as { quote?: { amountOut: string; amountOutFormatted: string; minAmountOut: string; timeEstimate: number }; message?: string; correlationId?: string };
    const label = `${direction} ${direction === "outbound" ? "Monad USDC → NEAR USDC" : "NEAR USDC → Monad USDC"} [${confidentiality}]`;
    quotes[`${direction}_${confidentiality}`] = { http: response.status, correlationId: json.correlationId, ...json.quote, error: json.message };
    pass(`dry quote ${label}`, response.ok && Boolean(json.quote), json.quote ? `out ${json.quote.amountOutFormatted} (min ${json.quote.minAmountOut}) ~${json.quote.timeEstimate}s` : json.message);
  }
}
evidence.dryQuotes = quotes;

const dir = new URL("../../../../docs/near-canary/", import.meta.url);
mkdirSync(dir, { recursive: true });
const file = new URL(`preflight-${evidence.ranAt as string}.json`.replaceAll(":", "-"), dir);
writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`\nEvidence written to ${file.pathname}`);
