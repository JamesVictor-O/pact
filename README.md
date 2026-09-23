# Morva

**Your customers are multichain. Your business doesn't have to be.**

Morva is a cross-chain payment acceptance layer that lets merchants accept payments from supported crypto assets and networks while settling in one preferred stablecoin on Monad.

A customer can pay with an asset they already hold — for example, USDC on Base, USDT on BNB Chain, or another supported route — without manually swapping, bridging, or asking the merchant which network to use.

The merchant receives stablecoin settlement on Monad.

**One checkout. Multiple payment sources. One settlement destination.**

---

## The Problem

Accepting crypto still creates unnecessary friction at checkout.

A merchant may want to receive USDC on Monad, while their customers hold funds across different networks:

- USDC on Base
- USDT on BNB Chain
- ETH on Ethereum
- USDC on Arbitrum
- other supported assets and networks

Today, someone has to absorb that complexity.

The merchant can require a specific token and network, forcing customers to swap or bridge before paying.

Or the merchant can accept multiple networks and end up managing fragmented balances, different gas tokens, multiple wallets, and more complicated reconciliation.

Neither is a good payment experience.

A merchant should be able to decide **what they want to receive**, without also dictating **what the customer must pay with**.

---

## The Solution

Morva separates **payment acceptance** from **merchant settlement**.

The merchant configures one settlement preference:

> **Receive USDC on Monad.**

Customers can then pay through any source asset and network Morva currently supports.

```text
CUSTOMER                         MERCHANT

USDC · Base ───────┐
USDT · BNB Chain ──┤
ETH · Ethereum ────┼──► MORVA ───► USDC · Monad
USDC · Arbitrum ───┤
Other supported ───┘
```

Morva handles the route between the customer's source funds and the merchant's settlement preference.

The customer does not manually bridge.

The merchant does not maintain balances across every network their customers use.

---

## How It Works

### 1. Merchant configures settlement

The merchant creates a Morva account and chooses:

- settlement token
- Monad settlement address
- payment amount where applicable

For the MVP, merchants can create payment requests that can be presented as a QR code or shared as a checkout link.

QR and payment links are **interfaces to the same underlying Morva payment request**, not separate payment systems.

### 2. Customer opens checkout

The customer scans the QR or opens the payment link.

Morva displays the purchase amount and available supported payment routes.

For example:

```text
FreshMart

Total
$42.50

Pay with

USDC · Base
USDT · BNB Chain
ETH  · Ethereum

[ Pay $42.50 ]
```

The customer chooses an asset they already hold.

### 3. Morva routes the payment

Morva uses Aurora Intents to execute the cross-chain payment from the customer's source network toward the merchant's required settlement on Monad.

The customer does not need to manually:

- bridge assets
- swap into the merchant's token
- switch to the merchant's network
- understand the merchant's treasury setup

### 4. Merchant receives settlement on Monad

The merchant receives the configured stablecoin on Monad regardless of the supported source route used by the customer.

Morva never takes custody of merchant funds.

### 5. Morva independently verifies payment

A successful wallet response or intent status is not considered proof of payment.

Envio indexes the final Monad settlement.

The Morva backend independently verifies:

- destination chain
- settlement token
- recipient
- amount
- transaction identity
- associated payment request

Only after the onchain settlement matches the expected payment does Morva mark the payment as complete.

Both the customer and merchant can then receive real-time confirmation.

---

## Why Morva?

### For customers

**Pay with what you already have.**

Customers should not need to understand bridges, destination networks, or merchant treasury preferences just to make a payment.

### For merchants

**Accept crypto without becoming multichain.**

Merchants configure one settlement destination instead of maintaining operational balances across every network their customers use.

### For checkout

**Crypto becomes a payment method, not a routing problem.**

The checkout experience hides the infrastructure required to move value between the customer's source asset and the merchant's settlement asset.

---

## Why Monad?

Monad is Morva's settlement layer.

Rather than leaving merchants with fragmented balances across multiple networks, Morva normalizes supported incoming payments into a consistent stablecoin settlement environment on Monad.

