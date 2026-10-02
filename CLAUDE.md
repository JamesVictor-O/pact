# CLAUDE.md — Pact Project Context

> Read this file before making product, UX, architecture, or implementation decisions in this repository.
> This is the current source of truth for what Pact is, what has already been built, what is intentionally not built yet, and what should happen next.

---

# 1. What Pact Is

**Pact is the financial operating layer for producing events.**

Pact is not an event-planning suite. It is not trying to replace Eventbrite, Luma, Cvent, ticketing, RSVPs, seating, speaker management, attendee CRM, or event websites.

Pact focuses on the money behind an event.

An event may receive money from:
- sponsors
- partners
- organizer capital
- grants
- ticket revenue
- community contributions
- other funding sources

At the same time, the event may owe money to:
- venues
- production teams
- contractors
- freelancers
- speakers
- suppliers
- agencies
- temporary workers
- informal workers
- security
- caterers
- media teams
- equipment providers

The core product problem is that these financial states are usually scattered across spreadsheets, invoices, email, WhatsApp, bank accounts, contracts, screenshots, and memory.

Pact gives the organizer one place to understand:
- what money has been promised
- what has actually arrived
- what the event has committed to pay
- what is due next
- what is funded
- what is still underfunded
- what money is genuinely available
- what can safely be paid

The simplest mental model is:

**Funding → Expenses/Agreements → Allocation → Payments**

---

# 2. Core Product Insight

The financial states must never be collapsed into one balance.

**Committed ≠ Received ≠ Available ≠ Allocated ≠ Paid**

Example:

An event may have:
- $30,000 committed
- $13,000 received
- $16,500 due in the next two weeks

The event looks fully funded on paper, but it has a $3,500 near-term cash gap.

This distinction is central to Pact.

Do not simplify the product into a wallet balance or generic bookkeeping dashboard.

---

# 3. Product North Star

The product should make users think:

> “Wait, this is a Web3 product?”

Normal users should not need to understand:
- Monad
- Aurora
- gas
- bridges
- wallet addresses
- smart contracts
- transaction hashes
- EIP-712
- relayers
- chain switching

The blockchain is infrastructure underneath the experience.

Use familiar language such as:
- Create Pact
- Add funding
- Add expense
- Who are you paying?
- Payment agreement
- Review agreement
- Accept agreement
- Invoice prepared
- Secure your payouts
- Ready to pay
- Paid

Avoid user-facing crypto language unless it is inside optional technical details.

---

# 4. Why Pact Exists

Pact did not start as “let’s build a Web3 event app.”

The original problem was that handling event money is not mainly about sending transfers.

The harder problem is financial coordination:
- sponsors can promise money before it arrives
- payment commitments happen before cash is available
- expenses are often paid in installments
- organizers need to know whether upcoming obligations are actually covered
- different people need a shared understanding of what was agreed, what is due, and what has been paid

Pact is being built to structure the financial life of an event from the moment money is promised until the final person is paid.

---

# 5. Core Terminology

## Funding Source

Where event money is expected to come from.

Examples:
- Sponsor
- Organizer funds
- Partner
- Ticket revenue
- Grant
- Other

A Funding Source has a commitment and may receive one or more actual receipts later.

## Payee

The neutral term for the person or organization the event has agreed to pay.

Do **not** use “Vendor” as the generic product term.

A payee may be a contractor, freelancer, speaker, supplier, venue, agency, production company, temporary worker, or informal worker.

In forms, prefer:

> **Who are you paying?**

On detail pages:

> **Payee**

## Expense

The organizer-side financial commitment.

Example:

Production — $4,000

An Expense is not necessarily one payment.

## Payment Schedule

The individual amounts and due dates inside an Expense.

Example:

Production — $4,000

- Deposit — $2,100 — Sep 30
- Final balance — $1,900 — Oct 10

Internally these may be called milestones, but the normal UI should use:
- Payment
- Payment schedule
- Deposit
- Final balance

Avoid “milestone” in normal UX.

## Payment Agreement

