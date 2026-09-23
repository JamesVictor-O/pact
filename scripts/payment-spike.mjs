import { pathToFileURL } from "node:url";

export const TOKEN_CATALOG = "https://1click.chaindefuser.com/v0/tokens";

// Catalog presence is not proof of route liquidity or token authenticity.
export function selectCandidates(tokens) {
  if (!Array.isArray(tokens)) throw new Error("Expected a token catalog array");
  for (const token of tokens) {
    if (!token || typeof token.assetId !== "string" ||
        typeof token.blockchain !== "string" || typeof token.symbol !== "string" ||
        !Number.isInteger(token.decimals) || token.decimals < 0 || token.decimals > 255) {
      throw new Error("Unexpected token catalog schema");
    }
  }
  const summarize = ({ assetId, blockchain, symbol, decimals, contractAddress }) =>
    ({ assetId, blockchain, symbol, decimals, ...(contractAddress ? { contractAddress } : {}) });
  return {
    settlementCandidates: tokens.filter(t => t.blockchain === "monad" && ["USDC", "USDT0"].includes(t.symbol)).map(summarize),
    sourceCandidates: tokens.filter(t =>
      (t.blockchain === "base" && t.symbol === "USDC") ||
      (t.blockchain === "eth" && t.symbol === "ETH") ||
      (t.blockchain === "sol" && t.symbol === "SOL")).map(summarize),
  };
}

export async function discover(fetcher = fetch) {
  const response = await fetcher(TOKEN_CATALOG, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Catalog returned HTTP ${response.status}`);
  return {
    observedAt: new Date().toISOString(),
    source: TOKEN_CATALOG,
    provider: "NEAR Intents 1Click; Aurora adapter not yet confirmed",
    evidenceLevel: "catalog-only",
    ...selectCandidates(await response.json()),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  discover().then(report => console.log(JSON.stringify(report, null, 2)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
