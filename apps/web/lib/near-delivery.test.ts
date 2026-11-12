import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { findNearDeliveryCandidates, nearTokenContract, verifyNearFtDelivery, type NearTransactionStatus } from "./near-delivery.ts";

// Real mainnet NEAR Intents (1Click) withdrawal of native NEAR USDC, fetched from
// archival RPC: tx rwpTRU1Tx27AQ3q1eJGua5bNUT6LAg3HHxesXoHbWMV → irisout.near, 148.691319 USDC.
const fixture = JSON.parse(readFileSync(new URL("./fixtures/near-usdc-intents-withdrawal.json", import.meta.url), "utf8")) as NearTransactionStatus;
const USDC = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
const expected = { recipient: "irisout.near", tokenContract: USDC, minimumAmountAtomic: "148000000" };
const clone = () => structuredClone(fixture);

test("verifies a real NEAR Intents USDC delivery", () => {
  const result = verifyNearFtDelivery(fixture, expected);
  assert.equal(result.verified, true);
  if (!result.verified) return;
  assert.equal(result.amountAtomic, "148691319");
  assert.equal(result.transactionHash, "rwpTRU1Tx27AQ3q1eJGua5bNUT6LAg3HHxesXoHbWMV");
  assert.equal(result.receiptIds.length, 1);
});

test("rejects a delivery to a different NEAR account", () => {
  const result = verifyNearFtDelivery(fixture, { ...expected, recipient: "someone-else.near" });
  assert.equal(result.verified, false);
});

test("rejects the wrong token contract", () => {
  assert.equal(verifyNearFtDelivery(fixture, { ...expected, tokenContract: "usdt.tether-token.near" }).verified, false);
});

test("rejects an amount below the quoted minimum", () => {
  const result = verifyNearFtDelivery(fixture, { ...expected, minimumAmountAtomic: "148691320" });
  assert.equal(result.verified, false);
  if (!result.verified) assert.match(result.reason, /below the quoted minimum/);
});

test("rejects transfers that did not come from NEAR Intents", () => {
  assert.equal(verifyNearFtDelivery(fixture, { ...expected, senders: ["attacker.near"] }).verified, false);
});

test("rejects a forged event logged by a contract other than the token", () => {
  const tx = clone();
  for (const receipt of tx.receipts_outcome) if (receipt.outcome.executor_id === USDC) receipt.outcome.executor_id = "fake-usdc.near";
  assert.equal(verifyNearFtDelivery(tx, expected).verified, false);
});

test("rejects a failed token receipt", () => {
  const tx = clone();
  for (const receipt of tx.receipts_outcome) if (receipt.outcome.executor_id === USDC) receipt.outcome.status = { Failure: {} };
  assert.equal(verifyNearFtDelivery(tx, expected).verified, false);
});

test("rejects a transaction that is not final", () => {
  assert.equal(verifyNearFtDelivery({ ...clone(), final_execution_status: "EXECUTED_OPTIMISTIC" }, expected).verified, false);
});

test("nets out a transfer-call refund back to NEAR Intents", () => {
  const tx = clone();
  const delivery = tx.receipts_outcome.find(receipt => receipt.outcome.executor_id === USDC)!;
  delivery.outcome.logs.push(`EVENT_JSON:${JSON.stringify({ standard: "nep141", version: "1.0.0", event: "ft_transfer", data: [{ old_owner_id: "irisout.near", new_owner_id: "intents.near", amount: "1000000" }] })}`);
  const result = verifyNearFtDelivery(tx, { ...expected, minimumAmountAtomic: "147000000" });
  assert.equal(result.verified, true);
  if (result.verified) assert.equal(result.amountAtomic, "147691319");
  assert.equal(verifyNearFtDelivery(tx, expected).verified, false);
});

test("maps NEP-141 asset IDs to token contracts", () => {
  assert.equal(nearTokenContract(`nep141:${USDC}`), USDC);
  assert.equal(nearTokenContract("nep245:v2_1.omni.hot.tg:143_2dmLwYWkCQKyTjeUPAsGJuiVLbFx"), null);
});

test("discovers only incoming USDC from NEAR Intents after the route started", async () => {
  const since = new Date("2026-11-01T00:00:00Z");
  const ns = (iso: string) => (BigInt(new Date(iso).getTime()) * BigInt(1_000_000)).toString();
  const row = (hash: string, patch: Record<string, unknown>) => ({ transaction_hash: hash, affected_account_id: "payee.near", involved_account_id: "intents.near", delta_amount: "1000000", cause: "TRANSFER", block_timestamp: ns("2026-11-02T00:00:00Z"), ft: { contract: USDC }, ...patch });
  const good = "rwpTRU1Tx27AQ3q1eJGua5bNUT6LAg3HHxesXoHbWMV";
  const fetcher = (async () => new Response(JSON.stringify({ txns: [
    row(good, {}),
    row("GwJYWm56AmM6Dx3wx5X7jtM9oxtmZ7QUJS4dKKs4gNt9", { block_timestamp: ns("2026-10-01T00:00:00Z") }),
    row("RFHHj55EKMJBAU7oNUmQVVGCq2ssiNe9NKwY4g3LsQY", { ft: { contract: "usdt.tether-token.near" } }),
    row("BERgZogoTUb3tK3JLHRS647j2xG6hdkwoSvRhMVveVfW", { delta_amount: "-5" }),
    row("7gn2oo4eVNkCYXJiMuawrmsmjqA2L3x63QVVHrtcMqnC", { involved_account_id: "random.near" }),
  ] }))) as typeof fetch;
  assert.deepEqual(await findNearDeliveryCandidates({ recipient: "payee.near", tokenContract: USDC, since }, { fetcher }), [good]);
});
