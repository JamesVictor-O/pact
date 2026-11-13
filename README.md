# Pact

Pact is finance software for people who produce events. An organizer records where the event's money comes from (sponsors, grants, their own funds) and who the event has agreed to pay (venues, crews, freelancers), then pays those people from a dedicated USDC account for the event.

Event money sits in several states at once, and spreadsheets blur them. A sponsor promising $30,000 is not the same as $13,000 that has arrived, and neither tells you whether the $16,500 due in two weeks can be paid. Pact tracks each state separately (**committed ≠ received ≠ available ≠ allocated ≠ paid**). It only moves a payment to *paid* when there is verifiable evidence that the money arrived.

**NEAR Intents is how money enters and leaves an event.** A sponsor can pay from whichever chain they already hold funds on, and a payee can be paid on NEAR, without either of them bridging. Pact does not take the routing service's word that a payout arrived. It reads the NEAR transaction from public RPC and checks the recipient, token and amount itself.

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
| 3 | **Private payouts** | Payroll is sensitive. The organizer can tick *Private payment* for a payee paid on NEAR, and the quote uses NEAR Intents `confidentiality: "basic"`. For confidential routes the API withholds the destination hash, so Pact finds candidate transfers from the payee's side (NearBlocks), verifies each on RPC as in #1, and **fails closed** if more than one matches. | [`PaymentDetail.tsx`](apps/web/app/events/[eventId]/payments/[paymentId]/PaymentDetail.tsx), [`aurora-payout.ts`](apps/web/lib/server/aurora-payout.ts), [`destination-delivery.ts`](apps/web/lib/server/destination-delivery.ts) |
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

**Expected:** `5 + 6 + 45` tests pass, with 0 failures. Eleven of them test the NEAR delivery verifier against a trimmed **real mainnet NEAR Intents USDC withdrawal** ([`fixtures/near-usdc-intents-withdrawal.json`](apps/web/lib/fixtures/near-usdc-intents-withdrawal.json)). One checks that the real delivery verifies. Most of the others change a single detail and check that verification fails: the recipient, the token contract, the sender, a log forged by another contract, a failed receipt, a non-final status, and an amount below the minimum. The rest cover refund netting, asset-ID mapping and Private-payout discovery filtering. See [`near-delivery.test.ts`](apps/web/lib/near-delivery.test.ts).

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

Live canaries still open (Private payout, NEAR-wallet contribution) are tracked with their status in [NEAR_HACKATHON.md](NEAR_HACKATHON.md).

---

## How it works

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

Aurora's API is how Pact reaches NEAR Intents (its 1Click-compatible endpoints: quote, deposit submit, status, persistent addresses). It is treated as a router, not as a source of truth.

---

## Honest limitations

- **Refunds are not proven on mainnet.** Pact cannot force a failed route without weakening its own safety rules: it sends exactly the quoted amount before the quote deadline, and re-quotes instead of reusing stale quotes. The refund path (`REFUNDED` → `resolveRouteRefunded` → allocation restored) is covered by Solidity tests ([`PactEventVault.t.sol`](contracts/test/PactEventVault.t.sol)) only.
- **Private payout discovery depends on NearBlocks** to list candidate transfers, because the confidential API withholds the hash. Verification itself still uses NEAR RPC. If discovery finds more than one candidate, Pact refuses to mark the payment paid. It does not guess.
- **Confidentiality covers the routing path, not the endpoints.** Per the NEAR Intents confidential docs, the final transfer to the payee is still a public NEAR transaction. The comparison of what an observer sees with and without Private is tracked in [NEAR_HACKATHON.md](NEAR_HACKATHON.md#3-private-payout-canary-and-observer-comparison).
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
npm test               # 56 JS tests: route spike, domain accounting, web + NEAR verifier
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