The agreement between organizer and payee covering:
- work/service description
- total amount
- payment schedule
- relevant terms
- invoice
- payee identity
- signatures

Creating an Expense now creates a Payment Agreement.

## Invoice

Invoices are first-class Pact objects.

Pact supports two directions conceptually:

### Receivable
Event/organizer → Sponsor

The event requests sponsorship/funding.

### Payable
Payee → Event/organizer

The payee requests payment under an accepted agreement.

For the MVP, informal payees should **not** need to know how to create invoices manually.

Pact prepares the invoice from the agreement automatically.

## Payout Profile

The payee’s verified payout destination.

Mera remains the Pact signing identity.

An external wallet, if supported later, is only an optional payout destination.

---

# 6. Current Product Flow

## Organizer

1. Authenticate
2. Create event
3. See Event Overview
4. Add Funding Sources
5. Add Expenses
6. Define payment schedules
7. Create Payment Agreement
8. Approve/sign organizer proposal using Mera
9. Agreement becomes `awaiting_acceptance`
10. Organizer waits for payee acceptance
11. After payee acceptance and onchain registration, agreement becomes active
12. Later: allocate funds
13. Later: authorize payment

## Payee

For MVP there is no email-delivery requirement.

The organizer enters the payee email when creating the agreement.

The payee later visits Pact and authenticates with that same verified email.

Pact discovers agreements associated with that normalized email.

Flow:
1. Login with matching verified email
2. Open `/agreements`
3. See pending agreement
4. Review agreement
5. Review payment schedule
6. Review Pact-prepared invoice
7. Confirm agreement and invoice
8. Set up Mera/passkey-backed Pact account if needed
9. Select payout destination
10. Sign acceptance
11. Pact finalizes the agreement on Monad through a relayer
12. Organizer sees the updated agreement/invoice/payout state

The payee experience should remain extremely lightweight.

Many payees may be informal workers.

Do not design this like enterprise procurement software.

---

# 7. Authentication and Account Architecture

## Dynamic

Dynamic is the **authentication / user identity layer**.

Use familiar login methods:
- Google
- email

Payee agreement discovery is based on a **verified authenticated email**.

Never trust an email supplied by the browser alone.

Server-side verification is required before production.

## Mera

Mera is the **Pact account and signing layer**.

Mera should be used for:
- organizer agreement approval/signing
- payee acceptance/signing
- Pact account identity
- default payout account
- future payment authorization

Do not use Dynamic embedded wallets as the Pact account layer.

Do not ask normal users to “create a wallet.”

Prefer language such as:

> Secure your Pact account

> Secure your payouts

> Use Face ID, Touch ID, or your device passkey

If external wallets are supported later, they are optional payout destinations only.

Mera remains the signing identity.

---

# 8. Monad’s Role

Monad must own meaningful programmable financial state.

It should not be used merely to store a transaction hash after all business logic already happened in a database.

Current Monad-related architecture:
- accepted-agreement anchoring
- future allocation state
- future payment release state
- future refund state
- future received/available/allocated/paid financial state

Current smart contract:

`PactAgreementRegistry.sol`

This is a **non-custodial EIP-712 registry**.

It does not hold funds.

Its purpose is to anchor accepted Pact agreements.

The current custody model uses `PactEventVaultFactory.sol` and
`PactEventVault.sol`. Every event gets one permanent USDC vault on Monad. The
organizer authorizes vault creation with Mera, while the relayer only submits
the signed transaction and has no withdrawal authority. Sponsors may transfer
USDC directly to the event address without connecting a wallet to Pact. Pact
attributes a direct transfer to a funding request only after verifying its
transaction hash and USDC `Transfer` log. Allocation, payout, and refunds remain
organizer-signed actions. `PactTreasury.sol` is retained only as the legacy
shared-treasury implementation.

---

# 9. Aurora’s Role

Aurora Intents is planned as the cross-chain funding-entry layer.

The sponsor or contributor should not need to:
- bridge manually
- switch networks
- understand destination-chain routing

