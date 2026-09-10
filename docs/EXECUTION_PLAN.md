# Morva — Metropolis Hackathon Execution Plan

Status: **Awaiting review; implementation is blocked until approval**

Track: Consumer Products & Payments

Deadline: October 13, 2026

Delivery shape: six weeks, one builder

## 1. Outcome and MVP boundary

Morva lets a merchant set a Monad settlement stablecoin, create a fixed-amount payment link, and share it as a URL or QR code. A buyer can view the checkout without logging in, connect or create a Dynamic embedded wallet, and fund the payment using a live Aurora Intents route. The merchant is credited only after Morva's backend independently matches a finalized Monad transfer through Envio.

The backend is metadata and verification infrastructure only. Funds must move on-chain from the buyer/intent execution path to the merchant; no Morva-controlled custody address may appear in the payment path.

### MVP definition of done

The demo is complete only when all of the following work on deployed environments:

1. A merchant onboards and saves one supported Monad settlement token and recipient address.
2. The merchant creates a one-time, fixed-amount link with an immutable 24-hour expiry.
3. The public `/pay/:id` page renders without buyer authentication and clearly shows recipient context, amount, token, expiry, and payment state.
4. A buyer authenticates through Dynamic only when ready to pay and obtains a viable Aurora Intents quote/route from a deliberately small supported-asset matrix.
5. The payment settles directly to the merchant on Monad.
6. Envio observes the finalized transfer and the API independently matches recipient, token, amount, chain, and transaction identity before atomically marking the link paid.
7. The same transaction cannot settle a second link; mismatched, late, duplicate, or unverified claims leave a link unpaid.
8. The merchant dashboard shows pending, paid, and expired links, and a created link can be copied or rendered as a client-generated QR code.

### Explicitly later — do not build in v1

- Reusable links or buyer-entered amounts
- Email receipts
- Refunds
- Webhooks
- Custom merchant branding
- The former developer SDK surface, unless the entire MVP is stable and time remains
- Nansen buyer-address reputation, which is the first stretch feature after the core path

## 2. Repository structure and rationale

```text
morva/
├── apps/
│   ├── web/                 # Merchant dashboard + public checkout
│   ├── api/                 # Metadata API + verification coordinator
│   └── indexer/             # Envio config, handlers, indexed projection
├── packages/
│   ├── domain/              # Shared state machine, types, validation rules
│   ├── database/            # Schema, migrations, repository interfaces
│   └── config/              # Shared TS, lint, test, env configuration
├── contracts/               # Empty architecture gate; no contract by default
├── tests/
│   └── e2e/                 # Cross-app critical-path acceptance tests
├── docs/
│   └── EXECUTION_PLAN.md
└── README.md
```

This is a small monorepo because the checkout, verifier, and indexer share exact token/amount/state semantics, while still needing separate deploy and trust boundaries. `apps/web` must be unable to mark a link paid. `apps/api` owns state transitions and database writes. `apps/indexer` converts Envio chain data into a queryable settlement projection. Shared domain code prevents different services from interpreting decimals, expiry, or state transitions differently.

No custom contract is assumed. A standard stablecoin transfer directly to the merchant is preferable when Aurora Intents can produce it and Envio can prove it. `contracts/` exists only to make any later change explicit rather than smuggling contract scope into the MVP.

Provisional implementation baseline after approval: a TypeScript workspace, a React/Next.js web application, a TypeScript API service, PostgreSQL, and Envio's supported TypeScript indexer tooling. Exact framework and version choices should be locked only after checking current vendor quickstarts and deployment constraints during setup.

## 3. System boundaries and trust model

### Payment flow

```text
Merchant creates link -> buyer opens checkout -> route/quote is obtained
-> buyer authorizes intent -> funds settle to merchant on Monad
-> Envio indexes finalized transfer -> API matches immutable link terms
-> one database transaction records payment + marks link paid
```

The client can submit a transaction or intent identifier as a discovery hint, never as proof. The API must query the authoritative indexed result and compare it to a server-stored snapshot of the link terms.

### Core records

