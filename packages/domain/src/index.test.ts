import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainInvariantError,
  allocate,
  availableFunds,
  calculateCoverage,
  fundingState,
  obligationState,
  releasePayment,
} from "./index.ts";

test("commitments are not treated as available cash", () => {
  const funding = { committed: 10_000n, received: 4_000n, allocated: 1_500n };

  assert.equal(availableFunds(funding), 2_500n);
  assert.equal(fundingState(funding), "received");
});

test("allocation updates both ledgers without mutating inputs", () => {
  const funding = { committed: 10_000n, received: 6_000n, allocated: 1_000n };
  const obligation = { amount: 5_000n, allocated: 1_000n, paid: 0n };
  const result = allocate(funding, obligation, 4_000n);

  assert.deepEqual(result.funding, { committed: 10_000n, received: 6_000n, allocated: 5_000n });
  assert.deepEqual(result.obligation, { amount: 5_000n, allocated: 5_000n, paid: 0n });
  assert.equal(obligationState(result.obligation), "funded");
  assert.equal(funding.allocated, 1_000n);
});

test("allocation cannot spend commitments that have not arrived", () => {
  assert.throws(
    () =>
      allocate(
        { committed: 10_000n, received: 2_000n, allocated: 0n },
        { amount: 5_000n, allocated: 0n, paid: 0n },
        3_000n,
      ),
    (error) => error instanceof DomainInvariantError && error.code === "INSUFFICIENT_AVAILABLE_FUNDS",
  );
});

test("payments cannot exceed allocated funds", () => {
  assert.throws(
    () => releasePayment({ amount: 5_000n, allocated: 2_000n, paid: 500n }, 1_501n),
    (error) => error instanceof DomainInvariantError && error.code === "PAYMENT_EXCEEDS_ALLOCATION",
  );
});

test("obligation follows the full coverage lifecycle", () => {
  assert.equal(obligationState({ amount: 5_000n, allocated: 0n, paid: 0n }), "unfunded");
  assert.equal(obligationState({ amount: 5_000n, allocated: 2_000n, paid: 0n }), "partially_funded");
  assert.equal(obligationState({ amount: 5_000n, allocated: 5_000n, paid: 0n }), "funded");
  assert.equal(obligationState({ amount: 5_000n, allocated: 5_000n, paid: 5_000n }), "paid");
});

test("coverage exposes received availability and the remaining gap", () => {
  const coverage = calculateCoverage(
    [
      { committed: 20_000n, received: 13_000n, allocated: 9_000n },
      { committed: 10_000n, received: 0n, allocated: 0n },
    ],
    [
      { amount: 16_500n, allocated: 9_000n, paid: 3_000n },
      { amount: 13_500n, allocated: 0n, paid: 0n },
    ],
  );

  assert.deepEqual(coverage, {
    committed: 30_000n,
    received: 13_000n,
    available: 4_000n,
    obligations: 30_000n,
    allocated: 9_000n,
    paid: 3_000n,
    uncovered: 21_000n,
  });
});