The normal UX should be:

> Fund this event

Aurora handles routing from the source asset/chain into Pact’s settlement environment.

Aurora is not yet fully implemented.

Do not prematurely expose Aurora-specific UX.

---

# 10. Current UI / Product Sections

## Landing / Auth / Onboarding

Implemented.

The current onboarding creates the organizer’s first event and routes into the Event Overview.

## Event Overview

Implemented.

Purpose:

> Can we safely produce this event?

Current/final concepts include:
- Estimated budget
- Funding secured/committed
- Funding received
- Available
- Committed to payees
- Funding/cash gaps
- Upcoming payments

The Overview should eventually become the Funding Coverage dashboard.

## Funding

Implemented.

Purpose:

> Where is the money for this event coming from?

Funding page includes:
- Committed
- Received
- Still expected
- Available
- Funding Sources
- Source status
- Source detail

Funding types include:
- organizer
- sponsor
- partner
- ticket revenue
- grant
- other

Source detail includes:

> Where this funding goes

Allocation is not yet fully implemented.

## Expenses

Implemented.

Purpose:

> What does this event need to pay, who needs to be paid, and when?

Expense flow includes:
- title/service
- payee
- payee email
- category
- total amount
- payment schedule

Payment schedule supports:
- single payment
- deposit + balance
- custom schedule

The payment schedule total must equal the Expense total.

Expense detail includes:
- contract value
- funded
- paid
- outstanding
- payment schedule
- funding section
- payee/agreement information

## Agreements

Implemented with shared PostgreSQL persistence and authenticated APIs.

Routes:
- `/agreements`
- `/agreements/[agreementId]`

Pending agreements are discovered from the authenticated verified email.

Payee can:
- review agreement
- review schedule
- review invoice
- confirm
- set up Mera
- accept/sign

## Invoices

Foundation implemented.

Route:
- `/invoices/[invoiceId]`

Current payable invoice model is generated from the Payment Agreement.

For MVP, use **one master invoice per agreement** with the payment schedule included.

Do not require informal workers to create multiple installment invoices.

Sponsor receivable invoices are not yet implemented.

## Payments

Payment-readiness domain logic exists.

A payment detail route also exists:
- `/events/[eventId]/payments/[paymentId]`

Actual payment execution is **not implemented**.

Do not confuse a scheduled payment with a completed transfer.

Current `ExpensePayment` represents an obligation/scheduled payment, not necessarily an actual blockchain settlement.

A separate execution/settlement record may be introduced later when real payments are implemented.

---

# 11. Current Data / Domain Model

Implemented or introduced:
- Event
- FundingSource
- Expense
- ExpensePayment
- Payee
- PaymentAgreement
- immutable AgreementSnapshot
- Invoice
- PayoutProfile

A PostgreSQL-backed runtime now exists for the shared financial graph:

`packages/database/migrations/001_agreements_and_invoices.sql`

`packages/database/migrations/002_production_agreement_lifecycle.sql`

`packages/database/migrations/003_financial_graph_and_allocations.sql`

Events, funding sources, expenses, payment schedules, agreements, invoices, payout profiles, and allocations are persisted server-side. A one-time authenticated import preserves legacy browser records and their IDs.

---

# 12. Agreement Snapshot / Hashing Rules

Once the organizer finalizes an agreement, Pact creates an immutable canonical snapshot.

The snapshot includes the exact financial terms being offered.

Important rules:
- deterministic serialization
- integer minor units for cryptographic/onchain money representation
- no floating-point values in hashes/contracts
- material edits invalidate the old organizer signature
- the exact signed snapshot must not mutate after signing

Material changes include:
- payee
- amount
- currency
- payment schedule
- material agreement terms

If an awaiting agreement changes, create a new snapshot/hash and require a new organizer signature.

---

# 13. Current Agreement Lifecycle

Intended lifecycle:

`draft`
→ `awaiting_acceptance`
→ `acceptance_signed / registration_pending`
→ `active`
→ `completed`