- `merchant`: identity, Monad recipient address, chosen settlement token, timestamps.
- `payment_link`: opaque random public ID, merchant ID, recipient snapshot, settlement chain ID, token contract/native marker, integer base-unit amount, display metadata, `pending|paid|expired`, creation and exact expiry timestamps.
- `payment`: link ID (unique), chain ID, transaction hash, event/log/trace identity where applicable, buyer or observed sender address, recipient, token, integer base-unit amount, block number/hash, finality timestamp, verification timestamp.
- `verification_attempt`: optional operational audit record containing claimed identifier, result/reason, and timestamps; never a substitute for a payment record.

Database constraints must make `(chain_id, tx_hash, transfer_identity)` globally unique and `payment.link_id` unique. For a simple transaction containing one relevant transfer, the transaction hash may be sufficient; if one transaction can contain multiple transfers, log index or trace index is required. The user requirement to prevent transaction-hash reuse should still be enforced at minimum with a unique `(chain_id, tx_hash)` constraint unless the verified Aurora flow demonstrably batches multiple independent Morva payments in one transaction. That choice must be documented before relaxing it.

### State and verification invariants

- Store amounts as integer base units; never verify using floating point or formatted strings.
- Snapshot recipient, token, amount, and chain onto the link so later merchant preference changes cannot alter an open invoice.
- `pending -> paid` is permitted only within one database transaction that inserts a unique verified payment and conditionally updates a still-pending, unexpired link.
- `pending -> expired` is monotonic. Expiry is enforced on reads and writes, not dependent solely on a scheduled job.
- `paid` and `expired` are terminal for v1. There is no partial or `payment_submitted` state exposed as settlement success.
- Require the configured Monad finality threshold before verification succeeds. The initial assumption is protocol finality around 800ms, but Envio visibility and reorg behavior must be measured rather than hard-coded from marketing latency.
- ERC-20 verification must match token contract, decoded recipient, and exact base-unit amount. Native verification must match trace recipient/value using Envio trace data.
- Normalize addresses for comparison without destroying the canonical transaction data retained for audit.
- API retries and Envio duplicate deliveries must be idempotent.
- A quote expiring, solver failing, or verification timing out leaves the link pending and gives the buyer a safe retry path; it never fabricates success.

## 4. Dependency-ordered execution backlog

### Gate 0 — approve plan and freeze assumptions

1. Review this plan and resolve the blocking open questions in section 7.
2. Confirm the first settlement stablecoin, Monad network/environment, merchant identity method, and deployment target.
3. Record architecture decisions for the direct-transfer shape and transaction uniqueness rule.

No feature code precedes this gate.

### Gate 1 — week-one gas and route feasibility spike (blocks checkout architecture)

1. Build a small route matrix for mainstream buyer assets: ETH, USDC, and SOL from a few source chains to the chosen Monad stablecoin. Record live availability, minimums, fees, quote TTL, latency, and test environment support; do not turn advertised aggregate support into UI promises.
2. Trace one Aurora Intents/HOT Bridge route end-to-end and answer: who submits the final Monad transaction, who pays Monad gas, what exact recipient reaches the final transfer, and which identifiers map the intent to the Monad transaction?
3. Test the separate same-chain case where a buyer already owns the settlement asset on Monad. Determine whether a normal wallet transfer is acceptable, whether Dynamic can sign it without sponsorship, and what low-friction gas option is actually available.
4. Verify Dynamic embedded-wallet support for Monad chain configuration and transaction signing separately from sponsorship. Confirm whether its support or relayer list changed before implementation.
5. Decide among only evidenced paths:
   - Aurora solver pays destination gas for cross-chain intents; no buyer Monad gas is needed in that flow.
   - Same-chain buyers pay normal Monad gas, with clear UX and no false "gasless" claim.
   - A narrowly scoped relayer/paymaster is required. This triggers a threat model, abuse controls, cost cap, and explicit scope approval before build.
6. Produce a written spike report with transaction links, captured API payload shapes, failure cases, and a go/no-go decision.

