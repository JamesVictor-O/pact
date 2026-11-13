# Pact at NEAR HACKATHON

Pact is the financial operating layer for events: funding comes in, agreements and payments go out, and Pact tracks the state in between. Every event has one USDC vault on Monad. **NEAR Intents is how money enters and leaves that vault across chains.** We call it through Aurora's 1Click-compatible API.

Tracks: **Real-World Money** (primary: invoicing and payroll for events on stablecoins via NEAR Intents) and **Privacy** (confidential NEAR Intents routes for payouts and contributions). Pact uses no AI agents, so it is not entered in agent tracks.

## What is judged (disclosure per Q-002 / Q-003 / Q-004)

Pact existed before this hackathon. All code up to the tag [`pre-hackathon`](https://github.com/JamesVictor-O/pact/releases/tag/pre-hackathon) (commit `db2420e`, 2026-10-13) is **baseline**. That includes the Monad contracts, the agreement/allocation product, and inbound Aurora routing from EVM and Stellar.

**Judged diff:** [`pre-hackathon...hackathon-submission`](https://github.com/JamesVictor-O/pact/compare/pre-hackathon...hackathon-submission)

Built in the window:

| Feature | What it does | Code |
|---|---|---|
| NEAR-side delivery verification | Before a payout is marked paid, Pact fetches the NEAR transaction from public RPC. It checks that the transaction is final, that the NEP-141 `ft_transfer` was emitted by the exact token contract (native NEAR USDC), that it came from `intents.near` to the payee's verified NEAR account, and that the amount is at least the quoted minimum, net of any transfer-call refund. Aurora's `SUCCESS` and its reported hash are treated as hints. This is the same rule Pact already applied to inbound Monad receipts. | [`lib/near-delivery.ts`](apps/web/lib/near-delivery.ts), [`lib/server/destination-delivery.ts`](apps/web/lib/server/destination-delivery.ts), [`vault-execution.ts` `syncRoutedPayment`](apps/web/lib/server/vault-execution.ts) |
| One NEAR transaction settles one payment | A unique index on `(destination_chain, destination_transaction_hash)`. Pact claims the hash before resolving the vault route. | [`015_near_delivery_and_private_routes.sql`](packages/database/migrations/015_near_delivery_and_private_routes.sql) |
| **Private** payouts | The organizer can tick *Private payment* for a payee paid on NEAR. The quote uses `confidentiality: "basic"` (NEAR Intents confidential rail). Aurora withholds destination hashes for confidential swaps, so Pact finds the transfer from the payee's side and still verifies it on NEAR RPC. If more than one candidate matches, it fails closed. | [`PaymentDetail.tsx`](apps/web/app/events/[eventId]/payments/[paymentId]/PaymentDetail.tsx), [`aurora-payout.ts`](apps/web/lib/server/aurora-payout.ts) |
| **Private** contributions | Sponsors and contributors can tick *Private contribution* on a funding or support link. Pact creates a separate persistent deposit address with `confidential: true`. | [`SponsorFundingClient.tsx`](apps/web/app/fund/[slug]/SponsorFundingClient.tsx), [`aurora-repository.ts`](apps/web/lib/server/aurora-repository.ts) |
| NEAR payee guard | A NEAR payout destination must be an existing account (`view_account` on public RPC). NEAR Intents returns an opaque HTTP 500 for unknown accounts. We hit that during preflight, and without this guard it would only fail when the organizer paid. | [`api/payout-profile/route.ts`](apps/web/app/api/payout-profile/route.ts) |
| Canary tooling | Read-only preflight (catalog, account, vault provenance, dry quotes), a CLI delivery verifier, and an outside-observer capture. | [`apps/web/scripts/near/`](apps/web/scripts/near) |

Unchanged rules: the relayer cannot choose recipients or amounts, the organizer signs the exact route with a passkey (Mera), and the vault keeps funds in `routing` until delivery is verified or a refund is confirmed.

## Judge walkthrough (no funds, no API key needed)

1. **Run the tests.** `cd apps/web && npm test`. You should see 45 passing tests. 11 of them are new NEAR verifier tests built on a real mainnet NEAR Intents USDC withdrawal ([`fixtures/near-usdc-intents-withdrawal.json`](apps/web/lib/fixtures/near-usdc-intents-withdrawal.json)). They cover the wrong recipient, wrong token, a forged event from another contract, a failed receipt, a non-final transaction, below-minimum amounts, and refund netting.
2. **Verify a real NEAR delivery against mainnet RPC:**
   ```bash
   cd apps/web
   node --experimental-strip-types scripts/near/verify-delivery.ts \
     rwpTRU1Tx27AQ3q1eJGua5bNUT6LAg3HHxesXoHbWMV irisout.near 148000000
   ```
   You should see `"verified": true` and `"amountAtomic": "148691319"`. Change the recipient and the result becomes `verified: false` with a reason.
3. **Read the decision path.** Start at `syncRoutedPayment` in [`vault-execution.ts`](apps/web/lib/server/vault-execution.ts). It calls `decideDestinationDelivery`, then claims the hash, then calls `resolveRouteDelivered` on the vault. Only after that does `paid_amount_minor` change.

With an Aurora API key, `scripts/near/preflight.ts` reproduces the dry-run results below.

## Verified facts (2026-11-12, read-only)

- Aurora's token catalog (230 tokens) lists **NEAR USDC**: `nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`, 6 decimals. The payout settings page loads this same catalog, so NEAR USDC appears as a payee option.
- Dry-run quotes (`dry: true`, 1 USDC) all succeeded:

  | Route | public | basic (Private) | advanced |
  |---|---|---|---|
  | Monad USDC → NEAR USDC (payout) | 0.999597 out, ~20 s | 0.997397 out, ~20 s | 0.997397 out, ~20 s |
  | NEAR USDC → Monad USDC (contribution) | 0.999153 out, ~22 s | 0.996953 out, ~22 s | 0.996953 out, ~22 s |

  Private costs about **0.22% more** and takes about the same time. The Monad route supports it in both directions.
- A quote to a NEAR account that doesn't exist fails with `Internal server error` (HTTP 400). That's why the payee guard above exists.
- The October canary vault `0xa34C…5e3A` is registered in the route-resolution factory `0x0115…Fa31`. The canaries below still use a fresh vault so their accounting starts at zero.

## Mainnet canaries

NEAR Intents has no testnet (Q-007), so these run on mainnet with small amounts. Record every hash here.

### 0. Preflight (read-only)

```bash
cd apps/web
node --env-file=.env.local --experimental-strip-types scripts/near/preflight.ts \
  --near-account <payee>.near --vault <fresh vault address>
```

Every line should say `PASS`. The evidence is written to `docs/near-canary/`.

### 1. Outbound canary: Monad vault → NEAR payee (public)

1. Create a new event. Its vault comes from factory `0x0115…Fa31`. Fund it with about 2 USDC, either directly or through a contribution link.
2. Add an expense of about $1 for a payee. As the payee, choose **USDC on NEAR** in payout settings and enter an existing `.near` account.
3. Accept the agreement, allocate funds, and press **Pay** with *Private payment* unticked.
4. Press **Check delivery** until the payment shows *Delivered to payee*. If Pact is still waiting, `last_error` explains what it is waiting for.

| Evidence | Value |
|---|---|
| Event vault | [`0x63181a7a3d4040d7FC41eC1D8A22a64CA1ff2194`](https://monadscan.com/address/0x63181a7a3d4040d7FC41eC1D8A22a64CA1ff2194) (factory `0x0115…Fa31`) |
| Payment | $0.20 deposit of a $0.40 agreement, payee `codexjames.near`, quoted minimum 0.197917 USDC |
| Monad `routePayment` tx | [`0x6040ce2c…4a92df`](https://monadscan.com/tx/0x6040ce2c0c2e49a057915963a66482dd5400de6ff68c47cffd16c3403b4a92df) (2026-11-12 23:44:42 UTC) |
| Aurora deposit address / correlation ID | `0x1aF8CA97BF84D16572c08dcAFeAe98b9cAE9FaCE` / `8ab7bcb6-2b53-4510-adef-02b0c4f1e7ae` |
| NEAR delivery tx (Aurora-reported) | [`GUyJ6fZWpRDcGycr5o91Uisj6MmZQbzRmPdPk4zgRk44`](https://nearblocks.io/txns/GUyJ6fZWpRDcGycr5o91Uisj6MmZQbzRmPdPk4zgRk44) (SUCCESS at 23:48:34 UTC) |
| `verify-delivery.ts` result | `verified: true`, 199917 atomic (0.199917 USDC) from `intents.near` to `codexjames.near`, native USDC, final |
| Vault `routeStatus` after resolution | **2 = Delivered**; Pact recorded the verified hash at 23:59:27 UTC and counted $0.20 as paid |

**What this run showed.** NEAR Intents completed the swap about 4 minutes after the vault paid out, but Aurora's status endpoint kept returning `PENDING_DEPOSIT` for hours afterwards. Pact never marked the payment paid on the vault transfer alone; it stayed *routing* until the NEAR transfer was verified on public RPC. Pact now re-checks routed payouts automatically when the event's pages load (at most once per route every 15 s), so nobody has to press *Check delivery*.

### 2. Refund canary

**We cannot force a refund through Pact without weakening its safety rules, so the refund path is not proven on mainnet.**

The vault only sends exactly the quote's `amountIn` to the quote's deposit address, signed by the organizer, within the quote deadline. A short or incomplete deposit can't be produced on purpose. An expired quote can't be produced either, because Pact re-quotes instead of reusing a stale one. The refund path (`REFUNDED` → `resolveRouteRefunded` → allocation restored) is covered by the Solidity tests ([`PactEventVault.t.sol`](contracts/test/PactEventVault.t.sol)) but not by a live canary. If NEAR Intents refunds a canary on its own, we will record it here.

### 3. Private payout canary and observer comparison

Repeat canary 1 with *Private payment* ticked, using the same payee and amount. After each run, capture the public view:

```bash
node --env-file=.env.local --experimental-strip-types scripts/near/observer.ts --label public-payout \
  --monad-tx <routePayment tx> --deposit-address <quote deposit address> --near-tx <delivery tx>
node --env-file=.env.local --experimental-strip-types scripts/near/observer.ts --label private-payout \
  --monad-tx <routePayment tx> --deposit-address <quote deposit address> --near-recipient <payee>.near
```

Then screenshot Monadscan and [explorer.near-intents.org](https://explorer.near-intents.org) for each run.

**Canary 3 result (Private, `confidentiality: "basic"`):**

| Evidence | Value |
|---|---|
| Monad `routePayment` tx | [`0x9487a176…2e7c22`](https://monadscan.com/tx/0x9487a17634cfddb7d79526066ce1993c42e8223f2a4e420b47ba92e7eb2e7c22): 0.20 USDC to confidential deposit address `0xA35270f087072634ae3380177c8E725a9cBCBf6D` |
| Aurora deposit report | Failed upstream (`Empty AMQP response`); NEAR Intents still detected the deposit. Pact now treats the report as best-effort |
| Aurora status | `{"status":"SUCCESS"}` only: no hashes, recipient or amounts |
| NEAR delivery (found via FastNEAR, verified on RPC) | [`B86feaGRWcft8iHq6m5Xs52xDQhYCunTKPB4HTUJDJKG`](https://nearblocks.io/txns/B86feaGRWcft8iHq6m5Xs52xDQhYCunTKPB4HTUJDJKG): 0.199477 USDC to `codexjames.near`, minimum 0.197482 |
| Vault `routeStatus` | **2 = Delivered**; Pact verified at 01:20:26 UTC |

On NearBlocks the public and Private deliveries look the same (both `intents.near` → `codexjames.near`, each from a different NEAR Intents internal account). The difference is in what links them back to the event vault.

| What an outside observer sees | Public route | Private route |
|---|---|---|
| Monadscan: event vault → deposit address, amount | Visible: 0.2 USDC to `0x1aF8…FaCE` | Visible: 0.2 USDC to `0xA352…BF6D` |
| Aurora / 1Click status for the deposit address | Origin tx, destination tx, amounts | `{"status":"SUCCESS"}` only |
| NEAR Intents explorer: record for the deposit address | _pending (screenshot)_ | _pending (screenshot)_ |
| NEAR Intents explorer: shows the NEAR recipient? | _pending_ | _pending_ |
| NearBlocks: `intents.near` → payee USDC transfer | Visible (`GUyJ…`) | Visible (`B86fea…`) |
| Can the event vault be linked to the payee? | _pending_ | _pending_ |

Expected, per the [Aurora Confidential Intents docs](https://docs.intents.aurora.dev/confidential-intents.md): the confidential rail hides the origin wallet, the routing path, and the link between source and destination. The destination transfer itself stays public. The canary checks whether that holds for a Monad vault payout.

### Private contribution from Base (extra)

A sponsor used the event's support link with *Private contribution* ticked and paid from Base.

| Evidence | Value |
|---|---|
| Base deposit tx | [`0xe2e60d1f…4353d0`](https://basescan.org/tx/0xe2e60d1f5c2d9019175498a7d0492132693a84f3310fd348d46e19570acc96b5): 0.5 USDC to the confidential persistent address `0x3756B5fFF2412D9435E49b0C59b610c089a97a5f` (23:32:28 UTC) |
| Monad settlement into the vault | [`0x640e89e6…51760e`](https://monadscan.com/tx/0x640e89e6e941ccd18e076d4e5f5c93ef397b302f3cacd506ec4c99453e51760e): 0.498225 USDC from the NEAR Intents settlement address (23:33:59 UTC) |
| Pact receipt | `confirmed`, $0.49 credited at 23:34:29 UTC after Pact verified the Monad USDC transfer into the vault |

For this confidential route Aurora still reported enough for Pact to verify and credit the deposit, so the fail-closed path was not needed.

### 4. NEAR-source inbound canary

1. Open the event's funding or support link and choose **NEAR** as the sending network.
2. Send about 1 NEAR USDC from a NEAR wallet to the address shown.
3. Press **Check payment** until it shows *success*. Pact credits the funding only after it verifies the Monad USDC transfer into the vault.
4. Pay a NEAR payee from that money (canary 1). That proves the full loop: a sponsor funds from a NEAR wallet and the payee is paid on NEAR, with Monad holding the event's state.
5. Optional: repeat with *Private contribution* ticked. If Aurora withholds the settlement record for confidential deposits, Pact leaves the contribution uncredited instead of guessing. Record which way it went.

| Evidence | Public | Private |
|---|---|---|
| NEAR source tx | _pending_ | _pending_ |
| Persistent deposit address | _pending_ | _pending_ |
| Monad settlement tx into vault | _pending_ | _pending_ |
| Pact receipt (atomic / credited cents) | _pending_ | _pending_ |

## Infrastructure and libraries

NEAR Intents (via Aurora's 1Click-compatible API), public NEAR RPC (FastNEAR, near.org), NearBlocks API (used only to discover Private-payout candidates), Monad mainnet, Dynamic, Mera, viem, Next.js, and PostgreSQL. All other code is listed in the repository README.
