# Pact pitch-deck handoff brief

## Purpose of this document

This is the source-of-truth handoff for the agent creating Pact's pitch deck. It explains the product, the user problem, the end-to-end flow, the role of each infrastructure partner, what is working today, what remains gated, and which claims must not be overstated.

The deck should tell a product story first and an infrastructure story second. Pact is not valuable because it uses blockchain. Pact uses blockchain because event finance needs shared, verifiable agreements and programmable movement of money without forcing normal users to understand wallets, bridges, gas, or smart contracts.

## The one-sentence definition

**Pact is the financial operating layer for events, connecting the money coming in, the agreements and payments going out, and the financial state in between.**

Alternative short line for a title slide:

**Know what is funded, what is due, and where every dollar is going.**

## The simplest explanation

Producing an event is not a single payment. Sponsors promise money before it arrives. Venues, production teams, contractors, speakers, caterers, security teams, and informal workers are owed money on different schedules. Organizers coordinate all of this through spreadsheets, invoices, chats, bank accounts, screenshots, and memory.

Pact turns that fragmented process into one financial system:

```text
Funding -> Agreements and expenses -> Allocation -> Payments or refunds
```

At any moment, Pact should let an organizer answer:

- How much funding has been promised?
- How much money has actually arrived?
- How much is still available?
- Which payments are fully funded?
- Which payments are due or overdue?
- Where is the cash gap?
- What can safely be paid right now?

## The core insight

The most important idea in Pact is:

**Committed is not received. Received is not available. Available is not allocated. Allocated is not paid.**

Example:

```text
Funding committed       $30,000
Funding received        $13,000
Due within 14 days      $16,500
Immediate cash gap       $3,500
```

The event appears fully funded on paper, but it cannot meet its next obligations. A bank balance or spreadsheet total does not explain that. Pact models each financial state separately.

## Who Pact serves

### Organizer

The organizer creates the event, records expected funding, sends sponsor funding requests, creates expenses and payment schedules, signs payment agreements, allocates received money, sees funding gaps, and authorizes payments.

### Sponsor or donor

The sponsor receives a funding request, chooses a supported source network and asset, and sends funds to a payment address. The sponsor should not need to create a Pact account, connect a wallet to Pact, bridge manually, or understand Monad.

### Payee

The payee may be a venue, freelancer, speaker, supplier, production company, agency, contractor, or informal worker. They sign in with the same verified email used in the agreement, review the terms and payment schedule, confirm the Pact-prepared invoice, secure their payout account with a passkey, accept the agreement, track expected and overdue payments, and view their payout destination.

Use **payee**, not **vendor**, as the general product term.

## The end-to-end product flow

### 1. Create the event

The organizer signs in and creates a Pact with the event name, date, working budget, and display currency.

Pact provisions one permanent, event-scoped USDC vault on Monad. This is the event's secure financial account and the canonical place where settled event funds live.

### 2. Request and receive funding

The organizer records a sponsor, grant, donation, partner commitment, organizer contribution, or another source. Pact creates a receivable funding request and a shareable link.

The sponsor chooses where they are paying from. Aurora provides a persistent deposit address for the selected source-chain family. The sponsor makes a normal transfer. Aurora detects the deposit, routes and swaps it, and delivers USDC to the event's vault on Monad.

Pact does not credit a funding request merely because Aurora reports success. Pact independently verifies the destination-chain USDC transfer, token contract, event-vault recipient, amount, transaction hash, and log index. Only then does received funding increase.

### 3. Create the obligation

The organizer adds an expense by answering normal questions:

- What is being paid for?
- Who is being paid?
- What is their verified email?
- What is the total amount?
- Is it one payment, a deposit and balance, or a custom schedule?

Creating the expense creates a payment agreement and a Pact-prepared payable invoice. Once the payee accepts the agreement, its material financial terms are locked for the MVP.

### 4. Sign and activate the agreement

The organizer signs the proposed terms with their Mera-backed Pact account. The payee signs in through Dynamic with the matching verified email, reviews the agreement, invoice, and payment schedule, and accepts with their own Mera-backed Pact account.