**Exit criterion:** at least one repeatable source-to-Monad test route settles directly to a merchant-controlled address and exposes enough final-chain identity for Envio verification. If this fails, stop and redesign; do not build the checkout around a hypothetical gasless flow.

### Gate 2 — verification and data proof (blocks payment completion UX)

1. Define the canonical settlement-asset registry: chain ID, token address, symbol, decimals, and native/ERC-20 transfer type. Start with one settlement stablecoin.
2. Configure a minimal Envio indexer for that asset and recipient-independent transfer capture. Confirm observed latency, finality semantics, historical backfill, duplicate behavior, and trace support if native value is in scope.
3. Specify the API-to-indexer query contract and how intent IDs resolve to final Monad transaction hashes.
4. Create the database model and constraints for immutable link terms, payment uniqueness, and atomic transitions.
5. Prove verifier behavior with fixtures: exact match succeeds; wrong recipient/token/amount/chain fails; unknown transaction stays pending; duplicate and replay fail; post-expiry settlement follows the agreed policy.
6. Document recovery for indexer lag/outage: durable retry/reconciliation without trusting the browser.

**Exit criterion:** a known Monad transfer can be independently indexed, matched, and idempotently recorded, while negative and replay tests remain unpaid.

### Gate 3 — thin vertical slice

1. Set up the workspace, environment validation, CI, database migrations, and deployment skeleton.
2. Implement merchant authentication/onboarding and settlement preference.
3. Implement server-side link creation with a cryptographically random ID, exact base-unit amount, recipient/token snapshot, and server-generated 24-hour expiry.
4. Implement the read-only public checkout and a minimal dashboard.
5. Connect the proven intent route and Dynamic signer behind capability checks derived from live quote results.
6. Connect transaction discovery to backend verification and status polling/subscription. Display "submitted/verifying" only as transient UI copy while persisted link state remains pending.
7. Complete one deployed end-to-end payment.

### Gate 4 — hardening and product completion

1. Add client-side QR generation from the canonical link URL; test scanning on common mobile devices.
2. Make payment submission and verification retry-safe across refreshes, duplicate clicks, stale quotes, wallet cancellation, and delayed indexing.
3. Add expiry, mismatch, replay, API authorization, input-validation, rate-limit, and concurrency tests.
4. Add observability for route failure, verification lag/failure, duplicate detection, and state-transition errors without logging secrets or sensitive wallet-session material.
5. Conduct mobile usability and accessibility passes for the Nigerian merchant/buyer wedge, including slow networks and clear fiat/stablecoin denomination copy.
6. Prepare seed/demo data, a deterministic demo route, fallback recording, architecture diagram, and concise judge narrative.

### Gate 5 — stretch only after MVP stability

1. Add a Nansen reputation lookup as a non-blocking risk signal, define failure/timeout behavior, and avoid labeling an address malicious without a clear source/result.
2. Reconsider the old SDK surface only if deployed MVP acceptance tests are green and the demo is already rehearsed.

## 5. Six-week milestone plan

### Week 1 — feasibility, not screens

- Complete Gate 1 and publish the gas/route spike report.
- Select one settlement stablecoin and the smallest reliable source-asset matrix.
- Prove Dynamic signing behavior and identify the destination transaction.
- Start Envio proof for the actual resulting transfer shape.

Milestone: a go/no-go architecture decision backed by at least one real test settlement. A failed spike causes an immediate scope/architecture review.

### Week 2 — authoritative verification foundation

- Finish the Envio proof and API/indexer boundary.
- Lock schema, immutable link snapshot, base-unit handling, uniqueness constraints, state transitions, and expiry policy.
- Automate positive, mismatch, replay, idempotency, and concurrency tests around verification.
- Establish CI and preview/development environments.

Milestone: chain data—not a browser claim—can atomically settle a test link exactly once.

### Week 3 — merchant and public link vertical slice

- Build merchant onboarding and one-time settlement preference.
- Build fixed-amount link creation with a hard 24-hour expiry.
- Build public link retrieval and checkout summary; no login required to view.
- Build the basic pending/paid/expired dashboard.

