/**
 * Independent NEAR-side delivery verification for cross-chain payouts.
 *
 * Aurora (NEAR Intents 1Click) reports a route as SUCCESS and, for public
 * routes, returns destination transaction hashes. Pact does not treat that
 * report as financial finality. Before a payout is marked delivered, the NEAR
 * transaction itself is fetched from a public NEAR RPC and checked for:
 *
 *   - finality (`final_execution_status === "FINAL"`)
 *   - the exact NEP-141 token contract the payee chose (e.g. native NEAR USDC)
 *   - a successful `ft_transfer` event emitted by that contract
 *   - sent by the NEAR Intents verifier (`intents.near`)
 *   - to the payee's verified NEAR account
 *   - for at least the quoted minimum output, net of any transfer-call refund
 *
 * This is the same principle Pact applies to inbound funding, where a Monad
 * USDC Transfer log into the event vault is required before funds are credited.
 *
 * Confidential (Private) routes do not expose destination hashes through the
 * Aurora status API. For those, `findNearDeliveryCandidates` discovers incoming
 * transfers from the payee's side using a public indexer, and every candidate
 * still goes through the same RPC verification. The indexer is only used for
 * discovery; it is never the source of truth.
 */

export const NEAR_INTENTS_ACCOUNT = "intents.near";
export const DEFAULT_NEAR_RPC_URLS = [
  "https://archival-rpc.mainnet.fastnear.com",
  "https://free.rpc.fastnear.com",
  "https://rpc.mainnet.near.org",
];
export const DEFAULT_NEARBLOCKS_API_URL = "https://api.nearblocks.io";