Pact's relayer submits both EIP-712 signatures to `PactAgreementRegistry` on Monad. The agreement becomes **Active** only after the registry transaction is confirmed. If submission fails, Pact preserves both signatures, displays **Finalizing agreement**, and retries safely. A browser signature alone is never presented as onchain finality.

### 5. Allocate real money

Received funds remain available until the organizer allocates them to a scheduled payment. Allocation reserves money inside the event vault; it does not pay the payee yet.

A payment can be:

```text
Unfunded -> Partially funded -> Funded -> Ready to pay -> Processing -> Paid
```

For the MVP, a payment is ready only when:

- the agreement is active on Monad;
- the invoice is confirmed;
- the payout profile is verified;
- the scheduled payment is fully funded;
- it is not cancelled; and
- it has not already been paid.

### 6. Release the payment

For a direct Monad payout, the organizer authorizes release with Mera. The relayer submits the signed instruction, and the event vault transfers allocated USDC to the payee's verified destination. Pact marks it paid only after the Monad transaction confirms.

For a cross-chain payout, Pact obtains an Aurora quote and the organizer signs the exact route, amount, and deposit address. The event vault sends the allocated Monad USDC into the route. The payment becomes **Routing**, not **Paid**. Pact marks it paid only after Aurora reports success with destination transaction evidence and Pact resolves the route onchain.

If a route is refunded, the returned USDC must be present in the event vault before the original allocation is restored.

## Why the blockchain is necessary

If blockchain were removed, Pact could still display a spreadsheet-like dashboard, but its strongest guarantees would disappear:

- accepted agreements would be database assertions instead of independently verifiable dual-signature records;
- event money would sit in an ordinary pooled account instead of a programmable event-scoped vault;
- allocation, release, routing, and refund states would depend entirely on one application's database;
- cross-chain funding and payout would require users or Pact operators to bridge manually;
- a relayer or server could be given more custody authority than necessary.

Pact uses blockchain for shared financial truth and constrained execution, not as decoration.

## Infrastructure map

```text
Dynamic                      Mera
Identity and access          Passkey-backed signing and Pact accounts
        |                    |
        +------ Pact application and PostgreSQL ------+
                              |
                        Monad contracts
          Agreement registry + event-scoped USDC vaults
                              |
                    Aurora Intents routing
          Cross-chain sponsor entry and payee settlement
```

Each layer has one clear responsibility. Do not merge their roles in the deck.

## How Pact uses Dynamic

Dynamic is Pact's authentication and verified identity layer.

It gives organizers and payees familiar Google or email login. Its most important product role is securely matching a payee to agreements created for their verified email. The server verifies the Dynamic session/token before returning agreements or financial records; it never trusts an email submitted by the browser.

Dynamic answers:

> Who is signed into Pact, and which records may they access?

Dynamic is not the Pact signing wallet and does not control event funds.

## How Pact uses Mera

Mera is Pact's passkey-backed account and authorization layer.

Pact uses Mera for:

- organizer agreement proposals;
- payee agreement acceptance;
- event-vault creation authorization;
- funding allocation authorization;
- direct payment release authorization;
- exact cross-chain route authorization; and
- the payee's default Pact payout account.

The user experiences this as **Secure your Pact account** or **Secure your payouts** using Face ID, Touch ID, or a device passkey. They do not manage a seed phrase or browser extension.

The Mera-derived private signing material is used only inside a short-lived signing session and is not directly persisted by Pact. The server relayer pays gas and submits signed instructions, but it cannot fabricate the organizer's or payee's signature.

Mera answers:

> Did the correct human authorize these exact terms or this exact movement of money?

The Mera signing identity and the payout destination are conceptually separate. A payee can use their Mera/Pact account as the default destination, while support for other verified destinations can remain optional.

## How Pact uses Monad

Monad is Pact's programmable agreement and settlement backbone.

### `PactAgreementRegistry`

This non-custodial EIP-712 registry verifies the organizer proposal and payee acceptance, then anchors the accepted agreement. It stores only the minimal financial and integrity state: agreement and event references, signer addresses, agreement/schedule/invoice hashes, currency reference, total amount, timestamp, and status.