Milestone: a merchant can create/share a valid link and both surfaces reflect the server-owned state.

### Week 4 — real payment integration

- Integrate Dynamic at the moment of payment.
- Integrate live Aurora quote, authorization, submission, and intent-to-Monad transaction resolution.
- Connect Envio-backed verification and safe pending/retry UX.
- Complete a deployed end-to-end cross-chain payment.

Milestone: buyer payment reaches the merchant directly and the dashboard becomes paid only after independent verification.

### Week 5 — resilience and mobile usability

- Test solver/quote failures, indexing delay, refresh/retry, duplicate submission, replay, mismatch, expiry, and concurrent verification.
- Add QR generation and mobile scanning tests.
- Improve low-bandwidth UX, error copy, accessibility, monitoring, and operational reconciliation.
- Run a focused security review of auth boundaries, database writes, secrets, callbacks, and relayer abuse if a relayer was approved.

Milestone: the core path is reliable enough for an unfamiliar buyer on a phone and survives expected failure modes.

### Week 6 — deploy, rehearse, submit

- Freeze features early in the week; fix only demo- or security-blocking issues afterward.
- Run production-like end-to-end tests and rehearse with a pre-verified liquid route.
- Prepare the demo video, README, architecture/security explanation, pitch, and backup recording.
- Add Nansen only if the cut-line checklist is already green.
- Submit before October 13 with buffer for network or platform failures.

Milestone: stable deployment, repeatable demo, clear non-custodial/verification story, and submitted project.

## 6. Cut line and scope-drop order

### Above the line — cannot cut and still claim the MVP

- One merchant settlement preference and recipient address
- Fixed-amount, one-use link with server-enforced 24-hour expiry
- Public no-login checkout view
- Dynamic buyer signer/authentication at payment time
- At least one proven Aurora Intents cross-chain route into Monad
- Direct-to-merchant settlement
- Envio-backed recipient/token/amount/transaction verification
- Atomic paid transition and transaction replay protection
- Minimal pending/paid/expired merchant dashboard
- Copyable link and library-generated QR code
- Deployed end-to-end happy path plus mismatch/replay/expiry tests

### Drop in this order if schedule slips

1. Nansen reputation check.
2. Any SDK revival or secondary developer surface.
3. Broad source-chain/token coverage: keep one reliable cross-chain route plus only what has been tested.
4. Dashboard polish, analytics, and nonessential filtering; retain the status list.
5. Multiple settlement-stablecoin choices; retain one merchant preference backed by one proven asset.
6. Same-chain sponsored/gasless UX; retain honest normal-gas UX if safe and workable.

QR generation stays above the line because it is cheap and central to the target merchant behavior. Verification, replay protection, direct settlement, expiry, and the end-to-end route are never traded for polish. If a safe, viable Aurora route cannot be proven, the project requires a product-level rescope rather than a fake demo path.

## 7. Open questions and risks to surface

### Blocking before implementation or during week one

1. **Settlement asset:** Which stablecoin and exact Monad token contract is the initial merchant preference? Token authenticity, decimals, solver liquidity, and Envio decoding depend on this.
2. **Network:** Is judging expected on Monad mainnet, testnet, or both? Aurora route/liquidity and Dynamic behavior may differ materially.
3. **Merchant identity:** What authentication method should merchants use, and is a merchant recipient necessarily the Dynamic wallet or may they enter/connect an external Monad address? Address ownership verification is strongly recommended if arbitrary addresses are accepted.
4. **Amount denomination:** Does a link's fixed amount mean stablecoin units only, or may a merchant enter NGN/USD and lock a conversion quote? The proposed MVP treats it as stablecoin units to avoid an oracle/FX subsystem.
5. **Late settlement policy:** If authorization begins before expiry but final settlement lands after expiry, should it remain expired or be accepted within a documented grace window? Default recommendation: verify by finalized transfer timestamp with no hidden grace period, and disable new quotes shortly before expiry.
6. **Gas path:** Does Aurora's solver pay destination gas, and what happens for direct Monad payments? This remains a measured spike, not an assumption.
7. **Intent identity:** Is there a reliable, documented mapping from Aurora intent/quote to the final Monad transaction and transfer when solvers retry, batch, or split execution?