const NEAR_TX_HASH = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
const NEAR_ACCOUNT = /^(?=.{2,64}$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

type ExecutionStatus = Record<string, unknown>;

export type NearTransactionStatus = {
  final_execution_status?: string;
  status: ExecutionStatus;
  transaction: { hash: string; signer_id: string; receiver_id: string };
  receipts_outcome: Array<{
    id: string;
    block_hash: string;
    outcome: { executor_id: string; logs: string[]; status: ExecutionStatus };
  }>;
};

export type NearDeliveryExpectation = {
  recipient: string;
  tokenContract: string;
  minimumAmountAtomic: string | bigint;
  /** Accounts allowed to be the `old_owner_id` of the delivery. Defaults to `intents.near`. */
  senders?: string[];
};

export type NearDeliveryEvidence = {
  verified: true;
  transactionHash: string;
  recipient: string;
  tokenContract: string;
  amountAtomic: string;
  receiptIds: string[];
  blockHashes: string[];
  explorerUrl: string;
};

export type NearDeliveryResult = NearDeliveryEvidence | { verified: false; reason: string; transactionHash?: string };

export function isNearTransactionHash(value: string) {
  return NEAR_TX_HASH.test(value);
}

export function isNearAccountId(value: string) {
  return NEAR_ACCOUNT.test(value);
}

export function nearExplorerTransactionUrl(hash: string) {
  return `https://nearblocks.io/txns/${hash}`;
}

/** `nep141:<contract>` → `<contract>`. Returns null for anything that is not a NEP-141 asset. */
export function nearTokenContract(assetId: string) {
  const match = /^nep141:(.+)$/.exec(assetId.trim());
  return match && isNearAccountId(match[1]) ? match[1] : null;
}

function succeeded(status: ExecutionStatus) {
  return "SuccessValue" in status || "SuccessReceiptId" in status;
}

type Nep141Transfer = { old_owner_id: string; new_owner_id: string; amount: string };

function nep141Transfers(logs: string[]): Nep141Transfer[] {
  const transfers: Nep141Transfer[] = [];
  for (const log of logs) {
    if (!log.startsWith("EVENT_JSON:")) continue;
    let event: { standard?: string; event?: string; data?: unknown };
    try { event = JSON.parse(log.slice("EVENT_JSON:".length)); } catch { continue; }
    if (event.standard !== "nep141" || event.event !== "ft_transfer" || !Array.isArray(event.data)) continue;
    for (const item of event.data as Array<Partial<Nep141Transfer>>) {
      if (typeof item?.old_owner_id === "string" && typeof item.new_owner_id === "string" && typeof item.amount === "string" && /^\d+$/.test(item.amount)) {
        transfers.push({ old_owner_id: item.old_owner_id, new_owner_id: item.new_owner_id, amount: item.amount });
      }
    }
  }
  return transfers;
}

/** Pure verification of an `EXPERIMENTAL_tx_status` result. No network access. */
export function verifyNearFtDelivery(tx: NearTransactionStatus, expected: NearDeliveryExpectation): NearDeliveryResult {
  const hash = tx.transaction?.hash;
  const recipient = expected.recipient.trim().toLowerCase();
  const token = expected.tokenContract.trim().toLowerCase();
  const senders = new Set((expected.senders ?? [NEAR_INTENTS_ACCOUNT]).map(sender => sender.toLowerCase()));
  const minimum = BigInt(expected.minimumAmountAtomic);

  if (tx.final_execution_status !== "FINAL") return { verified: false, transactionHash: hash, reason: "The NEAR transaction is not final yet" };
  if (!succeeded(tx.status)) return { verified: false, transactionHash: hash, reason: "The NEAR transaction failed" };

  let net = BigInt(0);
  const receiptIds: string[] = [];
  const blockHashes = new Set<string>();
  for (const receipt of tx.receipts_outcome ?? []) {
    if (receipt.outcome.executor_id.toLowerCase() !== token) continue;
    if (!succeeded(receipt.outcome.status)) continue;
    let touched = false;
    for (const transfer of nep141Transfers(receipt.outcome.logs)) {
      const from = transfer.old_owner_id.toLowerCase(), to = transfer.new_owner_id.toLowerCase();
      if (to === recipient && senders.has(from)) { net += BigInt(transfer.amount); touched = true; }
      // ft_transfer_call refunds flow back from the recipient to the sender inside the same transaction.
      else if (from === recipient && senders.has(to)) { net -= BigInt(transfer.amount); touched = true; }
    }
    if (touched) { receiptIds.push(receipt.id); blockHashes.add(receipt.block_hash); }
  }

  if (net <= BigInt(0)) return { verified: false, transactionHash: hash, reason: `No ${expected.tokenContract} transfer from NEAR Intents to ${expected.recipient} in this transaction` };
  if (net < minimum) return { verified: false, transactionHash: hash, reason: `Delivered ${net} atomic units, below the quoted minimum of ${minimum}` };
  return {
    verified: true,
    transactionHash: hash,
    recipient: expected.recipient,
    tokenContract: expected.tokenContract,
    amountAtomic: net.toString(),
    receiptIds,
    blockHashes: [...blockHashes],
    explorerUrl: nearExplorerTransactionUrl(hash),
  };
}

type RpcOptions = { rpcUrls?: string[]; fetcher?: typeof fetch; timeoutMs?: number };

async function nearRpc<T>(method: string, params: unknown, options: RpcOptions): Promise<{ result?: T; error?: { name?: string; cause?: { name?: string; info?: unknown }; message?: string; data?: unknown } }> {
  const urls = options.rpcUrls?.length ? options.rpcUrls : DEFAULT_NEAR_RPC_URLS;
  const fetcher = options.fetcher ?? fetch;
  let lastError: unknown;
  for (const url of urls) {
    try {
      const response = await fetcher(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "pact", method, params }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
      });
      if (!response.ok) { lastError = new Error(`NEAR RPC ${url} returned HTTP ${response.status}`); continue; }
      const body = await response.json() as { result?: T; error?: { name?: string; cause?: { name?: string; info?: unknown }; message?: string; data?: unknown } };
      // A non-archival node may not know an older transaction. Try the next provider before giving up.
      if (body.error && ["UNKNOWN_TRANSACTION", "TIMEOUT_ERROR", "UNKNOWN_BLOCK"].includes(body.error.cause?.name ?? "")) { lastError = body.error; continue; }
      return body;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError && typeof lastError === "object" && "cause" in (lastError as object)) return { error: lastError as never };
  throw lastError instanceof Error ? lastError : new Error("NEAR RPC is unavailable");
}

