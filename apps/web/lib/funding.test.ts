import assert from "node:assert/strict";
import test from "node:test";
import { formatEventCurrency, formatMinorCurrency, getFundingSourceStatus, getFundingSummary } from "./funding.ts";
import type { FundingSource } from "./pact-types.ts";

function source(overrides: Partial<FundingSource> = {}): FundingSource {
  return {
    id: "funding_1",
    eventId: "event_1",
    type: "sponsor",
    name: "Northstar Studios",
    committedAmount: 10_000,
    receivedAmount: 0,
    expectedDate: "2026-10-04",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

test("funding status is derived from financial state and expected date", () => {
  const beforeDueDate = new Date("2026-09-29T12:00:00Z");
  const afterDueDate = new Date("2026-10-05T12:00:00Z");

  assert.equal(getFundingSourceStatus(source(), beforeDueDate), "expected");
  assert.equal(getFundingSourceStatus(source({ receivedAmount: 4_000 }), beforeDueDate), "partially_received");
  assert.equal(getFundingSourceStatus(source({ receivedAmount: 10_000 }), beforeDueDate), "received");
  assert.equal(getFundingSourceStatus(source(), afterDueDate), "overdue");
  assert.equal(getFundingSourceStatus(source({ cancelledAt: "2026-09-20T00:00:00.000Z" }), beforeDueDate), "cancelled");
  assert.equal(getFundingSourceStatus(source({ committedAmount: 0, receivedAmount: 25, openContributions: true }), beforeDueDate), "open");
});

test("funding summary separates commitments, receipts, expected, and available", () => {
  const summary = getFundingSummary([
    source({ id: "one", committedAmount: 10_000, receivedAmount: 4_000 }),
    source({ id: "two", committedAmount: 5_000, receivedAmount: 5_000 }),
  ], { allocated: 2_000, released: 1_000 });

  assert.deepEqual(summary, {
    committed: 15_000,
    received: 9_000,
    stillExpected: 6_000,
    available: 6_000,
    allocated: 2_000,
    released: 1_000,
  });
});

test("cancelled commitments stop being expected without erasing received cash", () => {
  const summary = getFundingSummary([
    source({ committedAmount: 10_000, receivedAmount: 3_000, cancelledAt: "2026-09-20T00:00:00.000Z" }),
  ]);

  assert.equal(summary.committed, 0);
  assert.equal(summary.received, 3_000);
  assert.equal(summary.stillExpected, 0);
  assert.equal(summary.available, 3_000);
});

test("currency formatting preserves cents across major and minor units", () => {
  assert.equal(formatEventCurrency(0.03, "USD"), "$0.03");
  assert.equal(formatEventCurrency(0, "USD"), "$0.00");
  assert.equal(formatEventCurrency(-0, "USD"), "$0.00");
  assert.equal(formatEventCurrency(0.004, "USD"), "<$0.01");
  assert.equal(formatEventCurrency(1_000, "USD"), "$1,000.00");
  assert.equal(formatMinorCurrency(3, "USD"), "$0.03");
  assert.equal(formatMinorCurrency(100_050, "USD"), "$1,000.50");
});
