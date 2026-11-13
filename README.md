# Pact

Pact is finance software for people who produce events. An organizer records where the event's money comes from (sponsors, grants, their own funds) and who the event has agreed to pay (venues, crews, freelancers), then pays those people from a dedicated USDC account for the event.

Event money sits in several states at once, and spreadsheets blur them. A sponsor promising $30,000 is not the same as $13,000 that has arrived, and neither tells you whether the $16,500 due in two weeks can be paid. Pact tracks each state separately (**committed ≠ received ≠ available ≠ allocated ≠ paid**). It only moves a payment to *paid* when there is verifiable evidence that the money arrived.

**NEAR Intents is how money enters and leaves an event.** A sponsor can pay from whichever chain they already hold funds on, and a payee can be paid on NEAR, without either of them bridging. Pact does not take the routing service's word that a payout arrived. It reads the NEAR transaction from public RPC and checks the recipient, token and amount itself.

![Pact event overview for "Near Intent hackar house": estimated budget $10.00, funding received $0.49, committed to payees $0.40, available $0.09, each shown as a separate figure](docs/screenshots/event-overview.png)
*The canary event in Pact. Received ($0.49, a Private contribution from Base routed by NEAR Intents), committed to payees ($0.40) and available ($0.09) are tracked as separate numbers.*

---

## NEAR HACKATHON submission