Alternative terminal states:
- `declined`
- `cancelled`

Important:

**Active should only mean the accepted agreement has been successfully finalized/registered onchain.**

Do not treat “payee signed locally” as equivalent to onchain finality.

If payee acceptance exists but relayer/onchain registration fails:
- preserve acceptance
- show “Finalizing agreement”
- retry safely server-side
- do not ask the payee to sign again unless terms changed

---

# 14. Invoice Lifecycle

Current conceptual statuses:
- prepared
- issued
- confirmed
- paid
- voided

For payee agreements:

Pact prepares the payable invoice from the agreement.

The payee confirms the invoice as part of acceptance.

The invoice document, names, emails, notes, and human-readable contents stay offchain.

Only the document hash may be anchored.

---

# 15. Payment Readiness

Canonical payment readiness must be derived in one place.

For MVP a scheduled payment becomes **Ready to Pay** only if:

1. agreement is active
2. invoice is confirmed
3. payee payout profile is verified
4. funded amount >= payment amount
5. payment is not cancelled
6. payment is not already fully paid

Conceptually:

**Agreement accepted + Invoice confirmed + Payout ready + Fully funded = Ready to pay**

Do not duplicate readiness logic across components.

---

# 16. Smart Contract

File:

`contracts/src/PactAgreementRegistry.sol`

Purpose:
- verify organizer proposal signature
- verify payee acceptance signature
- anchor accepted agreement
- prevent replay
- support organizer cancellation
- allow permissionless relayer submission

The contract is non-custodial.

It does not control user funds.

Onchain data should contain only minimal financial/enforcement state.

Never put PII onchain.

Do not put:
- names
- emails
- invoice text
- agreement prose
- notes
- contact details

onchain.

Do not even put hashed emails onchain.

---

# 17. Onchain Agreement Data

Conceptually includes:
- agreement ID
- event reference/hash
- organizer Mera address
- payee Mera address
- agreement hash
- schedule hash
- invoice hash
- currency/reference
- total amount in integer minor units
- accepted timestamp
- status

The payout destination may differ from the payee Mera signing identity.

Do not conflate the two.

---

# 18. Current Smart Contract Status

Implemented locally.

Contract tests currently pass.

Latest reported verification:
- 20 application/domain tests
- 6 Solidity tests
- TypeScript checks
- production Next.js build
- all new routes compiled

The registry is deployed to the configured Monad environment and the application finalizes accepted agreements through the server relayer. Treat the configured deployment record and environment variables as authoritative; do not hardcode the address in product code.

---

# 19. Current Mera Status

Installed:
- `@category-labs/mera`
- Viem

Current local flow:
- passkeys create signing identity
- signing sessions end after use
- private material is not persisted directly

Production Mera relying-party/domain configuration is still required.

Do not invent Mera APIs.

Always inspect the installed SDK and current official documentation before changing integration behavior.

---

# 20. Current Known Missing Pieces

Still incomplete:
- sponsor receivable invoices
- Aurora funding execution
- actual payee payment execution
- refunds
- production transaction receipts

Implemented:
- PostgreSQL financial and agreement repositories
- server-side Dynamic verification and ownership checks
- server relayer and onchain registration reconciliation
- deployed PactAgreementRegistry integration
- Mera payout accounts and optional externally verified payout destinations
- server-backed allocations from received funding to scheduled payments

---

# 21. Completed Agreement Productionization Milestone

The agreement-productionization steps below are complete. Preserve their security and finality semantics.

The immediate next milestone is to productionize the Agreement lifecycle.

Order:

## 1. Server-side persistence

Move these from browser/localStorage to PostgreSQL-backed repositories/APIs:
- Payee
- PaymentAgreement
- AgreementSnapshot
- Invoice
- PayoutProfile
- related state

Preserve current domain logic.

## 2. Server-side authentication verification

Use Dynamic server verification.

The backend must derive the authenticated identity/email from verified credentials.

Never accept `email` from a browser request and use it as authorization.

Ensure organizer/payee ownership checks are server-side.

