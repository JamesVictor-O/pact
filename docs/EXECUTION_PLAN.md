# Pact — MVP execution plan

## Product objective

Pact gives event organizers one financial system for funding commitments, received funds, vendor obligations, allocations, payouts, and eligible refunds. Sponsors can fund a specific event or obligation from a supported source chain, while vendors can see the funding and payment state of their schedules.

The interface uses ordinary financial language. Monad provides the programmable settlement layer, Aurora Intents provides supported cross-chain funding routes, and Envio supplies independently indexed onchain state.

## Core users

- **Organizer:** creates an event, records funding sources, creates vendor obligations, allocates received funds, releases payments, and identifies cash gaps.
- **Sponsor:** opens a funding link, reviews what the contribution funds, chooses a supported payment source, and receives a receipt.
- **Vendor:** reviews their payment schedule and sees whether each installment is unfunded, partially funded, funded, or paid.

## MVP flow

1. An organizer creates an event with its budget and date.
2. The organizer records sponsor, partner, ticket-revenue, or organizer-capital commitments.
3. The organizer adds vendors and installment-based obligations.
4. A sponsor opens a public funding link and funds through a verified Aurora Intents route.
5. Pact verifies USDC settlement on Monad before marking funds received and available.
6. The organizer allocates available funds to one or more obligations.
7. Pact calculates coverage and highlights upcoming cash gaps.
8. An authorized organizer releases a funded vendor payment.
9. Eligible unreleased funds can be refunded under the event's rules.

## State model

Funding sources track `committed -> received -> available`. Allocation reduces available funds but does not imply that a vendor has been paid.

Obligations track `unfunded -> partially_funded -> funded -> paid`. State changes must be derived from integer base-unit amounts, not floating-point display values.

Payout and refund records must be append-only, independently verifiable, and protected against replay. Reconciliation must be safe to retry after indexer or provider outages.

## Repository structure

```text
pact/
├── apps/
│   ├── web/          Organizer, sponsor, and vendor interfaces
│   ├── api/          Event-finance rules and verification coordination
│   └── indexer/      Monad funding, payout, and refund indexing
├── packages/
│   ├── domain/       Amounts, states, permissions, and invariants
│   ├── database/     Schemas, constraints, and persistence
│   └── config/       Shared workspace configuration
├── contracts/        Validated Monad settlement contracts
├── tests/e2e/        Complete event-finance flow tests
└── docs/             Architecture and execution notes
```

## Domain model

- `event`: organizer, name, date, budget, settlement configuration, lifecycle state.
- `participant`: organizer, sponsor, or vendor identity and event-scoped permissions.
- `funding_source`: source type, contributor, committed amount, received amount, and status.
- `funding_receipt`: verified source and destination transaction identity, asset, amount, and finality data.
- `vendor`: event-scoped vendor profile and payment destination.
- `obligation`: vendor, description, amount, due date, and coverage state.
- `allocation`: amount assigned from available event funds to an obligation.
- `payout`: authorized release from a funded obligation to a vendor.
- `refund`: authorized return of eligible, received, and unreleased funds.

Database constraints must prevent negative balances, over-allocation, duplicate transaction use, overpayment, and refunds of allocated or released funds. Financial mutations must be atomic and auditable.

## Delivery sequence

### Gate 1 — settlement feasibility

- Confirm the initial Monad network and USDC contract.
- Prove at least one repeatable Aurora Intents route into Pact's settlement design.
- Record fees, quote expiry, latency, gas responsibility, refund behavior, and final-chain identifiers.
- Decide the minimum contract surface required for allocation, release, and refund rules.

### Gate 2 — domain and authorization

- Define amount, event, commitment, obligation, allocation, payout, and refund invariants.
- Define organizer, sponsor, and vendor permissions.
- Threat-model custody, compromised organizers, duplicate receipts, replay, over-allocation, and unsafe refunds.

### Vertical slice

- Build event creation and the organizer coverage dashboard.
- Add funding commitments and vendor payment schedules.
- Build a public sponsor funding view and receipt.
- Verify a real test funding route through Envio.
- Allocate received funds and release one vendor payment.
- Show the resulting state in organizer, sponsor, and vendor views.

### Hardening

- Add idempotent reconciliation and provider-outage recovery.
- Test partial funding, concurrent allocation, duplicate transactions, failed releases, and refund eligibility.
- Complete mobile, accessibility, authorization, and slow-network passes.

## MVP scope

Included:

- Event creation
- Funding commitments and received-fund tracking
- Vendor installment schedules
- Coverage and cash-gap dashboard
- Cross-chain sponsor funding through proven Aurora Intents routes
- USDC settlement on Monad
- Allocation and vendor payment release
- Eligible unreleased-fund refunds
- Organizer, sponsor, and vendor views
- Envio-backed reconciliation and receipts

Excluded:

- Ticketing, RSVP, seating, event websites, schedules, and vendor discovery
- Lending against unreceived commitments
- Unverified chains or assets
- Arbitrary treasury automation outside event obligations

## Success criteria

- The system never presents a commitment as received cash.
- An organizer can see current availability, obligation coverage, and the next cash gap.
- A sponsor can fund without manually bridging to Monad.
- A vendor can understand what is due, funded, and paid without reading blockchain data.
- Allocation, payout, and refund rules cannot create or double-spend value.
- Every onchain state change has a human-readable receipt and independent indexed evidence.
