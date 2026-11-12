/**
 * Capture what an outside observer can see for one canary, using only public data.
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/near/observer.ts \
 *     --label public-payout --monad-tx <0x…> --deposit-address <0x… or near deposit> [--near-tx <hash>] [--near-recipient payee.near]
 *
 * Writes docs/near-canary/observer-<label>.md with:
 *   - the Monad leg (Monadscan): who sent USDC where
 *   - the NEAR Intents explorer record for the deposit address (requires NEAR_INTENTS_EXPLORER_JWT,
 *     otherwise prints the explorer search link to screenshot)
 *   - the NEAR leg (NearBlocks / public RPC): who received what from whom
 * Run it once for a public route and once for a Private route; the two files are the demo comparison.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createPublicClient, decodeEventLog, http, parseAbiItem, type Hex } from "viem";
import { fetchNearTransaction, nearExplorerTransactionUrl } from "../../lib/near-delivery.ts";

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((pairs, value, index, all) => (value.startsWith("--") ? [...pairs, [value.slice(2), all[index + 1]]] : pairs), []));
const label = args.label ?? "canary";
const lines: string[] = [`# Outside-observer view: ${label}`, "", `Captured ${new Date().toISOString()} from public sources only.`, ""];

if (args["monad-tx"]) {
  const hash = args["monad-tx"] as Hex;
  lines.push("## Monad (Monadscan)", "", `https://monadscan.com/tx/${hash}`, "");
  const rpc = process.env.MONAD_RPC_URL;
  if (rpc) {
    const client = createPublicClient({ transport: http(rpc) });
    const receipt = await client.getTransactionReceipt({ hash });
    const transfer = parseAbiItem("event Transfer(address indexed from,address indexed to,uint256 value)");
    lines.push(`- Transaction sender (relayer): \`${receipt.from}\``, `- Called contract (event vault): \`${receipt.to}\``);
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: [transfer], data: log.data, topics: log.topics });
        lines.push(`- Token transfer on \`${log.address}\`: \`${decoded.args.from}\` → \`${decoded.args.to}\`, ${Number(decoded.args.value) / 1e6} (6-dec units)`);
      } catch { /* not a Transfer */ }
    }
    lines.push("");
  }
}

if (args["deposit-address"]) {
  const deposit = args["deposit-address"];
  lines.push("## NEAR Intents explorer", "", `https://explorer.near-intents.org/?search=${encodeURIComponent(deposit)}`, "");
  const jwt = process.env.NEAR_INTENTS_EXPLORER_JWT;
  if (jwt) {
    const response = await fetch(`https://explorer.near-intents.org/api/v0/transactions?search=${encodeURIComponent(deposit)}&numberOfTransactions=5`, { headers: { authorization: `Bearer ${jwt}` } });
    const body = await response.json();
    const rows = Array.isArray(body) ? body : (body as { data?: unknown[] }).data ?? [];
    if (rows.length === 0) lines.push("- No public explorer record for this deposit address.");
    for (const row of rows as Array<Record<string, unknown>>) {
      for (const field of ["originAsset", "destinationAsset", "senders", "refundTo", "recipient", "amountInFormatted", "amountOutFormatted", "originChainTxHashes", "destinationChainTxHashes", "depositType", "recipientType", "status"]) {
        lines.push(`- ${field}: \`${JSON.stringify(row[field] ?? null)}\``);
      }
      lines.push("");
    }
  } else {
    lines.push("- Set NEAR_INTENTS_EXPLORER_JWT to capture the explorer API record; otherwise screenshot the link above.", "");
  }
}

if (args["near-tx"]) {
  const tx = await fetchNearTransaction(args["near-tx"]);
  lines.push("## NEAR (NearBlocks)", "", nearExplorerTransactionUrl(args["near-tx"]), "");
  if (tx) {
    lines.push(`- Signer: \`${tx.transaction.signer_id}\` → receiver contract \`${tx.transaction.receiver_id}\``);
    for (const receipt of tx.receipts_outcome) for (const log of receipt.outcome.logs) {
      if (!log.includes('"ft_transfer"')) continue;
      const event = JSON.parse(log.slice("EVENT_JSON:".length)) as { data: Array<{ old_owner_id: string; new_owner_id: string; amount: string }> };
      for (const item of event.data) lines.push(`- \`${receipt.outcome.executor_id}\` ft_transfer: \`${item.old_owner_id}\` → \`${item.new_owner_id}\`, ${item.amount} atomic`);
    }
  } else lines.push("- Not found on public RPC.");
  lines.push("");
} else if (args["near-recipient"]) {
  lines.push("## NEAR (NearBlocks)", "", `https://nearblocks.io/address/${args["near-recipient"]}?tab=tokentxns`, "");
}

lines.push("## What links the event to the payee?", "", "_Fill in after comparing the public and private captures: can an observer connect the event vault on Monad to the NEAR recipient?_", "");
const dir = new URL("../../../../docs/near-canary/", import.meta.url);
mkdirSync(dir, { recursive: true });
const file = new URL(`observer-${label}.md`, dir);
writeFileSync(file, lines.join("\n"));
console.log(lines.join("\n"));
console.log(`\nWritten to ${file.pathname}`);
