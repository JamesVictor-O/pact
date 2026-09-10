# Morva

Cross-chain stablecoin checkout through shareable payment links, with settlement on Monad.

Morva lets merchants accept cryptocurrency payments without integrating a developer software development kit (SDK). A merchant creates a fixed-amount payment link and shares it directly or as a QR code. A buyer opens the link and pays with a supported asset they already hold through Aurora Intents. The merchant receives the selected stablecoin on Monad.

## How Morva processes a payment

Morva separates payment authorization from payment verification:

1. The merchant chooses a Monad settlement token and creates a payment link
2. The buyer opens `/pay/:id` and reviews the amount, token, recipient, and expiry
3. The buyer authenticates with Dynamic and selects an available Aurora Intents route
4. Aurora Intents executes the payment from the buyer's source chain to the merchant on Monad
5. Envio indexes the final Monad transfer
6. The Morva API matches the recipient, token, amount, chain, and transaction identifier against the stored link
7. The API records the transaction and marks the link paid in one database transaction

If verification fails or remains incomplete, the link stays unpaid.

## Repository architecture

The repository separates the public interface from the services that verify and record payments:

- [`apps/web`](apps/web): Merchant dashboard and public checkout. This application can request verification, but it cannot mark a link paid
- [`apps/api`](apps/api): Stores merchant and link metadata, coordinates verification, and owns payment state transitions. It never receives or signs for payment funds
- [`apps/indexer`](apps/indexer): Contains the Envio indexer configuration and handlers for Monad settlement transfers
- [`packages/domain`](packages/domain): Defines shared payment-link types, amount rules, expiry behavior, and the `pending -> paid | expired` state machine
- [`packages/database`](packages/database): Defines schemas, migrations, uniqueness constraints, and persistence interfaces
- [`packages/config`](packages/config): Contains shared TypeScript, linting, testing, and environment configuration
- [`contracts`](contracts): Reserved for an approved contract or account-abstraction requirement. The current design assumes no Morva contract
- [`tests/e2e`](tests/e2e): Covers link creation, checkout, verified settlement, mismatches, replay attempts, and expiry
- [`docs`](docs): Contains architecture and execution documents, including the [execution plan](docs/EXECUTION_PLAN.md)

## Technology choices

The payment and verification providers are confirmed. Application framework choices remain provisional until the initial feasibility work is complete:

- **Monad**: Settlement chain
- **Aurora Intents**: Cross-chain buyer funding through NEAR Intents and HOT Bridge routing
- **Envio**: Monad transfer indexing and the backend's on-chain verification source
- **Dynamic**: Buyer wallet creation, authentication, and transaction signing
- **Next.js**: Proposed web framework, not yet locked
- **TypeScript**: Proposed language for the web, API, shared packages, and indexer integration
- **PostgreSQL**: Proposed metadata and payment-record database, not yet locked

The initial Monad network, settlement stablecoin, API framework, package manager, and deployment platform remain open technical decisions. The Aurora Intents route and Monad gas behavior must also pass the feasibility spike before implementation depends on them.

## Security and non-custodial model

Morva never holds payment funds. Funds transfer on-chain from the buyer or intent execution path to the merchant's recorded Monad address. The metadata API does not store private keys or sign payment transactions.

A browser response, wallet callback, intent status, or buyer-submitted transaction hash does not prove payment. Morva marks a link paid only after the backend independently finds a finalized Monad transfer through Envio and matches its chain, recipient, token, amount, and transaction identity. Database uniqueness constraints prevent one transaction from settling multiple links.

Payment links store immutable settlement terms in integer token base units. Paid and expired states are terminal for the initial release, and failed or delayed verification leaves the link pending.

## Getting started locally

Local setup is not available yet. The repository currently contains the planning scaffold, but no application workspaces, package manifest, dependency lockfile, database schema, or runnable services.

Before publishing setup commands, complete these items:

1. Choose the package manager and initialize the TypeScript workspace
2. Lock the web, API, database, and test frameworks
3. Add `.env.example` files with documented variables and non-secret placeholders
4. Add database migration and seed commands
5. Add development commands for `apps/web`, `apps/api`, and `apps/indexer`
6. Add unit, integration, and end-to-end test commands

Expected environment configuration will cover these purposes, but the final variable names have not been defined:

- Monad remote procedure call (RPC) endpoint and chain identifier
- Aurora Intents API endpoint and credentials, if required
- Envio HyperSync or HyperRPC endpoint and credentials
- Dynamic environment identifier and public client configuration
- PostgreSQL connection string
- Merchant authentication secrets and callback URLs
- Public web and API base URLs

Use placeholders such as `your_env_id_here` and `postgresql://user:password@localhost:5432/morva` in example files. Never commit live credentials.

## Current implementation status and scope

Morva is in the planning and feasibility stage. The repository structure and [execution plan](docs/EXECUTION_PLAN.md) exist, but the web application, API, indexer, database schema, and payment flow are not yet implemented.

The planned initial scope contains:

- One-time payment links with fixed stablecoin amounts
- A hard 24-hour expiry for each link
- One merchant settlement-token preference
- A public checkout that does not require authentication to view
- Dynamic authentication and wallet signing when the buyer pays
- Aurora Intents funding from tested source chains and assets
- Envio-backed payment verification
- A merchant status list for pending, paid, and expired links
- Client-side QR code generation

The following features are not yet implemented and are outside the initial scope:

- Reusable links or buyer-entered amounts
- Email receipts
- Refunds
- Webhooks
- Custom merchant branding
- A developer SDK
- Buyer wallet reputation checks

The settlement token and Monad network environment remain open. Supported source chains and buyer assets will include only routes confirmed through live Aurora Intents testing.

## License

TODO: Select a license and add a `LICENSE` file before accepting external contributions or distributing a release.
