import assert from "node:assert/strict";
import test from "node:test";
import { settlementMinorCredit } from "./settlement-amounts.ts";

test("credits whole cents and preserves a fractional USDC remainder", () => {
  assert.deepEqual(
    settlementMinorCredit({
      existingAtomic: BigInt(0),
      existingMinor: BigInt(0),
      incomingAtomic: BigInt(35_305),
      tokenDecimals: 6,
    }),
    { creditedMinor: BigInt(3), totalMinorAfter: BigInt(3), remainderAtomic: BigInt(5_305) },
  );
});

test("later deposits combine with the retained remainder", () => {
  assert.deepEqual(
    settlementMinorCredit({
      existingAtomic: BigInt(35_305),
      existingMinor: BigInt(3),
      incomingAtomic: BigInt(4_695),
      tokenDecimals: 6,
    }),
    { creditedMinor: BigInt(1), totalMinorAfter: BigInt(4), remainderAtomic: BigInt(0) },
  );
});

test("records a sub-cent receipt without overstating available funds", () => {
  assert.deepEqual(
    settlementMinorCredit({
      existingAtomic: BigInt(0),
      existingMinor: BigInt(0),
      incomingAtomic: BigInt(5_000),
      tokenDecimals: 6,
    }),
    { creditedMinor: BigInt(0), totalMinorAfter: BigInt(0), remainderAtomic: BigInt(5_000) },
  );
});