Names, emails, invoice text, notes, and agreement prose remain private and offchain. Pact does not put PII or hashed emails onchain.

### `PactEventVaultFactory`

The factory creates one deterministic, permanent USDC vault per event after organizer authorization.

### `PactEventVault`

The vault is the event-level escrow and canonical financial account. It:

- receives direct USDC transfers;
- exposes the genuinely available balance;
- reserves funds for active agreements;
- releases allocated funds to verified payees;
- starts organizer-authorized Aurora payout routes;
- tracks routing separately from paid state;
- restores allocations after verified refunds; and
- returns eligible unallocated funding through organizer-authorized refunds.

Every allocation, release, route, and refund uses nonce-protected, expiring EIP-712 authorization. The relayer can submit valid signatures and pay gas, but it cannot redirect funds or invent instructions.

Monad answers:

> What agreement is active, how much event money is available or reserved, and what movement of funds was actually authorized and confirmed?

## How Pact uses Aurora Intents

Aurora is Pact's cross-chain routing layer.

### Inbound sponsor funding

Pact uses Aurora Persistent Addresses so sponsors can send a supported asset from a supported source network without connecting a wallet to Pact or manually bridging. Aurora routes the deposit into canonical USDC in the event's Monad vault.

The persistent address is an entry route, not the escrow. The Monad event vault is the escrow and final destination.

### Outbound payee settlement

Pact's outbound design lets a payee select a preferred destination chain, asset, and verified address. Pact routes event-vault USDC through Aurora and maintains separate `routing`, `delivered`, and `refunded` accounting states.

### Why the integration is more than an API call

Pact added its own safety and reconciliation layer:

- route configuration must match the deployed Monad chain and canonical USDC;
- destinations are loaded server-side, not trusted from the browser;
- Aurora observations are retained as audit evidence;
- the destination USDC transfer is verified independently;
- receipts are deduplicated by chain, transaction hash, and log index;
- real USDC atomic precision is retained, including sub-cent remainders;
- a successful route does not become paid without destination transaction evidence;
- a failed outbound route remains locked until a refund is verified; and
- reconciliation is idempotent so retries cannot double-credit or double-pay.

Aurora answers:

> How can a sponsor pay from where they already hold value, and how can a payee receive value where they prefer, without either person manually bridging?

## What is working today

The product has progressed beyond a static prototype. The repository currently contains:

- organizer and payee authentication;
- server-side Dynamic token verification and ownership checks;
- PostgreSQL persistence for events, funding, expenses, schedules, agreements, invoices, payout profiles, allocations, routes, and settlements;
- returning-user event navigation;
- event creation and event financial dashboards;
- sponsor funding requests and shareable funding links;
- expenses with one-time, deposit/balance, and custom payment schedules;
- organizer and payee agreement-signing flows;
- Pact-prepared invoices;
- Mera/passkey-backed Pact signing accounts;
- deployed Monad agreement registry and event-vault architecture;
- relayer-backed agreement finalization, allocation, and direct payment release;
- inbound Aurora routing on Monad mainnet;
- independent destination receipt verification and idempotent accounting;
- payee views for agreements, scheduled payments, funding state, and payout destination; and
- Solidity, application, and domain test coverage.

## Verified implementation evidence

Use these facts carefully; do not turn them into unsupported traction claims.

- Monad mainnet chain ID: `143`.
- `PactAgreementRegistry`: `0xc2B0D2A7e858F13B349843fF87dBF4EBF9227F49`.
- Current route-resolution `PactEventVaultFactory`: `0x0115CA8539906db2d9a4beE36C64eA94a0d7Fa31`.
- Pact route resolver: `0x2e5d8B56F9B4770a88794a47C32c177542d2f6ea`.
- Canonical Monad USDC: `0x754704Bc059F8C67012fEd69BC8A327a5aafb603`.
- A successful inbound mainnet canary routed Arbitrum ETH into `0.035305 USDC` in the correct Monad event vault.
- The canary exposed a sub-cent accounting bug. Pact corrected it by preserving all USDC atomic units, crediting only safe whole cents to display-currency accounting, and carrying the atomic remainder forward.
- A later Arbitrum-native-ETH route was also observed and delivered successfully.

