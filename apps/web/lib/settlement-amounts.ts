export type SettlementMinorCredit = {
  creditedMinor: bigint;
  totalMinorAfter: bigint;
  remainderAtomic: bigint;
};

/**
 * Converts settlement-token atomic units into event-currency minor units
 * without ever overstating received funds. Any sub-cent remainder stays in
 * the atomic ledger and contributes to the next receipt for this request.
 */
export function settlementMinorCredit(input: {
  existingAtomic: bigint;
  existingMinor: bigint;
  incomingAtomic: bigint;
  tokenDecimals: number;
}): SettlementMinorCredit {
  const { existingAtomic, existingMinor, incomingAtomic, tokenDecimals } = input;
  if (!Number.isInteger(tokenDecimals) || tokenDecimals < 2) {
    throw new Error("Settlement token must support currency minor units");
  }
  if (existingAtomic < BigInt(0) || existingMinor < BigInt(0) || incomingAtomic <= BigInt(0)) {
    throw new Error("Settlement amounts must be positive");
  }

  const minorDivisor = BigInt(10) ** BigInt(tokenDecimals - 2);
  const totalAtomicAfter = existingAtomic + incomingAtomic;
  const totalMinorAfter = totalAtomicAfter / minorDivisor;
  const creditedMinor = totalMinorAfter - existingMinor;

  if (creditedMinor < BigInt(0)) {
    throw new Error("Settlement receipt ledger is inconsistent");
  }

  return {
    creditedMinor,
    totalMinorAfter,
    remainderAtomic: totalAtomicAfter % minorDivisor,
  };
}