## 3. Deploy PactAgreementRegistry

Deploy to the Monad environment being used for the hackathon.

Record:
- network
- chain ID
- contract address
- deployment transaction
- deployment config

## 4. Implement the relayer

Flow:

Organizer signed proposal
+
Payee signed acceptance
↓
Server verifies state
↓
Relayer submits signed payload
↓
PactAgreementRegistry verifies signatures
↓
Monad confirms
↓
Agreement becomes Active

Relayer rules:
- may pay gas
- may submit signed data
- must not generate user signatures
- must not hold user funds
- must not control Mera keys
- must not have special contract authority

## 5. Add reconciliation / finality

Required states should distinguish:
- awaiting acceptance
- acceptance signed
- registration pending
- active
- registration failed/retrying

Do not display Active before successful onchain registration.

Retry idempotently.

## 6. Verify real cross-user behavior

Test with:

Organizer account A
+
Payee account B

Both should see the same shared server state.

No localStorage dependence should remain for production agreement flows.

---

# 22. Current Milestone After Agreement Productionization

Once the Agreement lifecycle is real, the next major product work is:

## Allocation

Connect Funding Sources to scheduled payee payments.

This is the central Pact graph.

Funding Source detail:

> Where this funding goes

Expense/Payment detail:

> Where this funding comes from

Example:

Aurora Labs funding
→ $3,000 Production deposit
→ $2,000 Venue

The first server-backed allocation vertical slice is implemented. Allocation drives:
- funded amount
- funding gap
- available balance
- readiness

## Payments

After Allocation is correct, build the final Payments operations layer.

Payments should answer:
- what is due?
- what is overdue?
- what is funded?
- what has a funding gap?
- which agreements are active?
- which invoices are confirmed?
- which payees are payout-ready?
- what is actually ready to pay?
- what has been paid?

Do not add a generic `+ Add payment` button.

Payments originate from Expense payment schedules.

## Actual Payment Execution

Later:

Organizer authorizes payment
→ Monad financial state verifies readiness
→ funds are released
→ payee receives funds
→ Pact records settlement/receipt

This should not be implemented as a fake “Mark as paid” toggle.

Paid should eventually come from actual settlement state.

## Aurora Funding Flow

Then connect sponsor/contributor funding.

Normal UX:

Sponsor invoice / funding request
→ contributor chooses how to pay
→ Aurora handles routing
→ funds settle into Pact/Monad
→ Funding Source state updates automatically

Do not make users manually bridge.

---

# 23. Design Rules

Pact design should feel like serious modern financial-operations software.

Preferences:
- minimal
- flat
- strong typography
- clear hierarchy
- restrained status badges
- borders
- whitespace
- clean tables
- good mobile fallback

Avoid:
- linear gradients
- shadows
- glassmorphism
- neon
- crypto clichés
- excessive cards
- oversized illustrations
- mascots
- unnecessary charts

The current Overview/Funding/Expenses visual language should be reused.

Do not redesign working sections casually.

---

# 24. UX Rules

Every screen should answer one primary question.

Examples:

Overview:
> Can we safely produce this event?

Funding:
> Where is the money coming from?

Expenses:
> What do we need to pay and when?

Agreement:
> What exactly did both sides agree to?

Payments:
> What needs action now?

Avoid mixing too many concepts on one page.

---

# 25. Product Rules That Must Not Be Broken

1. Committed funding is not received funding.
2. Received funding is not necessarily available funding.
3. An Expense is not necessarily one payment.
4. Outstanding is not the same as unfunded.
5. Funded is not the same as paid.
6. A scheduled payment is not an actual transfer.
7. Agreement acceptance is not final until the registry confirms.
8. Payee identity is not the same as payout destination.
9. Dynamic identity is not the Pact wallet/account layer.
10. Mera is the Pact signing identity.
11. Blockchain details should stay hidden from normal UX.
12. No PII onchain.
13. No fake “Mark as paid” state once real settlement is implemented.
14. Do not duplicate financial calculations across pages.
15. Use shared canonical helpers/selectors for totals and readiness.

