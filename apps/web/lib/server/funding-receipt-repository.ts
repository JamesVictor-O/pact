import "server-only";
import type { PoolClient } from "pg";
import { settlementMinorCredit } from "../settlement-amounts";

type ConfirmedTotals = { atomic: string; minor: string };

export async function recordConfirmedFundingReceipt(
  db: PoolClient,
  input: {
    id: string;
    fundingRequestId: string;
    eventId: string;
    fundingSourceId: string;
    contributorAddress: string;
    settlementTokenAddress: string;
    amountAtomic: bigint;
    tokenDecimals: number;
    chainId: number;
    transactionHash: string;
    logIndex: number;
    blockNumber: bigint;
  },
) {
  // Serialize credits for the same request so concurrent receipts cannot
  // double-count a sub-cent remainder.
  await db.query(`select id from funding_requests where id=$1 for update`, [input.fundingRequestId]);
  const totals = await db.query<ConfirmedTotals>(
    `select coalesce(sum(amount_atomic),0) atomic,coalesce(sum(amount_minor),0) minor
       from funding_receipts where funding_request_id=$1 and status='confirmed'`,
    [input.fundingRequestId],
  );
  const credit = settlementMinorCredit({
    existingAtomic: BigInt(totals.rows[0]?.atomic ?? 0),
    existingMinor: BigInt(totals.rows[0]?.minor ?? 0),
    incomingAtomic: input.amountAtomic,
    tokenDecimals: input.tokenDecimals,
  });
  const inserted = await db.query<{ id: string }>(
    `insert into funding_receipts(id,funding_request_id,event_id,contributor_address,settlement_token_address,amount_atomic,amount_minor,chain_id,transaction_hash,log_index,block_number,status,confirmed_at)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'confirmed',now())
     on conflict(chain_id,transaction_hash,log_index) do nothing returning id`,
    [
      input.id,
      input.fundingRequestId,
      input.eventId,
      input.contributorAddress,
      input.settlementTokenAddress,
      input.amountAtomic.toString(),
      credit.creditedMinor.toString(),
      input.chainId,
      input.transactionHash.toLowerCase(),
      input.logIndex,
      input.blockNumber.toString(),
    ],
  );
  if (inserted.rowCount && credit.creditedMinor > BigInt(0)) {
    await db.query(
      `update funding_sources set received_amount_minor=received_amount_minor+$2,updated_at=now() where id=$1`,
      [input.fundingSourceId, credit.creditedMinor.toString()],
    );
  }
  return { inserted: Boolean(inserted.rowCount), ...credit };
}
