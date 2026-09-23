import test from "node:test";
import assert from "node:assert/strict";
import { discover, selectCandidates } from "./payment-spike.mjs";

const token = (blockchain, symbol, decimals = 6) => ({ assetId: `example:${blockchain}:${symbol}`, blockchain, symbol, decimals });

test("separates Monad settlement from the three intended funding candidates", () => {
  const result = selectCandidates([token("monad", "USDC"), token("monad", "USDT0"), token("monad", "MON", 18), token("base", "USDC"), token("eth", "ETH", 18), token("sol", "SOL", 9), token("other", "USDC")]);
  assert.deepEqual(result.settlementCandidates.map(t => t.symbol), ["USDC", "USDT0"]);
  assert.deepEqual(result.sourceCandidates.map(t => t.symbol), ["USDC", "ETH", "SOL"]);
});
test("rejects malformed provider responses", () => {
  for (const value of [{ tokens: [] }, [null], [token("monad", "USDC", -1)], [token("monad", "USDC", "6")]]) {
    assert.throws(() => selectCandidates(value));
  }
});
test("empty discovery does not invent a route", () => {
  assert.deepEqual(selectCandidates([]), { settlementCandidates: [], sourceCandidates: [] });
});
test("HTTP failures fail closed", async () => {
  await assert.rejects(discover(async () => ({ ok: false, status: 503 })), /503/);
});
test("discovery is read-only and reports catalog evidence only", async () => {
  const result = await discover(async (url, options) => {
    assert.equal(url, "https://1click.chaindefuser.com/v0/tokens");
    assert.equal(options.method, undefined);
    assert.ok(options.signal);
    return { ok: true, json: async () => [token("monad", "USDC")] };
  });
  assert.equal(result.evidenceLevel, "catalog-only");
});