Do not display contract addresses on a primary product slide unless the audience explicitly wants technical proof. They belong in an architecture appendix or technical-evidence slide.

## What remains gated or unproven

The deck must be honest about the boundary between implemented and production-proven behavior.

- Inbound Aurora routing is live, but support must be verified per source chain and asset. A Base USDC deposit reached the generated address but was not detected by Aurora, while Arbitrum native ETH routes succeeded. Pact should not claim that every supported EVM asset route has been proven.
- Outbound cross-chain payee settlement is implemented in contracts, persistence, and APIs but remains feature-gated until live delivery and refund canaries pass.
- Direct Monad USDC payout is the currently confirmed payment path.
- Background reconciliation, operational alerting, support tooling, and production monitoring still need hardening.
- Product usage, revenue, customer count, payment volume, market size, partnerships, and fundraising numbers are not established in this repository. Mark them `TBD`; never invent them.

## Important lessons from the build

These lessons make a strong technical-credibility slide or speaking-note section:

1. **One vault per event, not one escrow per request.** Multiple request-level escrows fragment liquidity and make allocation harder. Every event instead has one permanent vault, while requests retain separate attribution.
2. **A route provider's success is not financial finality.** Pact independently verifies the destination token transfer before crediting received funds.
3. **Signed is not active.** A payee signature moves an agreement to finalization; only confirmed Monad registration makes it active.
4. **Routing is not paid.** Cross-chain payout value remains in a routing state until destination delivery is evidenced and resolved.
5. **Real token precision differs from accounting precision.** Swap outputs can contain fractions smaller than one US cent. Pact stores exact atomic units and never rounds available money upward.
6. **Relayers should submit authority, not possess it.** Users sign exact typed instructions; relayers pay gas but cannot change recipients, amounts, agreements, or routes.
7. **Blockchain language belongs under the interface.** User testing exposed confusion when the sponsor page showed vault addresses, token contracts, and infrastructure warnings. The corrected interface presents one payment method and hides advanced chain details.

## Product language and design direction

The deck should reflect Pact's visual and verbal identity:

- serious modern financial operations;
- clean black-and-white foundation;
- restrained Pact blue for primary actions;
- generous whitespace;
- strong typography;
- real product screenshots rather than crypto illustrations;
- calm, precise, trustworthy language.

Preferred language:

```text
Create Pact
Add funding
Funding received
Available funds
Payment agreement
Secure your payouts
Allocate funds
Ready to pay
Payment processing
Paid
```

Avoid primary-facing language such as:

```text
Connect wallet
Bridge tokens
Switch chain
Execute smart contract
EIP-712
Relayer
Transaction hash
Gas
```

The desired reaction is:

> Wait, this is a Web3 product?

## Recommended deck narrative

Use a problem-first, product-led story. A suitable structure is:

### Slide 1 — Pact

**The financial operating layer for events.**

Supporting line: Know what is funded, what is due, and where every dollar is going.

### Slide 2 — The event may be funded on paper and still unable to pay

Use the `$30,000 committed / $13,000 received / $16,500 due / $3,500 gap` example. Make the mismatch visual.

### Slide 3 — The real problem is coordination, not transfer

Show funding promises, invoices, scheduled obligations, chats, spreadsheets, screenshots, and bank balances converging into confusion.

### Slide 4 — Pact creates one live financial graph

Show:

```text
Funding -> Agreements -> Allocation -> Payments / refunds
```

Emphasize the separated states: committed, received, available, allocated, and paid.

### Slide 5 — Three simple experiences

Organizer manages coverage. Sponsor funds through a link. Payee reviews agreements and tracks payment. Show product screens, not infrastructure logos.

### Slide 6 — End-to-end demo

Demonstrate:

```text
Create event
-> send sponsor request
-> fund from a source chain
-> receive USDC in the event vault
-> create and sign payment agreement
-> payee accepts
-> allocate received funds
-> authorize payout
-> confirm settlement
```