/**
 * Fetch a finalized NEAR transaction from public RPC. Returns null when no
 * provider knows the transaction. 1Click withdrawals are signed by
 * `intents.near`; pass another sender for other origins.
 */
export async function fetchNearTransaction(hash: string, options: RpcOptions & { senderAccountId?: string } = {}) {
  if (!isNearTransactionHash(hash)) throw new Error("Invalid NEAR transaction hash");
  const body = await nearRpc<NearTransactionStatus>("EXPERIMENTAL_tx_status", {
    tx_hash: hash,
    sender_account_id: options.senderAccountId ?? NEAR_INTENTS_ACCOUNT,
    wait_until: "FINAL",
  }, options);
  if (body.result) return body.result;
  const cause = body.error?.cause?.name;
  if (cause === "UNKNOWN_TRANSACTION" || cause === "TIMEOUT_ERROR") return null;
  throw new Error(`NEAR RPC error: ${body.error?.cause?.name ?? body.error?.message ?? "unknown"}`);
}

/** Fetch and verify in one step. */
export async function verifyNearDeliveryOnChain(hash: string, expected: NearDeliveryExpectation, options: RpcOptions = {}): Promise<NearDeliveryResult> {
  const tx = await fetchNearTransaction(hash, options);
  if (!tx) return { verified: false, transactionHash: hash, reason: "The NEAR transaction was not found on public RPC" };
  return verifyNearFtDelivery(tx, expected);
}

/** True when the NEAR account exists. Used before saving a NEAR payout destination. */
export async function nearAccountExists(accountId: string, options: RpcOptions = {}) {
  if (!isNearAccountId(accountId)) return false;
  const body = await nearRpc<{ amount: string }>("query", { request_type: "view_account", finality: "final", account_id: accountId }, options);
  if (body.result) return true;
  const cause = body.error?.cause?.name;
  if (cause === "UNKNOWN_ACCOUNT" || cause === "INVALID_ACCOUNT") return false;
  throw new Error(`NEAR RPC error: ${cause ?? body.error?.message ?? "unknown"}`);
}

type NearBlocksFtTxn = {
  transaction_hash: string;
  affected_account_id: string;
  involved_account_id: string | null;
  delta_amount: string;
  cause: string;
  block_timestamp: string;
  ft?: { contract?: string };
};

/**
 * Discover candidate delivery transactions for a payee when Aurora withholds
 * destination hashes (confidential routes). Candidates are newest first and
 * must still pass `verifyNearDeliveryOnChain`.
 */
export async function findNearDeliveryCandidates(input: { recipient: string; tokenContract: string; since: Date; senders?: string[] }, options: { fetcher?: typeof fetch; baseUrl?: string } = {}) {
  const fetcher = options.fetcher ?? fetch;
  const base = (options.baseUrl ?? process.env.NEARBLOCKS_API_URL ?? DEFAULT_NEARBLOCKS_API_URL).replace(/\/$/, "");
  const senders = new Set((input.senders ?? [NEAR_INTENTS_ACCOUNT]).map(sender => sender.toLowerCase()));
  const response = await fetcher(`${base}/v1/account/${encodeURIComponent(input.recipient)}/ft-txns?per_page=50&order=desc`, {
    headers: process.env.NEARBLOCKS_API_KEY ? { authorization: `Bearer ${process.env.NEARBLOCKS_API_KEY}` } : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`NEAR indexer returned HTTP ${response.status}`);
  const body = await response.json() as { txns?: NearBlocksFtTxn[] };
  const sinceNs = BigInt(input.since.getTime()) * BigInt(1_000_000);
  const token = input.tokenContract.toLowerCase();
  const hashes = new Set<string>();
  for (const item of body.txns ?? []) {
    if (item.ft?.contract?.toLowerCase() !== token) continue;
    if (item.affected_account_id.toLowerCase() !== input.recipient.toLowerCase()) continue;
    if (item.delta_amount.startsWith("-")) continue;
    if (item.involved_account_id && !senders.has(item.involved_account_id.toLowerCase())) continue;
    if (BigInt(item.block_timestamp) < sinceNs) continue;
    if (isNearTransactionHash(item.transaction_hash)) hashes.add(item.transaction_hash);
  }
  return [...hashes];
}