### Important implementation risks

- **Solver liquidity is dynamic.** UI must show only currently quoted routes and handle disappearing liquidity; marketing should describe tested coverage, not aggregate network totals.
- **Partial/split fills.** If Aurora can split settlement across transfers, exact single-transfer matching may reject legitimate payments. MVP recommendation: configure/accept only routes that produce one exact final transfer; aggregating partial fills adds substantial state complexity and needs approval.
- **Fees and exact receipt.** Establish whether quoted fees are taken from source input or destination output. The merchant must receive the exact link amount; otherwise the quote must gross up buyer input.
- **Memo/link correlation.** Standard transfers may not carry a link ID. Exact on-chain matching plus submitted transaction discovery can be ambiguous when one merchant has multiple identical open links. The verifier needs a robust transaction identifier and replay rule; unique per-link deposit addresses or contracts would change architecture and should not be assumed.
- **Indexer latency/outage.** Checkout must remain pending and reconcile later. A manual/automated backfill path is required before demo day.
- **Finality/reorg semantics.** Monad's fast finality does not guarantee identical Envio availability latency. Measure both and choose a conservative confirmation rule.
- **Public-link enumeration and privacy.** Use high-entropy IDs, return minimal merchant metadata, rate-limit reads, and decide what buyer address/transaction data is public versus dashboard-only.
- **Merchant compromise or address typo.** Preferences should require wallet ownership proof or very explicit confirmation. Link snapshots must not mutate when preferences change.
- **Relayer abuse.** If a custom sponsor becomes necessary, it creates budget-drain, authorization, replay, and denial-of-service risks. Time-box and cap it; do not casually promote it into a general relayer.
- **Vendor/API change risk.** Pin versions and capture verified vendor behavior in spike docs. Keep the authoritative payment rules inside Morva rather than coupling them to browser callbacks.
- **Hackathon dependency risk.** Maintain a prerecorded successful flow and transaction evidence, but demonstrate the live path whenever liquidity and networks cooperate.

## 8. Test and release strategy

### Required automated checks

- Domain tests for amount parsing, decimals, expiry boundaries, state transitions, and address/token normalization.
- Database tests proving unique payment/link and transaction constraints under concurrent verification.
- Verifier fixtures for exact ERC-20/native matches and every mismatch dimension.
- API authorization tests separating public link reads, buyer hints, and merchant-only writes/reads.
- Integration tests for duplicate Envio events, delayed indexing, stale quotes, solver failure, and reconciliation.
- End-to-end tests for create -> view -> pay -> verify -> dashboard, plus expired and replayed links.

### Release gates

- No client-controlled endpoint can directly set `paid`.
- No secrets, signing keys, or custodial fund path exist in the web bundle or metadata backend.
- One deployed route has repeatable transaction evidence and exact merchant receipt.
- Migration rollback/forward behavior, database backups, monitoring, and reconciliation are documented.
- The demo can explain the distinction between intent submission, on-chain settlement, Envio observation, and Morva's atomic state transition.

## 9. Decisions proposed for review

- Begin with one settlement stablecoin and one proven cross-chain route, then expand only from measured solver liquidity.
- Use no Morva smart contract unless the week-one spike proves a contract/account-abstraction component necessary.
- Treat link amounts as stablecoin-denominated integer base units; exclude fiat conversion from MVP.
- Persist only `pending`, `paid`, or `expired`; show submission/verification progress as transient UI, not a trusted payment state.
- Require exact receipt and reject split/partial fills for MVP.
- Prefer merchant address ownership proof and immutable per-link recipient snapshots.
- Keep Nansen and the old SDK below the cut line.

Approval of this plan authorizes scaffolding/tool setup and implementation beginning with Gate 1. Any change that introduces custody, a custom relayer/paymaster, a custom contract, partial payments, or broader v1 scope must be brought back for explicit approval.