| | |
|---|---|
| **Track** | Real-World Money (primary). Privacy (secondary): confidential NEAR Intents routes for payroll and contributions |
| **Pre-existing product** | Yes. Everything up to tag [`pre-hackathon`](https://github.com/JamesVictor-O/pact/releases/tag/pre-hackathon) (commit `db2420e`, 2026-10-13) is baseline and not judged (Q-002, Q-004) |
| **Judged work** | The NEAR Intents integration built 2026-10-19 → 2026-11-14, listed below |
| **Judged diff** | [`pre-hackathon...hackathon-submission`](https://github.com/JamesVictor-O/pact/compare/pre-hackathon...hackathon-submission) |
| **Mainnet evidence** | [Mainnet evidence](#mainnet-evidence): every claim links to a transaction on Monadscan, Basescan or NearBlocks |
| **Full canary log** | [NEAR_HACKATHON.md](NEAR_HACKATHON.md) |
| **License** | [MIT](LICENSE) |

### What was built during the hackathon

| # | Feature | Problem it solves | Code |
|---|---|---|---|
| 1 | **NEAR-side delivery verification** | NEAR Intents (via Aurora) reports `SUCCESS` and a destination hash. Before the hackathon Pact trusted that report. Now Pact fetches the NEAR transaction from public RPC and accepts it only if **all** of these hold: it is final, the NEP-141 `ft_transfer` event was emitted by the exact native USDC contract, the sender is `intents.near`, the receiver is the payee's verified account, and the amount, net of any transfer-call refund, is at least the quoted minimum. Only then does Pact resolve the route on the Monad vault and count the payment as paid. | [`lib/near-delivery.ts`](apps/web/lib/near-delivery.ts), [`lib/server/destination-delivery.ts`](apps/web/lib/server/destination-delivery.ts), `syncRoutedPayment` in [`lib/server/vault-execution.ts`](apps/web/lib/server/vault-execution.ts) |
| 2 | **One NEAR transaction settles one payout** | Without this, one real delivery could be cited for two payouts. Pact claims the NEAR hash in the database before resolving the vault route, behind a unique index on `(destination_chain, destination_transaction_hash)`. | [`015_near_delivery_and_private_routes.sql`](packages/database/migrations/015_near_delivery_and_private_routes.sql) |
| 3 | **Private payouts** | Payroll is sensitive. The organizer can tick *Private payment* for a payee paid on NEAR, and the quote uses NEAR Intents `confidentiality: "basic"`. For confidential routes the API withholds the destination hash, so Pact finds candidate transfers from the payee's side (FastNEAR's account index, with NearBlocks as a fallback), verifies each on RPC as in #1, and **fails closed** if more than one matches. | [`PaymentDetail.tsx`](apps/web/app/events/[eventId]/payments/[paymentId]/PaymentDetail.tsx), [`aurora-payout.ts`](apps/web/lib/server/aurora-payout.ts), [`destination-delivery.ts`](apps/web/lib/server/destination-delivery.ts) |
| 4 | **Private contributions** | A sponsor can tick *Private contribution* on the event's funding link. Pact creates a separate persistent deposit address with `confidential: true`. The funds are credited only after Pact verifies the USDC transfer into the event vault on Monad. | [`SponsorFundingClient.tsx`](apps/web/app/fund/[slug]/SponsorFundingClient.tsx), [`aurora-repository.ts`](apps/web/lib/server/aurora-repository.ts), [`aurora-intents.ts`](apps/web/lib/server/aurora-intents.ts) |
| 5 | **NEAR payee account guard** | A quote to a NEAR account that does not exist fails with an opaque error. Without a guard the organizer would only find out when paying. Pact checks `view_account` when the payee saves a NEAR payout destination. | [`api/payout-profile/route.ts`](apps/web/app/api/payout-profile/route.ts) |
| 6 | **Automatic delivery reconciliation** | During the mainnet canary, NEAR Intents completed the swap within 4 minutes, but its status endpoint kept returning `PENDING_DEPOSIT` for hours. Pact now re-checks routed payouts whenever the event's pages load, at most once per route every 15 s, through the same verified path as #1. Nobody has to press a button, and nothing is marked paid early. | `reconcileRoutedPayments` in [`vault-execution.ts`](apps/web/lib/server/vault-execution.ts) |
| 7 | **Canary tooling** | NEAR Intents has no testnet (Q-007), so every claim needs a mainnet check. The tooling is a read-only preflight (token catalog, account, vault provenance, `dry: true` quotes), a CLI delivery verifier, and an outside-observer capture. | [`apps/web/scripts/near/`](apps/web/scripts/near) |

Unchanged from the baseline:
- The relayer cannot choose recipients or amounts.
- The organizer signs the exact route with a passkey (Mera).
- The vault holds the funds in `Routing` until delivery is verified or a refund is confirmed.

---

## Verify it yourself

### 1. Without API keys or funds (about 5 minutes)

Requires Node.js 22.6+ and npm.

```bash
git clone https://github.com/JamesVictor-O/pact.git && cd pact
npm ci
npm test
```

**Expected:** `5 + 6 + 47` tests pass, with 0 failures. Thirteen of them test the NEAR delivery verifier against a trimmed **real mainnet NEAR Intents USDC withdrawal** ([`fixtures/near-usdc-intents-withdrawal.json`](apps/web/lib/fixtures/near-usdc-intents-withdrawal.json)). One checks that the real delivery verifies. Most of the others change a single detail and check that verification fails: the recipient, the token contract, the sender, a log forged by another contract, a failed receipt, a non-final status, and an amount below the minimum. The rest cover refund netting, asset-ID mapping, and Private-payout discovery (filtering, FastNEAR, and tolerating one index being down but not both). See [`near-delivery.test.ts`](apps/web/lib/near-delivery.test.ts).

Next, verify Pact's own canary payout against **live NEAR mainnet RPC**. This runs the same check Pact runs before marking a payment paid:

```bash
cd apps/web
node --experimental-strip-types scripts/near/verify-delivery.ts \
  GUyJ6fZWpRDcGycr5o91Uisj6MmZQbzRmPdPk4zgRk44 codexjames.near 197917
```

**Expected:** `"verified": true` and `"amountAtomic": "199917"`, from `intents.near` to `codexjames.near`, native USDC.

Change the recipient to any other account and run it again. **Expected:** `"verified": false` with a reason, and exit code 2.

### 2. On mainnet, read-only

Every row in [Mainnet evidence](#mainnet-evidence) links to a public explorer. You can check, for example, that the Monad vault transfer and the NEAR delivery have the amounts stated.

### 3. With keys: the full application

See [Run Pact locally](#run-pact-locally). With an Aurora Intents API key, `scripts/near/preflight.ts` reproduces the catalog, account and `dry: true` quote checks without moving funds.

---

## Mainnet evidence

All amounts are small on purpose. NEAR Intents has no testnet, so these ran on mainnet with real USDC.

**Canary 1: Monad event vault → NEAR payee (public).** Proves features 1, 2 and 6.

| Step | Evidence |
|---|---|
| Event vault, created by factory `0x0115…Fa31` | [`0x63181a7a…2194`](https://monadscan.com/address/0x63181a7a3d4040d7FC41eC1D8A22a64CA1ff2194) |
| Organizer-signed route: vault → NEAR Intents deposit address, 0.20 USDC | [`0x6040ce2c…4a92df`](https://monadscan.com/tx/0x6040ce2c0c2e49a057915963a66482dd5400de6ff68c47cffd16c3403b4a92df) |
| NEAR delivery: `intents.near` → `codexjames.near`, 0.199917 USDC | [`GUyJ6fZW…gRk44`](https://nearblocks.io/txns/GUyJ6fZWpRDcGycr5o91Uisj6MmZQbzRmPdPk4zgRk44) |
| Pact verification | Hash claimed and verified, then vault `routeStatus` = 2 (Delivered), then $0.20 counted as paid |

**Canary 3: Monad event vault → NEAR payee (Private, `confidentiality: "basic"`).** Proves features 3 and 6, including recovery from an upstream outage.

| Step | Evidence |
|---|---|
| Organizer-signed route: vault → confidential deposit address `0xA352…BF6D`, 0.20 USDC | [`0x9487a176…2e7c22`](https://monadscan.com/tx/0x9487a17634cfddb7d79526066ce1993c42e8223f2a4e420b47ba92e7eb2e7c22) |
| Deposit report to Aurora | Failed upstream with `Empty AMQP response`. Pact kept the payment in *processing* and retried; NEAR Intents detected the deposit regardless |
| What the status API returned | Only `{"status":"SUCCESS"}`: no origin hash, destination hash, recipient or amount |
| NEAR delivery, found by Pact via FastNEAR and verified on RPC | [`B86feaGR…DJKG`](https://nearblocks.io/txns/B86feaGRWcft8iHq6m5Xs52xDQhYCunTKPB4HTUJDJKG): `intents.near` → `codexjames.near`, 0.199477 USDC (minimum 0.197482) |
| Pact verification | Hash claimed, vault `routeStatus` = 2 (Delivered), $0.20 counted as paid |

![Pact payment page for the Private payout: status Paid, amount $0.20, funded $0.20, paid $0.20, "Payment complete: this payment was delivered to the payee's NEAR account and recorded in Pact", and "Delivered to payee" with Monad transaction 0x9487a176…2e7c22](docs/screenshots/payment-delivered.png)
*Canary 3 in Pact after verification: paid only once the NEAR delivery was found and verified. The hash shown is the vault's Monad routing transaction.*

**Private contribution: Base → Monad event vault (confidential route).** Proves feature 4.

| Step | Evidence |
|---|---|
| Sponsor deposit, 0.5 USDC on Base, to a `confidential: true` persistent address | [`0xe2e60d1f…4353d0`](https://basescan.org/tx/0xe2e60d1f5c2d9019175498a7d0492132693a84f3310fd348d46e19570acc96b5) |
| Settlement into the vault on Monad, 0.498225 USDC, about 90 s later | [`0x640e89e6…51760e`](https://monadscan.com/tx/0x640e89e6e941ccd18e076d4e5f5c93ef397b302f3cacd506ec4c99453e51760e) |
| Pact receipt | `confirmed`, $0.49 credited after Pact verified the Monad USDC transfer |

**Read-only checks (2026-11-12):**
- Aurora's catalog lists native NEAR USDC (`nep141:17208628…133a1`).
- `dry: true` quotes succeed for Monad USDC ⇄ NEAR USDC in `public`, `basic` and `advanced` confidentiality. Private costs about 0.22% more and takes about the same time (~20 s estimated).
- Raw output: [`docs/near-canary/`](docs/near-canary).

Still open: a contribution sent from a NEAR wallet, and the NEAR Intents explorer screenshots for the public-versus-Private comparison. Both are tracked in [NEAR_HACKATHON.md](NEAR_HACKATHON.md).

---

## How Pact uses NEAR, in detail

### Overview

```mermaid
flowchart LR
    S[Sponsor on any supported chain] -->|deposit to persistent address<br/>optional confidential| NI1[NEAR Intents]
    NI1 -->|USDC on Monad| V[(Event vault on Monad)]
    V -->|Pact verifies Transfer log<br/>before crediting| R[Received funds]
    R -->|organizer allocates<br/>passkey signature| A[Allocated to a payment]
    A -->|organizer signs exact route<br/>vault status: Routing| NI2[NEAR Intents]
    NI2 -->|ft_transfer from intents.near| P[Payee NEAR account]
    P -.->|Pact reads tx from NEAR RPC:<br/>final, token, sender, receiver, amount| C{Verified?}
    C -->|yes: claim hash, resolve route| PAID[Paid]
    C -->|no| WAIT[Stays Routing]
```

**Why NEAR Intents here.** An event's money comes from people on many chains and goes to people on many chains. The event's accounting, though, needs a single programmable account with signed rules (Pact's Monad vault). NEAR Intents connects those ends. Sponsors pay with what they hold (the catalog lists 39 networks) and payees receive USDC on NEAR. The vault never holds a bridged position, and nobody operates a bridge.

**Where Pact does not trust the intermediary.** Every NEAR Intents step has an independent on-chain check:
- **Inbound:** the USDC `Transfer` into the vault, read on Monad.
- **Outbound:** the `ft_transfer` to the payee, read on NEAR.
- **One delivery, one payout:** a unique hash claim.

### 1. The quote: what Pact asks NEAR Intents for, and why

Pact calls NEAR Intents' 1Click-compatible API through Aurora. Every payout quote is built in [`aurora-payout.ts`](apps/web/lib/server/aurora-payout.ts) with these parameters:

| Parameter | Value Pact sends | Why |
|---|---|---|
| `swapType` | `EXACT_INPUT` | The vault can send exactly the allocated amount and nothing more. The payee receives the quoted output, and Pact enforces `minAmountOut` on NEAR |
| `originAsset` | `nep245:v2_1.omni.hot.tg:143_2dmLw…` | Monad USDC as NEAR Intents represents it (bridged through HOT Omni, chain 143) |
| `destinationAsset` | `nep141:17208628…133a1` | **Native** NEAR USDC, not a bridged variant |
| `depositType` / `refundType` | `ORIGIN_CHAIN` / `ORIGIN_CHAIN` | Funds enter from Monad, and a failed swap refunds on Monad |
| `refundTo` | the **event vault** address | A refund returns to the event's own account, never to Pact or the relayer. The vault restores the allocation only after the refunded USDC is actually there (`resolveRouteRefunded` checks solvency) |
| `recipient` / `recipientType` | the payee's NEAR account / `DESTINATION_CHAIN` | Paid straight to `name.near`; the account is checked with `view_account` first |
| `slippageTolerance` | `100` (1%) by default | Bounds `minAmountOut`, which becomes Pact's verification threshold |
| `deadline` | 15 minutes | Pact re-quotes instead of reusing stale quotes |
| `confidentiality` | `public` or `basic` | `basic` when the organizer ticks *Private payment* |

Contributions use **persistent deposit addresses** ([`aurora-intents.ts`](apps/web/lib/server/aurora-intents.ts)): recipient = event vault, one address per funding request × source network × confidentiality. A public contribution page is a single funding request, so all its donors share one address. `confidential: true` is part of the address identity, so a Private contribution address is a different address from the public one. In the Base canary, NEAR Intents carried USDC from Base (asset `base-0x8335…2913.omft.near`) into Monad USDC (`…omni.hot.tg:143_…`) in about 90 seconds. That's two different bridges, settled through one `intents.near` ledger.

### 2. The signature: the organizer authorizes one exact route

The organizer signs an EIP-712 `EventPaymentRoute` with their passkey (Mera): `agreementId`, `paymentId`, `routeId`, **`depositAddress`** (from the NEAR Intents quote), **`amount`**, `nonce` and `deadline`. The vault's `routePayment` checks that signature, moves the amount from *allocated* to *routing*, and transfers exactly that amount to exactly that deposit address. The relayer that submits the transaction cannot change any field. *(The vault contract is baseline. What's new in the hackathon is how a route is closed, below.)*

```mermaid
sequenceDiagram
    autonumber
    participant O as Organizer (passkey)
    participant P as Pact server
    participant A as Aurora API (1Click-compatible)
    participant V as Event vault (Monad)
    participant I as intents.near (NEAR)
    participant T as USDC contract (NEAR)
    participant N as NEAR RPC / FastNEAR
    O->>P: Pay (optionally Private)
    P->>A: quote(EXACT_INPUT, refundTo=vault, recipient=payee.near, confidentiality)
    A-->>P: depositAddress, amountOut, minAmountOut, deadline
    P-->>O: EIP-712 EventPaymentRoute to sign
    O->>P: signature
    P->>V: routePayment(..., depositAddress, amount, sig) [relayer pays gas]
    V->>V: allocated → routing (routeStatus = 1)
    V-->>A: USDC transfer to deposit address
    P->>A: deposit/submit (best-effort hint)
    A->>I: execute_intents (swap + ft_withdraw)
    I->>T: ft_transfer(payee.near, amount)
    loop on page load, at most once per 15 s
        P->>A: status(depositAddress)
        P->>N: fetch delivery tx (public: hash from API; Private: discover via FastNEAR)
        N-->>P: receipts + NEP-141 events
    end
    P->>P: verify, then claim hash (unique)
    P->>V: resolveRouteDelivered(routeId) (routeStatus = 2, paid += amount)
```

### 3. Reading a NEAR Intents delivery: what Pact trusts, and what it ignores

This is the real canary 1 delivery, [`GUyJ6fZW…gRk44`](https://nearblocks.io/txns/GUyJ6fZWpRDcGycr5o91Uisj6MmZQbzRmPdPk4zgRk44), fetched with `EXPERIMENTAL_tx_status` (`wait_until: FINAL`):

| Receipt executed by | Event | What it means | Used by Pact? |
|---|---|---|---|
| `intents.near` | DIP-4 `ft_withdraw` `{account_id: 37b3fb54…, token: 17208628…, receiver_id: codexjames.near, amount: 199917}` | NEAR Intents **requested** a withdrawal from its internal ledger | No. A request is not a transfer |
| `intents.near` | DIP-4 `intents_executed` | The signed intent ran | No |
| `intents.near` | NEP-245 `mt_burn` `{owner_id: 37b3fb54…, amount: 199917, memo: withdraw}` | The internal balance was debited | No |
| **`17208628…133a1`** (USDC contract) | **NEP-141 `ft_transfer` `{old_owner_id: intents.near, new_owner_id: codexjames.near, amount: 199917}`**, status `SuccessValue` | **The tokens actually moved** | **Yes, this is the only evidence that counts** |

![NearBlocks view of transaction GUyJ6fZW…gRk44: execute_intents by intents.near; Withdraw 0.199917 USDC to codexjames.near by NEAR Intents account 37b3fb54…; Token transfer 0.199917 USDC from intents.near to codexjames.near; MT token burn 0.199917 USDC from 37b3fb54…](docs/screenshots/nearblocks-public.png)
*The same delivery on NearBlocks. "Token Transfers" is the NEP-141 receipt Pact verifies; "MT Token Transfers: Burn" is the NEAR Intents internal ledger debit, which Pact does not rely on.*

What [`verifyNearFtDelivery`](apps/web/lib/near-delivery.ts) requires:
1. **Finality:** `final_execution_status` must be `FINAL`. Optimistic execution isn't enough.
2. **Executor, not just log text:** the `ft_transfer` must be logged by a receipt whose `executor_id` **is the token contract**. Any contract can print `EVENT_JSON:` text, so a log from anywhere else is ignored. There's a test that forges exactly this.
3. **Receipt success:** a failed token receipt doesn't count. This matters on NEAR: if the payee isn't registered with the USDC contract (NEP-145 storage), `ft_withdraw` can be requested while the transfer itself fails and is refunded. Pact would keep the payment *Routing*, not *Paid*.
4. **Sender and receiver:** the sender must be `intents.near` and the receiver the payee's verified account.
5. **Amount net of refunds:** transfers back to `intents.near` in the same transaction are subtracted (`ft_transfer_call` refund netting). The net must be at least the quote's `minAmountOut`.
6. **Uniqueness:** before the vault is touched, the hash is written to the route under a unique `(destination_chain, destination_transaction_hash)` index.

NEAR RPC calls fall back across FastNEAR's archival RPC, FastNEAR's free RPC and `rpc.mainnet.near.org` ([`fetchNearTransaction`](apps/web/lib/near-delivery.ts)).

### 4. Private payouts: confidential intents for payroll

`confidentiality: "basic"` routes the swap through NEAR Intents' confidential rail. The organizer chooses it per payment:

![Pact payment page, ready for authorization: amount $0.20, funded $0.20, a ticked "Private payment" option with the explanation that outside observers can see the payee received USDC but not that it came from this event, and a "Pay $0.20" button](docs/screenshots/pay-private-toggle.png)
*The Private option is only offered when the payee is paid on NEAR, because that is where Pact can verify delivery without a hash from the API.*

Here is what we measured on mainnet:

| Observer looks at | Public payout (canary 1) | Private payout (canary 3) |
|---|---|---|
| Monad: vault → deposit address | Visible (amount, deposit address) | Visible (amount, a different deposit address) |
| Aurora / 1Click status for the deposit address | Origin tx, destination tx `GUyJ…`, amounts | Only `{"status":"SUCCESS"}` |
| NEAR: `intents.near` → payee `ft_transfer` | Visible | Visible. The final delivery is public in both modes |
| NEAR Intents explorer | See [NEAR_HACKATHON.md](NEAR_HACKATHON.md#3-private-payout-canary-and-observer-comparison) | See [NEAR_HACKATHON.md](NEAR_HACKATHON.md#3-private-payout-canary-and-observer-comparison) |

![NearBlocks view of the Private delivery B86feaGR…DJKG: execute_intents by intents.near; Withdraw 0.199477 USDC to codexjames.near by NEAR Intents account d868fdbb…; Token transfer 0.199477 USDC from intents.near to codexjames.near; MT token burn from d868fdbb…](docs/screenshots/nearblocks-private.png)
*The Private delivery on NearBlocks has the same shape as the public one in section 3: the final transfer is public, paid from a different NEAR Intents internal account. What differs is the record linking it back to the event vault.*

Because the confidential API withholds the destination hash, Pact proves delivery **from the payee's side** ([`decideDestinationDelivery`](apps/web/lib/server/destination-delivery.ts)):
1. **List candidates:** transactions into the payee's account since the route was created (minus 60 s), from FastNEAR's account index, falling back to NearBlocks.
2. **Exclude claimed hashes:** any hash already claimed by another payout is skipped.
3. **Verify each candidate** with the six rules above, with a ceiling of `amountOut × 1.02` so an unrelated larger transfer can't match.
4. **Require exactly one match.** With exactly one, Pact claims it and closes the route. With two or more, it **refuses to choose** and the payment stays *Routing*.

In canary 3 this found exactly one candidate, `B86feaGR…`, without any hash from the API.

### 5. NEAR accounts as payroll identities

Payees are paid to readable NEAR accounts (`codexjames.near`), not hex addresses. The payee sets this once:

![Payee payout settings in Pact: "Your Mera account" (passkey secured, 0.1 USDC, Mera address 0xf0189D46…FD80120) and "Preferred payment destination: USDC on NEAR", verified, account codexjames.near](docs/screenshots/payout-near-account.png)
*The payee's signing identity (a passkey-backed Mera account) is separate from where they get paid (USDC on `codexjames.near`).*

Two NEAR-specific checks make that safe:
- **The account must exist** (`view_account`, checked when the payee saves the destination). An unknown account makes quotes fail with an opaque `Internal server error`.
- **The account should be registered with the USDC contract** (NEP-145). Otherwise the token transfer fails even though NEAR Intents requested the withdrawal. Pact's verifier rejects a failed transfer (rule 3), so the payment stays *Routing* instead of being falsely marked *Paid*.

### 6. Field notes from mainnet

What we observed running real money through NEAR Intents, and what changed in Pact as a result:

| Observation | Evidence | Change in Pact |
|---|---|---|
| A quote to a non-existent NEAR account returns `Internal server error` (HTTP 400) | Preflight, 2026-11-12 | `view_account` guard on payout destinations |
| The swap completed at 23:48:34 UTC, but the status endpoint returned `PENDING_DEPOSIT` for hours afterwards | Canary 1 | Pact verifies on NEAR itself and reconciles automatically on page load |
| `deposit/submit` failed with `Empty AMQP response` (upstream queue error), yet NEAR Intents still detected the deposit | Canary 3 | The deposit report is best-effort; a confirmed vault transfer alone makes a payout *Routing* |
| NearBlocks' FT-transfer index listed **no** NEAR Intents withdrawals for the payee (`count: 0`), while FastNEAR's account index listed both | Canaries 1 and 3 | Private-payout discovery uses FastNEAR first, NearBlocks as fallback |
| A brand-new named account received NEAR but was not registered with USDC (`storage_balance_of` = `null`) until a wallet action registered it | Payee setup | Documented above; verifier rule 3 |
| Confidential status responses contain only `status` | Canary 3 | Payee-side discovery with fail-closed ambiguity |

Aurora's API is how Pact reaches NEAR Intents (its 1Click-compatible endpoints: quote, deposit submit, status, persistent addresses). It is treated as a router, not as a source of truth.

---

## Honest limitations

- **Refunds are not proven on mainnet.** Pact cannot force a failed route without weakening its own safety rules: it sends exactly the quoted amount before the quote deadline, and re-quotes instead of reusing stale quotes. The refund path (`REFUNDED` → `resolveRouteRefunded` → allocation restored) is covered by Solidity tests ([`PactEventVault.t.sol`](contracts/test/PactEventVault.t.sol)) only.
- **Private payout discovery depends on a third-party index** (FastNEAR, with NearBlocks as fallback) to list candidate transfers, because the confidential API withholds the hash. Verification itself uses NEAR RPC. If both indexes are down, or discovery finds more than one match, Pact does not mark the payment paid.
- **Confidentiality covers the routing link, not the endpoints.** We measured this on mainnet: the vault's transfer on Monad and the final `ft_transfer` on NEAR are public in both modes. What the confidential route withholds is the record connecting them (see section 4 above).
- **NEAR Intents is reached through Aurora's API, not 1Click directly.** Settlement happens on `intents.near` either way, as the NearBlocks evidence shows.
- **No hosted demo.** The app runs locally, and every claim above is verifiable from the repository and public explorers.
- **No AI agents.** Pact does not use AI agents, so it is not entered in agent-based tracks.

---

## Baseline product (not judged)

Built before the hackathon and documented in [`docs/PRODUCT.md`](docs/PRODUCT.md):

| Layer | Role in Pact |
|---|---|
| Dynamic | Email / Google login; the server verifies the JWT, and payees find their agreements by verified email |
| Mera | Passkey-backed signing account: Face ID or Touch ID instead of a wallet or seed phrase |
| Monad | `PactAgreementRegistry` (dual-signature agreements), `PactEventVaultFactory` and `PactEventVault` (one USDC vault per event: allocation, release, routing, refund) |
| PostgreSQL | Off-chain records. No names, emails or invoice text go on-chain |

Contracts on Monad mainnet (chain 143):
- Registry [`0xc2B0…7F49`](https://monadscan.com/address/0xc2B0D2A7e858F13B349843fF87dBF4EBF9227F49)
- Factory [`0x0115…Fa31`](https://monadscan.com/address/0x0115CA8539906db2d9a4beE36C64eA94a0d7Fa31)
- USDC [`0x7547…b603`](https://monadscan.com/address/0x754704Bc059F8C67012fEd69BC8A327a5aafb603)

---

## Run Pact locally

Requirements: Node.js 22.6+, npm, Docker, `psql`, and [Foundry](https://book.getfoundry.sh/) for the Solidity tests.

```bash
git clone https://github.com/JamesVictor-O/pact.git && cd pact
npm ci

# PostgreSQL
docker run --name pact-postgres -e POSTGRES_USER=pact -e POSTGRES_PASSWORD=pact_dev_password \
  -e POSTGRES_DB=pact -p 5434:5432 -d postgres:16
export DATABASE_URL=postgresql://pact:pact_dev_password@localhost:5434/pact
for m in packages/database/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$m"; done

# Configuration
cp apps/web/.env.example apps/web/.env.local
# fill in: DATABASE_URL, Dynamic environment ID, Monad RPC + contract addresses, relayer key,
# AURORA_INTENTS_API_KEY. Optional: NEAR_RPC_URLS, NEARBLOCKS_API_KEY

npm run dev    # http://localhost:3000
```

Checks:

```bash
npm test               # 58 JS tests: route spike, domain accounting, web + NEAR verifier
npm run typecheck
npm run build
forge test --offline   # 24 Solidity tests: registry, treasury, event vault
```

Never put relayer or deployer keys in `NEXT_PUBLIC_*` variables. `.env.local` is git-ignored.

---

## Repository map

| Path | Contents |
|---|---|
| [`apps/web/lib/near-delivery.ts`](apps/web/lib/near-delivery.ts) | NEAR RPC fetch, NEP-141 delivery verification, account checks, Private-payout discovery |
| [`apps/web/lib/server/`](apps/web/lib/server) | Aurora / NEAR Intents clients, delivery decisions, vault execution and reconciliation, repositories |
| [`apps/web/scripts/near/`](apps/web/scripts/near) | Preflight, delivery verifier, outside-observer capture |
| [`apps/web/app/`](apps/web/app) | Next.js organizer, sponsor and payee interfaces plus API routes |
| [`contracts/`](contracts) | Solidity contracts and Foundry tests |
| [`packages/database/migrations/`](packages/database/migrations) | PostgreSQL schema (015 is the hackathon migration) |
| [`NEAR_HACKATHON.md`](NEAR_HACKATHON.md) | Canary runbook and evidence log |
| [`aurora.md`](aurora.md) | Integration journal, including failures and corrections |

## Libraries and infrastructure

- **Infrastructure:** NEAR Intents (through Aurora's Intents API), NEAR mainnet public RPC (FastNEAR, near.org), NearBlocks API (Private-payout discovery only), Monad mainnet, Base (sponsor source in the canary).
- **Application:** Next.js 16, React 19, viem, framer-motion, lucide-react, pg, jose, three, `@dynamic-labs/sdk-react-core`, `@category-labs/mera`, `@fontsource/inter`.
- **Contracts:** Solidity with OpenZeppelin Contracts (ECDSA, EIP712, SafeERC20, ReentrancyGuard), Foundry and forge-std.
- AI coding assistants were used during development.