This gives the merchant one place for:

- settlement
- transaction history
- reconciliation
- future programmable payment logic

The long-term goal is for Monad to become more than Morva's destination chain. It becomes the programmable financial layer behind merchant payments.

Future settlement rules can support flows such as:

```text
Customer payment
       │
       ▼
     Monad
       │
       ├──► Merchant
       ├──► Supplier
       ├──► Operations
       └──► Reserve
```

A customer still makes one payment, while the merchant can define what happens to the money after settlement.

---

## Why Aurora Intents?

Aurora Intents provides the cross-chain execution layer behind Morva's checkout.

It answers a different question from Monad:

> **Aurora Intents: Where can the customer pay from?**

> **Monad: Where and how does the merchant settle?**

Morva combines these layers into one merchant payment experience.

Only source chains, assets, and routes verified through live testing will be exposed in the product.

---

## Payment Interfaces

Morva is not a QR payment product.

A **Morva payment request** is the underlying primitive.

For the hackathon MVP, that request can be accessed through:

### QR Checkout

Designed for physical merchant checkout.

A merchant can display a Morva QR that opens the payment experience for the customer.

### Payment Links

A merchant can share the same checkout through messaging apps, email, invoices, social platforms, or websites.

The same architecture can later support:

- POS integrations
- ecommerce checkout
- NFC
- merchant APIs
- embedded checkout
- invoices

without changing Morva's settlement model.

---

## Architecture

```text
                    MORVA

               Payment Request
                     │
          ┌──────────┴──────────┐
          │                     │
         QR                Payment Link
          │                     │
          └──────────┬──────────┘
                     │
                     ▼
              Morva Checkout
                     │
                     ▼
          Customer Source Asset
                     │
                     ▼
              Aurora Intents
                     │
             Cross-chain route
                     │
                     ▼
                   Monad
                     │
                     ▼
          Merchant Stablecoin
                     │
                     ▼
                  Envio
                     │
             Verify settlement
                     │
                     ▼
                Payment Paid
```

---

## Repository Structure

```text
morva/
├── apps/
│   ├── web/          Merchant dashboard and customer checkout
│   ├── api/          Payment requests, verification and state
│   └── indexer/      Envio settlement indexing
│
├── packages/
│   ├── domain/       Payment types, validation and state machines
│   ├── database/     Database schemas and persistence
│   └── config/       Shared workspace configuration
│
├── contracts/        Monad settlement contracts if required
├── tests/
│   └── e2e/          End-to-end payment tests
└── docs/             Architecture and execution documentation
```

### `apps/web`

Contains the merchant dashboard and public checkout.

The web application can initiate payment and verification requests but cannot independently mark a payment as successful.

### `apps/api`

Owns payment-request metadata, verification coordination, and payment state transitions.

The API does not custody funds or store payment private keys.

### `apps/indexer`

Contains the Envio configuration and handlers used to observe settlement activity on Monad.

### `packages/domain`

Contains shared payment types, amount handling, expiry rules, route information, and payment-state logic.

### `packages/database`

Contains schemas, migrations, uniqueness constraints, and persistence interfaces.

### `tests/e2e`

Tests complete flows including successful settlement, incorrect amounts, mismatched recipients, duplicate transactions, replay attempts, and expired payment requests.

---

## Technology

| Technology | Role |
|---|---|
| **Monad** | Merchant settlement layer |
| **Aurora Intents** | Cross-chain payment routing |
| **Envio** | Monad settlement indexing and verification |
| **Dynamic** | Authentication, wallet connectivity and signing |
| **Next.js** | Merchant dashboard and customer checkout |
| **TypeScript** | Application and backend development |
| **PostgreSQL** | Merchant, payment and settlement metadata |

---

## Security & Non-Custodial Design

Morva does not custody merchant funds.

Funds move from the customer's payment route to the merchant's configured Monad settlement destination.

Morva's backend does not:

