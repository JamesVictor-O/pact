# Aurora Intents implementation

This document is the implementation record and operating guide for Pact's Aurora Intents integration. Update it whenever the integration, configuration, database model, or reconciliation flow changes.

## 1. Objective

Pact gives every event one permanent USDC vault. Aurora Intents is the cross-chain entry layer:

```text
Sponsor sends a supported asset on a supported source chain
        ↓
Aurora persistent deposit address
        ↓
NEAR Intents detects, routes, and swaps the deposit
        ↓
USDC arrives in the event's PactEventVault on Monad
        ↓
Pact verifies the destination-chain USDC transfer
        ↓
The funding request becomes received
```

Aurora does not replace the event vault. Each funding request may have one or more Aurora deposit addresses for attribution, but all successful routes for an event settle into that event's single vault.

## 2. Official API selection

Pact uses **Intents Deposits / Persistent Addresses**, not the wallet-oriented swap widget.

Reasons:

- A sponsor can make a normal transfer without connecting a wallet to Pact.
- Addresses are deterministic and reusable.
- `sender` can be the Pact funding-request ID, giving each invoice an attributable deposit route.
- `recipient` is the event vault, so custody remains event-scoped.
- `destinationAsset` fixes the output to USDC.

Official references:

- https://docs.intents.aurora.dev/intents-deposits/what-are-intents-deposits.md
- https://docs.intents.aurora.dev/intents-deposits/persistent-addresses.md
- https://docs.intents.aurora.dev/intents-deposits/quickstart/api-integration.md
- https://docs.intents.aurora.dev/api-reference/persistent-addresses-api-reference/create-persistent-deposit-address.md
- https://docs.intents.aurora.dev/api-reference/persistent-addresses-api-reference/get-persistent-deposit-status.md
- https://docs.intents.aurora.dev/getting-started/integration-best-practices/rate-limits.md

## 3. Network constraint

Aurora's documented Persistent Deposit API accepts `destinationChain: "monad"`; it does not expose a Monad-testnet selector, EVM chain ID override, or documented sandbox. Pact is currently deployed on Monad Testnet, chain ID `10143`.

Therefore:

- Aurora routing is feature-gated.
- The server must confirm that the configured Aurora destination chain ID equals the event vault chain ID before requesting an address.
- The current development fallback remains a direct USDC transfer to the Monad Testnet event vault.
- Live Aurora routing must not be enabled until the Pact registry, vault factory, vaults, and verified USDC token are deployed on the Monad environment Aurora calls `monad`.

This guard prevents a sponsor from sending real funds to an Aurora address whose destination does not match the event vault deployment.

## 4. Aurora API contract

Create a persistent address:

```http
POST https://intents-api.aurora.dev/api/persistent-deposit-address/{apiKey}
Content-Type: application/json
```

```json
{
  "recipient": "0xEventVault",
  "sender": "funding_request_<uuid>",
  "depositChain": "evm",
  "destinationChain": "monad",
  "destinationAsset": "USDC",
  "confidential": false
}
```

`evm` produces one address usable across supported EVM source chains. Non-EVM source chains such as `btc`, `sol`, `tron`, `near`, and `stellar` require their own address. Stellar may also return a required memo.

Poll route status:

```http
GET https://intents-api.aurora.dev/api/persistent-deposit-status/{apiKey}?type=success&address={depositAddress}
```

Pact treats Aurora's status as routing evidence, not final financial truth. A route becomes received only after Pact verifies the destination USDC transfer into the exact event vault.

## 5. Security rules

1. Never accept a destination address from the browser. Read the event vault from PostgreSQL.
2. Never create an Aurora route unless the vault status is `ready`.
3. Bind `sender` to the funding-request ID, not an email address or other PII.
4. Store the Aurora API key only in server configuration. Aurora documents the key as public-capable, but keeping calls server-side gives Pact rate limiting, auditability, and destination enforcement.
5. Persist returned addresses before showing them to a sponsor.
6. Treat `(funding_request_id, deposit_chain)` as idempotent.
7. Honour Aurora `Retry-After` on HTTP 429 and never poll faster than the documented 5–10 second interval.
8. Deduplicate destination receipts by chain ID, transaction hash, and log index.
9. Verify settlement token, event vault recipient, amount, and successful transaction receipt on the destination chain.
10. Do not mark funding received from a source-chain deposit alone.

