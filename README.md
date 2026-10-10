# Pact

> The financial operating layer for events: know what is funded, what is due, and what can safely be paid.

Pact connects event funding, payment agreements, allocation, and settlement in one system. Sponsors can fund an event from supported chains, organizers can reserve received money against signed obligations, and payees can track and receive scheduled payments without managing bridges, seed phrases, or gas.

Pact is a working hackathon project on Monad mainnet. It combines [Dynamic](#dynamic-verified-identity), [Mera](#mera-passkey-backed-authorization), [Monad](#monad-verifiable-agreements-and-event-vaults), and [Aurora Intents](#aurora-intents-cross-chain-entry-and-exit) behind a financial interface built for non-crypto users.

## The problem Pact solves

Event finance is not one balance and one payment. Sponsors commit funds before transferring them. Venues, production teams, speakers, contractors, and other payees expect deposits and installments on different dates. Organizers reconcile those promises through spreadsheets, invoices, chats, screenshots, and bank accounts.

That workflow hides the most important distinction:

```text
Committed is not received.
Received is not available.
Available is not allocated.
Allocated is not paid.
```

An event can appear fully funded and still miss its next payment:

| Financial state | Amount |
|---|---:|
| Funding committed | $30,000 |
| Funding received | $13,000 |
| Due within 14 days | $16,500 |
| Immediate cash gap | $3,500 |

A bank balance cannot explain which money is promised, reserved, refundable, or safe to spend. Pact models each state independently.

## The solution

Pact gives every event a live financial graph:

```text
Funding -> Agreements and expenses -> Allocation -> Payment or refund
```

The product serves three participants:

- **Organizer**: creates the event, requests funding, defines payment schedules, signs agreements, allocates received money, and authorizes payouts
- **Sponsor or donor**: opens a funding link and transfers a supported asset from a supported network without joining Pact or manually bridging
- **Payee**: signs in with a verified email, reviews the agreement and invoice, accepts with a passkey, tracks scheduled payments, and selects a payout destination

Pact deliberately avoids ticketing, RSVP management, event websites, and vendor discovery. It focuses on the financial state between money promised to an event and money paid out by it.

## The end-to-end flow

The current product connects identity, agreements, funding, and settlement instead of presenting them as isolated demos.

1. **Create an event**: the organizer creates a Pact with its date, budget, and currency. Pact provisions one deterministic USDC vault for that event on Monad.
2. **Request or accept funding**: the organizer sends a sponsor request or enables a reusable public contribution page.
3. **Route the contribution**: Aurora creates a persistent deposit address for the selected source-chain family. The sponsor transfers a supported asset. Aurora converts and delivers USDC to the event vault.
4. **Verify the receipt**: Pact independently verifies the Monad receipt, USDC contract, vault recipient, amount, transaction hash, and log index before increasing received funding.
5. **Create an obligation**: the organizer creates an expense, payee, invoice, and one-time or installment payment schedule.
6. **Accept the agreement**: the organizer and payee sign exact EIP-712 payloads with their Mera-backed Pact accounts. Pact registers the accepted agreement on Monad.
7. **Allocate real money**: the organizer reserves confirmed vault funds against a scheduled payment. Allocation cannot spend an unreceived commitment.
8. **Release the payment**: the organizer signs a direct Monad release or an exact Aurora route. Pact marks a payment paid only after verifiable settlement evidence exists.

The financial lifecycle stays explicit:

```text
Unfunded -> Partially funded -> Funded -> Ready to pay
         -> Processing or Routing -> Paid
```

## Why this needs blockchain infrastructure

Pact does not add blockchain to a spreadsheet. Each infrastructure layer removes a specific trust or usability failure.

| Infrastructure | Responsibility | What it prevents |
|---|---|---|
| Dynamic | Verified login and record access | A browser claiming another payee’s email or financial records |
| Mera | Passkey-backed signing and Pact accounts | A relayer inventing agreement or payment authority |
| Monad | Agreement registry and event-scoped USDC vaults | Database-only financial truth and unconstrained fund movement |
| Aurora Intents | Cross-chain funding and payout routes | Sponsors and payees manually bridging into and out of Monad |

The layers connect as follows:

```mermaid
flowchart LR
    O[Organizer] --> D[Dynamic identity]
    P[Payee] --> D
    D --> W[Pact web application]
    W --> M[Mera passkey authorization]
    M --> R[Pact relayer]
    R --> G[PactAgreementRegistry on Monad]
    R --> V[Event USDC vault on Monad]
    S[Sponsor or donor] --> A[Aurora persistent address]
    A --> V
    V --> X[Direct Monad payout]
    V --> Q[Aurora payout route]
    Q --> P
```

### Dynamic: verified identity

Dynamic gives organizers and payees familiar email or Google authentication. Pact verifies the Dynamic JSON Web Token on the server, resolves a canonical user identity, and derives the payee’s accessible agreements from the verified email. The browser cannot select an arbitrary email to read another person’s records.

Implementation evidence:

- [`PactAuthProvider.tsx`](apps/web/app/components/PactAuthProvider.tsx): Dynamic client integration and authenticated session handling
- [`auth.ts`](apps/web/lib/server/auth.ts): server-side token verification and canonical identity resolution
- [`user-identity-repository.ts`](apps/web/lib/server/user-identity-repository.ts): stable user mapping across returning sessions
- [`auth-routing.ts`](apps/web/lib/auth-routing.ts): organizer and payee post-login routing

### Mera: passkey-backed authorization

Mera acts as Pact’s account and authorization layer. Face ID, Touch ID, or a device passkey derives the signing account used for agreement proposals, payee acceptance, event-vault creation, allocation, direct release, cross-chain routing, and withdrawals. Pact never asks a user to install a browser wallet or store a seed phrase.

On a new device, Pact asks the browser for the existing discoverable passkey and verifies that its derived address matches the signing address already bound to the Dynamic identity. The local unlock method may differ between devices: Face ID, fingerprint, device PIN, or password can unlock the same synced passkey. Pact rejects a different passkey instead of silently creating or binding a second financial identity.

Production uses `NEXT_PUBLIC_PACT_PASSKEY_RP_ID` as a stable relying-party domain. A passkey created for `localhost`, a preview deployment, or another domain cannot derive the production account.

The relayer pays gas and submits signed payloads, but it cannot change the recipient, amount, agreement, route, nonce, or deadline. Pact does not persist the raw private signing material.

Implementation evidence:

- [`pact-account-adapter.ts`](apps/web/lib/pact-account-adapter.ts): passkey-backed account derivation and typed-data signing
- [`agreement-typed-data.ts`](apps/web/lib/agreement-typed-data.ts): canonical agreement proposal and acceptance payloads
- [`pact-account API`](apps/web/app/api/pact-account/route.ts): server-side signing-address binding
- [`vault-execution.ts`](apps/web/lib/server/vault-execution.ts): verification and relay of allocation, release, and route authorizations

### Monad: verifiable agreements and event vaults

Monad stores the minimum shared financial state. Names, emails, notes, invoice prose, and other personally identifiable information remain offchain in PostgreSQL.

Three Solidity contracts define Pact’s trust boundary:

| Contract | Purpose | Source |
|---|---|---|
| `PactAgreementRegistry` | Verifies both EIP-712 signatures and anchors agreement, schedule, and invoice hashes | [`PactAgreementRegistry.sol`](contracts/src/PactAgreementRegistry.sol) |
| `PactEventVaultFactory` | Creates one deterministic, permanent vault per event after organizer authorization | [`PactEventVaultFactory.sol`](contracts/src/PactEventVaultFactory.sol) |
| `PactEventVault` | Holds USDC, reserves allocations, releases payments, starts routes, resolves delivery or refund, and returns eligible funds | [`PactEventVault.sol`](contracts/src/PactEventVault.sol) |

Every state-changing financial instruction includes a nonce and deadline. The vault checks active registry state before allocation, prevents allocation above available balance, prevents release above the reserved amount, and rejects replayed signatures.

Cross-chain payouts use a two-phase state model. Sending vault USDC to an Aurora deposit address creates `Routing`, not `Paid`. Only the configured resolver can close the exact route as delivered or refunded. The resolver cannot redirect value or alter the signed route.

Server integration lives in:

- [`registry.ts`](apps/web/lib/server/registry.ts): agreement registration and confirmation
- [`event-vault.ts`](apps/web/lib/server/event-vault.ts): deterministic event-vault provisioning
- [`vault-execution.ts`](apps/web/lib/server/vault-execution.ts): allocation, direct release, route submission, and resolution

### Aurora Intents: cross-chain entry and exit

Aurora Intents lets value enter and leave Pact without making the participant operate a bridge.

For inbound funding, Pact requests a persistent address for the sponsor’s source-chain family. Aurora detects the transfer, swaps the source asset, and delivers canonical USDC to the event vault on Monad. Public contribution pages reuse one route per event and source family, so 100 donors do not require 100 addresses.

Pact does not treat Aurora’s status response as financial finality. The reconciliation service fetches the Monad transaction receipt, decodes USDC `Transfer` logs, verifies the event vault as recipient, and deduplicates each receipt by chain, transaction hash, and log index. It stores token atomic units so sub-cent swap output cannot inflate available funds.

For outbound settlement, a payee selects a supported network, USDC asset, and validated address. Pact fetches the destination catalog server-side, verifies the address family, requests an exact-input quote, and binds the organizer’s signature to that route. Delivery and refund remain separate terminal states.

Implementation evidence:

- [`aurora-intents.ts`](apps/web/lib/server/aurora-intents.ts): availability checks, persistent addresses, status, history, and asset discovery
- [`aurora-repository.ts`](apps/web/lib/server/aurora-repository.ts): chain-neutral observations and independently verified receipt reconciliation
- [`aurora-payout.ts`](apps/web/lib/server/aurora-payout.ts): destination discovery, quotes, deposit submission, and route status
- [`payout-destinations.ts`](apps/web/lib/payout-destinations.ts): EVM, Solana, Stellar, Bitcoin, Tron, and NEAR address-family validation
- [`006_aurora_intents.sql`](packages/database/migrations/006_aurora_intents.sql): inbound route persistence
- [`008_cross_chain_payouts.sql`](packages/database/migrations/008_cross_chain_payouts.sql): payout route and settlement persistence
- [`012_chain_neutral_aurora_reconciliation.sql`](packages/database/migrations/012_chain_neutral_aurora_reconciliation.sql): non-EVM reconciliation data model
- [`014_payout_profile_revisions.sql`](packages/database/migrations/014_payout_profile_revisions.sql): versioned payee-selected payout preferences

The full integration journal, including failures and corrections, is in [`aurora.md`](aurora.md).

## Technical safeguards

Pact treats retries, partial failure, and financial precision as core product requirements:

- **Dual-signature finality**: a browser signature produces `Finalizing agreement`; only a confirmed registry transaction produces `Active`
- **Verified receipts**: Aurora observations remain evidence, while only a matching Monad USDC transfer credits received funds
- **Idempotent reconciliation**: unique receipt keys prevent repeated sync requests from crediting the same transfer twice
- **Exact token precision**: USDC atomic units remain intact; Pact carries sub-cent remainders forward instead of rounding available funds upward
- **Separated accounting**: commitments, receipts, availability, allocations, routing, payments, and refunds use distinct states
- **Constrained relayer**: the relayer submits exact user signatures and pays gas; it cannot fabricate authority or choose new recipients
- **Refund solvency**: a failed routed payout restores its allocation only after the returned USDC exists in the event vault
- **Locked accepted terms**: organizers cannot edit the material terms of an accepted payment agreement in the current MVP
- **Private identity data**: personal information and document contents stay offchain; only integrity hashes and financial references reach Monad

## Mainnet deployment and verified behavior

Pact currently targets Monad mainnet, chain ID `143`.

| Component | Address |
|---|---|
| `PactAgreementRegistry` | `0xc2B0D2A7e858F13B349843fF87dBF4EBF9227F49` |
| Route-resolution `PactEventVaultFactory` | `0x0115CA8539906db2d9a4beE36C64eA94a0d7Fa31` |
| Pact route resolver | `0x2e5d8B56F9B4770a88794a47C32c177542d2f6ea` |
| Canonical Monad USDC | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` |

Verified mainnet inbound canaries include:

- Arbitrum native ETH converted into `0.035305 USDC` in the correct Monad event vault: settlement transaction `0xb61cf6b91c273113f2370ea418b07f3643ea96c2e2a294dfe011c89f8bd6c6aa`
- Stellar XLM converted into `0.212437 USDC` in the correct Monad event vault: settlement transaction `0x5dede1f53f3ad2ed6bf69a385102525149d5b12c37758b42871a421d5dc46712`
- Repeated EVM and non-EVM syncs reconciled through the same chain-neutral receipt pipeline

These tests exposed real integration failures that Pact then corrected: route-specific minimums, transaction hashes from the wrong chain, non-EVM transaction identity, reused persistent addresses, and settlement amounts smaller than one USD cent.

## Current product status

The repository contains a functional product rather than a landing-page prototype:

- Organizer and payee login with server-verified Dynamic identity
- Returning-user event navigation and event workspaces
- Funding sources, commitments, funding requests, and public contribution pages
- Aurora persistent-address funding from EVM and non-EVM source families
- Independent Monad destination-receipt verification
- Expenses with one-time, deposit-and-balance, or custom payment schedules
- Pact-prepared invoices and immutable accepted terms
- Mera-backed organizer proposals and payee acceptance
- Monad agreement registration with safe retry and reconciliation
- Event-level USDC vaults, allocation, direct release, refund, and route accounting
- Payee workspaces for agreements, scheduled payments, overdue state, and payout preferences
- Aurora outbound quote, authorization, route, delivery, and refund implementation

The current verification suite contains:

- 5 payment-route spike tests
- 6 domain accounting tests
- 34 web and integration tests
- 24 Solidity tests across the registry, legacy treasury, factory, and event vault

Run the same checks with [`npm test`](#run-the-test-suite) and `forge test --offline`.

## Honest implementation boundary

Inbound Aurora routing has completed live mainnet canaries. Direct Monad USDC release is the confirmed payout path.

Outbound Aurora settlement is implemented across the contract, database, API, authorization, and reconciliation layers. It remains feature-gated until live delivery and refund canaries confirm the complete production route. Pact does not label `Routing` as `Paid`, and this README does not claim that every Aurora-listed chain and asset pair has been proven end to end.

Production hardening still includes scheduled reconciliation workers, operational alerts, support tooling, and broader route-by-route canaries.

## Repository map

Use this map to trace each product claim to its implementation:

| Path | Responsibility |
|---|---|
| [`apps/web/app`](apps/web/app) | Next.js organizer, sponsor, donor, and payee interfaces plus API routes |
| [`apps/web/lib/server`](apps/web/lib/server) | Authentication, repositories, relayers, Aurora integration, and receipt reconciliation |
| [`apps/web/lib`](apps/web/lib) | Domain derivations, typed data, account adapter, validation, and tests |
| [`contracts/src`](contracts/src) | Monad agreement registry, event-vault factory, event vault, and legacy treasury |
| [`contracts/test`](contracts/test) | Solidity authorization, solvency, replay, route, and refund tests |
| [`packages/database/migrations`](packages/database/migrations) | PostgreSQL financial, identity, vault, route, and settlement schema |
| [`packages/domain/src`](packages/domain/src) | Framework-independent financial state model |
| [`aurora.md`](aurora.md) | Aurora integration journal, mistakes, corrections, canaries, and open validation work |
| [`PACT_PRODUCT_FLOW.md`](PACT_PRODUCT_FLOW.md) | Product lifecycle and state definitions |
| [`PACT_PITCH_DECK_BRIEF.md`](PACT_PITCH_DECK_BRIEF.md) | Product narrative, evidence, and claim boundaries |

## Run Pact locally

Local development requires Node.js with npm, Docker, PostgreSQL’s `psql` client, and Foundry for Solidity tests.

### 1. Install dependencies

```bash
git clone https://github.com/JamesVictor-O/pact.git
cd pact
npm ci
```

### 2. Start PostgreSQL

Create the local database once:

```bash
docker run --name pact-postgres \
  -e POSTGRES_USER=pact \
  -e POSTGRES_PASSWORD=pact_dev_password \
  -e POSTGRES_DB=pact \
  -p 5434:5432 \
  -d postgres:16
```

For later sessions, start the existing container:

```bash
docker start pact-postgres
```

### 3. Configure the application

Copy the documented environment template:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Set the local database connection first:

```dotenv
DATABASE_URL=postgresql://pact:pact_dev_password@localhost:5434/pact
DATABASE_SSL=false
```

Then add your Dynamic environment, Monad RPC, deployed contract, relayer, and Aurora credentials from [`apps/web/.env.example`](apps/web/.env.example). Never expose relayer or deployer private keys through `NEXT_PUBLIC_*` variables.

### 4. Apply database migrations

Apply every migration in filename order:

```bash
export DATABASE_URL=postgresql://pact:pact_dev_password@localhost:5434/pact
for migration in packages/database/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done
```

### 5. Start the application

```bash
npm run dev
```

Open `http://localhost:3000`.

## Run the test suite

Run the route spike, domain, and web tests:

```bash
npm test
```

Run TypeScript validation and the production build:

```bash
npm run typecheck
npm run build
```

Run the Solidity suite without external signature lookups:

```bash
forge test --offline
```

## Suggested judge walkthrough

The strongest review path follows one event and one obligation:

1. Create an event and confirm its event account is ready.
2. Create a sponsor request or open the event’s public support page.
3. Choose a source-chain family and inspect the Aurora payment instructions.
4. Create an expense with a deposit and final balance.
5. Sign the organizer proposal with a passkey-backed Pact account.
6. Sign in as the payee with the invited email, review the prepared invoice, and accept.
7. Return as the organizer and inspect agreement finality, funding coverage, and the payment schedule.
8. Allocate confirmed funding and inspect the exact payment-release authorization.

Use a route already verified in the target environment for any live funding demo. Route availability and minimums vary by source chain and asset.

## Hackathon relevance

Pact demonstrates a consumer-facing financial workflow that depends on multiple blockchain primitives working together:

- Passkey-backed authorization replaces wallet onboarding without weakening signature-level authority
- Dual-signature agreement registration creates verifiable consent while keeping private documents offchain
- Event-scoped smart-contract vaults turn a balance into programmable financial state
- Cross-chain intents let sponsors fund from existing assets while Monad remains the canonical settlement layer
- Independent receipt verification prevents an external routing API from becoming Pact’s sole source of financial truth
- Explicit routing and refund states handle asynchronous cross-chain failure without overstating payment finality

The result is not a collection of sponsor integrations. Dynamic establishes identity, Mera establishes human authorization, Monad enforces financial state, and Aurora connects that state to assets held on other networks.

## Product principle

Pact exposes normal financial actions such as **Add funding**, **Allocate funds**, **Ready to pay**, and **Paid**. Wallets, bridges, gas, hashes, and typed signatures stay below the interface unless a user needs technical evidence.

The intended reaction is:

> “Wait, this is a Web3 product?”
