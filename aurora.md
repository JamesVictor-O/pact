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

Aurora's documented Persistent Deposit API accepts `destinationChain: "monad"`; it does not expose a Monad-testnet selector, EVM chain ID override, or documented sandbox. Pact's live contracts are now deployed on Monad mainnet, chain ID `143`.

Therefore:

- Aurora routing is feature-gated.
- The server must confirm that the configured Aurora destination chain ID equals the event vault chain ID before requesting an address.
- The development fallback remains a direct USDC transfer to the event vault.
- Live Aurora routing remains feature-gated until the API key, origin asset identifier, refund reconciliation, and production route have passed an end-to-end mainnet test.

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

Keep `AURORA_INTENTS_ENABLED` and `AURORA_PAYOUTS_ENABLED` disabled until an Aurora API key and the production asset identifiers have been validated end to end against these mainnet contracts.

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

Pact mainnet now has:

- Monad mainnet chain ID: `143`
- Agreement registry: `0xc2B0D2A7e858F13b349843fF87dBF4EBF9227F49`
- Route-aware event-vault factory: `0xF7602C048F8C7Cc5E8c514522D633eb9A16a3a1B`
- Canonical USDC: `0x754704Bc059F8C67012fEd69BC8A327a5aafb603`

The registry address happens to match the previous testnet deployment because the deployer used the same nonce on both chains. Network identity must always include chain ID; the address alone is not sufficient.

## 11. Outbound payee settlement

Aurora is also Pact's cross-chain exit layer. The event vault remains the source of truth and always releases USDC on Monad; the payee chooses the destination chain, asset, and address during agreement acceptance.

```text
Payee confirms destination chain, asset, and address
        ↓
Organizer fully funds a scheduled payment
        ↓
Pact requests an exact-input Aurora quote
        ↓
Event vault sends USDC to the quote deposit address
        ↓
Aurora routes to the payee's chosen asset and chain
        ↓
Pact observes Aurora SUCCESS and destination transaction evidence
        ↓
Only then is the scheduled payment marked paid
```

Implementation rules:

1. `refundTo` is always the event vault. It is never supplied by the browser.
2. The quoted Aurora deposit address is the address in the organizer's typed payment authorization.
3. Quotes are stored in `payout_route_quotes`, including expected output, minimum output, deadline, raw response, and destination transaction evidence.
4. A successful Monad release changes the settlement to `routing`; it does not mark the obligation paid.
5. `SUCCESS` changes it to `delivered` and increments the scheduled payment's paid amount exactly once.
6. `REFUNDED` and `FAILED` clear the processing lock without crediting the payee.
7. Direct Monad USDC settlement remains a separate `direct` mode and may become `confirmed` as soon as the vault release confirms.
8. Cross-chain payout execution is controlled by `AURORA_PAYOUTS_ENABLED` and remains disabled on the current testnet deployment.

Outbound configuration:

```dotenv
AURORA_PAYOUTS_ENABLED=false
AURORA_PAYOUT_ORIGIN_ASSET_ID=
AURORA_PAYOUT_SLIPPAGE_BPS=100
```

`PactEventVault.routePayment` now moves Aurora-bound value from allocated funds into `paymentRouting` and `agreementRouting`. It does not increment `paymentPaid` or `agreementPaid`. Direct Monad payouts continue to use `release`. Application reconciliation marks the database payment delivered only after Aurora reports destination success.

Refund restoration still requires an explicit reconciliation design before live cross-chain payouts are enabled. Until that is implemented and tested, both Aurora feature flags remain off even though the mainnet registry and route-aware factory are deployed.