## 6. Configuration

The web app uses:

```dotenv
AURORA_INTENTS_ENABLED=false
AURORA_INTENTS_API_KEY=
AURORA_INTENTS_BASE_URL=https://intents-api.aurora.dev
AURORA_DESTINATION_CHAIN=monad
AURORA_DESTINATION_ASSET=USDC
AURORA_DESTINATION_CHAIN_ID=
AURORA_DESTINATION_RPC_URL=
AURORA_DESTINATION_TOKEN_ADDRESS=
```

`AURORA_INTENTS_ENABLED` stays `false` for the current Monad Testnet deployment.

## 7. Implementation steps

- [x] Confirm Persistent Addresses are the correct product primitive.
- [x] Confirm address inputs and status-response shapes from official documentation.
- [x] Record the Monad-testnet incompatibility and define the chain-match safety gate.
- [x] Add database persistence for Aurora routes and observed deposits.
- [x] Add the server-only Aurora API client with timeout and 429 handling.
- [x] Add route creation and status-sync repositories.
- [x] Add public funding-route API endpoints.
- [x] Add sponsor UI for selecting a source chain, copying address/memo, and refreshing status.
- [x] Verify successful destination transfers before updating received funding.
- [x] Add HTTP-client tests for rate limits and upstream errors. Database idempotency is enforced with unique constraints and conflict-safe writes.
- [x] Run typecheck, application tests, contract tests, and production build.
- [ ] Enable only after mainnet-compatible Pact contracts and an approved Aurora API key are configured.

## 8. Implemented application flow

### Route creation

1. The sponsor opens the unguessable funding-request link.
2. The browser loads `GET /api/fund/{slug}/routes`.
3. Pact returns existing routes plus availability. The API key is never returned.
4. The sponsor chooses a source-chain family.
5. `POST /api/fund/{slug}/routes` validates the source chain, funding request, event vault, destination chain, and settlement token.
6. The server calls Aurora using `sender = fundingRequest.id` and `recipient = event.vaultAddress`.
7. Pact stores the address before returning it. A unique `(funding_request_id, deposit_chain)` constraint makes retries idempotent.

### Deposit synchronization

1. The sponsor selects **Check deposit**.
2. Pact applies a ten-second route cooldown.
3. The server fetches Aurora `received`, `success`, and `failed` observations.
4. Every observation is retained in `aurora_route_deposits` with its raw response for support and audit.
5. For each successful route, Pact reads the destination transaction from its configured RPC.
6. Pact requires a successful receipt and a transfer from the configured USDC contract to the exact event vault.
7. The verified log is inserted into `funding_receipts`; its chain/transaction/log uniqueness prevents double credit.
8. Only a newly inserted receipt increments `funding_sources.received_amount_minor`.
9. Pact updates the funding request and receivable invoice after confirmed totals reach the requested amount.

### Development fallback

When Aurora is unavailable or fails the safety gate, the sponsor page clearly explains why and leaves the direct Monad USDC instructions available. This is the only active path while Pact remains on Monad Testnet.

## 9. Operational notes

- Persistent-address creation is limited to Aurora-approved organisations. An unapproved key receives HTTP 403.
- Aurora documents limits of 100 requests per 10 seconds and 2,000 requests per hour, per endpoint and API key.
- Rejected requests count toward the hourly limit.
- Webhooks are documented as coming soon, so Pact currently uses explicit status refresh and bounded server-side polling.
- API errors and Aurora correlation IDs must be stored without exposing the API key.

## 10. Current deployment status

Pact currently has:

- Monad Testnet agreement registry: `0xc2B0D2A7e858F13b349843fF87dBF4EBF9227F49`
- Monad Testnet event-vault factory: `0x0115CA8539906db2d9a4beE36C64eA94a0d7Fa31`
- Monad Testnet USDC: `0x534b2f3A21130d7a60830c2Df862319e593943A3`

These testnet addresses must not be supplied to Aurora's production `monad` destination until Aurora explicitly confirms that destination maps to Monad Testnet. Current official documentation does not make that claim.