- store customer private keys
- store merchant private keys
- sign payments on behalf of users
- treat frontend callbacks as settlement proof

### Payment verification

Morva does **not** consider any of the following sufficient proof of payment:

- browser success state
- wallet callback
- buyer-submitted transaction hash
- intent completion response alone

A payment becomes `paid` only after Morva independently observes and validates the expected Monad settlement through Envio.

Verification checks include:

```text
chain
recipient
token
amount
transaction identity
payment request
```

Database uniqueness constraints prevent the same settlement transaction from being used to satisfy multiple payment requests.

---

## Payment State

The initial payment lifecycle is intentionally small:

```text
PENDING
   │
   ├────────► EXPIRED
   │
   ▼
PROCESSING
   │
   ▼
PAID
```

`PAID` and `EXPIRED` are terminal states for the MVP.

Failed, delayed, or unverifiable settlement never results in Morva marking the payment as paid.

---

## Hackathon MVP

The Metropolis version of Morva focuses on proving one experience exceptionally well:

> **A merchant accepts a payment from a customer on another supported network and receives stablecoin settlement on Monad without either party manually bridging or swapping.**

The MVP includes:

- merchant onboarding
- Monad settlement preference
- fixed-amount payment requests
- QR checkout
- shareable payment links
- Dynamic authentication and wallet signing
- tested Aurora Intents source routes
- stablecoin settlement on Monad
- Envio-backed independent settlement verification
- merchant payment dashboard
- pending, processing, paid, and expired states
- transaction receipts
- end-to-end payment testing

Supported source chains and assets are intentionally limited to routes proven reliable through live Aurora Intents testing.

---

## Demo Flow

The hackathon demo follows one simple payment:

```text
1. Merchant creates a $25 payment request

                     ↓

2. Customer opens Morva checkout

                     ↓

3. Customer selects USDC on Base

                     ↓

4. Aurora Intents routes the payment

                     ↓

5. Merchant receives USDC on Monad

                     ↓

6. Envio independently observes settlement

                     ↓

7. Merchant checkout changes to:

                  ✓ PAID
```

The merchant never manages Base.

The customer never manually moves funds to Monad.

---

## Current Status

Morva currently has a responsive frontend and simulated checkout experience.

The next implementation milestones are:

1. Validate Aurora Intents → Monad routes, supported assets, fees, and settlement latency
2. Finalize the Monad settlement stablecoin and network environment
3. Implement merchant onboarding and settlement configuration
4. Implement real payment requests
5. Integrate Dynamic wallet authentication and signing
6. Execute the first real cross-chain payment
7. Implement Envio settlement indexing
8. Add backend verification and payment-state transitions
9. Build merchant payment history and receipts
10. Complete end-to-end tests using real transactions

The cross-chain feasibility spike comes first. Morva will not advertise a source asset or network until the complete route has been successfully tested.

---

## What's Next

The MVP proves cross-chain merchant acceptance.

The broader Morva vision is a **universal merchant acceptance layer** where businesses integrate once and customers pay from whichever supported financial rail they use.

Future interfaces can include:

- POS integrations
- ecommerce checkout
- NFC payments
- invoices
- merchant APIs
- embedded checkout

Monad can also enable programmable settlement rules such as:

- automatic revenue splits
- supplier payouts
- treasury allocation
- reserves
- recurring payments
- refunds
- conditional settlement

The interface can evolve.

The underlying principle remains the same:

> **Customers choose how they pay. Merchants choose how they receive. Morva handles everything between them.**

---

## Local Development

Install dependencies and start the web application:

```sh
npm ci
npm run dev
```

Open:

```text
http://localhost:3000
```

Run a production build:

```sh
npm run build
```

Run TypeScript validation:

```sh
npm run typecheck
```

Environment configuration will include:

- Monad RPC endpoint and chain ID
- Aurora Intents configuration
- Envio configuration
- Dynamic environment ID
- PostgreSQL connection string
- authentication configuration
- public web and API URLs

Never commit live credentials.

---

## License

A project license will be added before public distribution or external contributions.