---

# 26. Current Important Routes

Organizer:
- `/events/[eventId]`
- `/events/[eventId]/funding`
- `/events/[eventId]/funding/[fundingSourceId]`
- `/events/[eventId]/expenses`
- `/events/[eventId]/expenses/new`
- `/events/[eventId]/expenses/[expenseId]`
- `/events/[eventId]/payments/[paymentId]`

Payee/account-level:
- `/agreements`
- `/agreements/[agreementId]`
- `/invoices/[invoiceId]`

Inspect the actual repo before assuming additional routes.

---

# 27. Current Infrastructure Requirements

Production agreement flow still needs:
- PostgreSQL URL
- Dynamic server-verification credentials
- Monad RPC URL
- deployed PactAgreementRegistry address
- server-only relayer private key
- production Mera relying-party domain/configuration

Never expose server-only secrets to the browser.

---

# 28. Agent Working Rules

When another agent continues this project:

1. **Read this file first.**
2. Inspect the existing repository before proposing changes.
3. Do not re-ideate Pact from scratch.
4. Do not rename established product concepts casually.
5. Do not redesign already-approved screens without a concrete reason.
6. Preserve current financial semantics.
7. Prefer extending the existing architecture over creating parallel models.
8. Reuse current domain helpers and components.
9. Do not introduce duplicate sources of truth.
10. Before a large implementation, present a concise plan.
11. After implementation, report:
   - files changed
   - model changes
   - routes changed
   - tests run
   - infrastructure still missing
   - manual test sequence
12. If a required SDK/API behavior is uncertain, inspect the installed package and current official docs. Do not invent APIs.
13. Do not move to a later product phase before the current state model is trustworthy.
14. Keep user-facing language non-technical.
15. Keep the hackathon infrastructure story visible in the architecture:
   - Dynamic = identity/auth
   - Mera = account/signing
   - Monad = programmable agreement/financial state
   - Aurora = cross-chain funding entry

---

# 29. Hackathon Infrastructure Story

## Dynamic

Dynamic lets organizers and payees enter Pact through familiar authentication.

Its most important current role is verified identity/email matching.

## Mera

Mera lets Pact provide passkey-backed signing and account functionality without seed phrases or browser extensions.

Users should experience this as:

> secure your Pact account / payouts

not:

> create a crypto wallet

## Monad

Monad is the programmable financial backbone.

Current first concrete use:

`PactAgreementRegistry`

Current settlement contracts:
- `PactEventVaultFactory` — one organizer-authorized vault per event
- `PactEventVault` — direct USDC receipt, allocation, payment release, and refunds
- `PactTreasury` — legacy shared-treasury compatibility only

Monad should own meaningful state.

## Aurora

Aurora will make sponsor/contributor funding cross-chain without exposing bridging complexity.

The intended user experience remains:

> Pay / Fund

not:

> Bridge to Monad

---

# 30. Current Project Status Summary

Pact has progressed beyond concept/prototype UI.

Already working locally:
- organizer authentication/onboarding
- event creation
- Overview
- Funding
- Expenses
- payment schedules
- Payee model
- Payment Agreements
- invoice generation
- payee agreement discovery by verified email
- payee review/acceptance flow
- Mera/passkey signing foundation
- payout-profile foundation
- canonical agreement/invoice hashing
- PactAgreementRegistry contract
- Solidity security tests
- application/domain tests

Not production-ready yet:
- persistence
- server authorization
- cross-user synchronization
- contract deployment
- relayer
- onchain reconciliation
- actual allocation
- actual funding movement
- actual payee settlement

The next agent should continue from **productionizing the Agreement lifecycle**, not start over.

---

# 31. One-Sentence Product Definition

**Pact is the financial operating layer for events, connecting the money coming in, the agreements and payments going out, and the financial state in between.**

---

# 32. Core Product Question

At any moment, Pact should help an organizer answer:

> **What money do I actually have, what money have I already promised, and can I safely make the payments coming next?**