### Slide 7 — Invisible infrastructure, real guarantees

Use a four-column responsibility map:

- Dynamic: verified identity
- Mera: passkey authorization
- Monad: agreement and financial state
- Aurora: cross-chain entry and exit

Do not present this as four logos assembled together. Explain why each layer exists and where its trust boundary ends.

### Slide 8 — Built for correctness under failure

Show the truthful state transitions:

```text
Acceptance signed -> Finalizing -> Active
Allocated -> Routing -> Delivered or Refunded
```

Mention idempotent retries, independent transfer verification, atomic-unit accounting, and relayers without custody authority.

### Slide 9 — What works now

Use verified product and mainnet implementation evidence. Avoid invented users, revenue, or volume.

### Slide 10 — Vision

Every event becomes its own transparent financial system: money can enter from anywhere, be reserved against real agreements, and reach each worker where they prefer—without requiring them to understand blockchain.

### Slide 11 — Roadmap

Suggested honest sequence:

1. Complete outbound Aurora delivery and refund canaries.
2. Harden reconciliation, monitoring, and support operations.
3. Validate additional source-chain and asset routes.
4. Pilot with real organizers, sponsors, and payees.
5. Add controlled fiat entry/exit only after the crypto settlement loop is reliable.

### Slide 12 — Ask

This cannot be written truthfully from repository context. The deck agent must ask the founder for the exact audience and desired outcome: hackathon prize, grant, partnership, pilot organizers, or capital raise. If fundraising, specify amount, instrument, use of funds, timeline, and milestone.

## Demo guidance

The strongest demo is a single coherent story, not a tour of every page.

Suggested scenario:

1. An organizer creates a conference.
2. A sponsor commits funding and receives a link.
3. The sponsor pays from Arbitrum; Pact shows funding in progress and then received.
4. The organizer creates a production expense with deposit and balance payments.
5. The production company logs in with its verified email, reviews the Pact-prepared invoice, secures a passkey-backed account, and accepts.
6. The organizer sees the agreement move from finalizing to active.
7. Received funding is allocated to the deposit.
8. The payment becomes ready, is authorized, and settles to the payee.

For a recorded demo, use a route already verified in production. Do not use Base USDC until Aurora confirms why that deposit was not detected.

## Claims the deck must not make

- Do not call committed funding received money.
- Do not call allocated money paid.
- Do not call a browser-signed agreement active before Monad confirmation.
- Do not say Aurora supports every chain/asset combination end to end merely because an asset appears in a token list.
- Do not describe outbound cross-chain settlement as production-live while it is feature-gated.
- Do not claim Pact is non-custodial without explaining that event funds reside in an event-scoped smart-contract vault controlled by organizer-signed rules.
- Do not call the relayer a custodian or imply that it can move money freely.
- Do not claim traction, revenue, users, partnerships, or market size without separately verified evidence.
- Do not describe Pact as an event-planning, ticketing, RSVP, or vendor-discovery product.

## Questions the deck agent must ask the founder

Before finalizing slides, ask:

1. Who is the exact audience: judges, grant committee, infrastructure partners, pilot customers, or investors?
2. What specific outcome should the presentation produce?
3. What personal experience led to Pact, and which user conversation best validates the pain?
4. What current proof may be shared publicly: live demo, transaction evidence, test count, waitlist, pilot, or user feedback?
5. What is the business model hypothesis?
6. What market and competitor numbers can be verified from current sources?
7. Who is on the team, and why is this team suited to execute?
8. What is the exact ask and next milestone?

Unknown answers must remain `TBD` rather than being filled with plausible-sounding copy.

## Final positioning

Pact is building the connective tissue between money promised to an event and money safely paid out by it.

Dynamic makes entry familiar. Mera makes authorization secure without wallet friction. Monad turns agreements, allocation, and settlement into programmable financial state. Aurora lets value enter and eventually leave across chains without asking sponsors or payees to become bridge experts.

The infrastructure disappears into a simple product promise:

**An organizer should always know what money is real, what it is committed to, and what can safely happen next.**
