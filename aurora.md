# How Pact integrated Aurora Intents

This document records Pact's Aurora Intents integration from product idea to mainnet implementation. It explains our decisions, mistakes, corrections, security constraints, contract changes, user feedback, and remaining production tests.

> **Current status, October 2, 2026:** Aurora authenticated successfully, returned 202 supported assets, and identified canonical USDC on Monad. Inbound sponsor routing passes Pact's configuration checks. The upgraded route-resolution vault factory is deployed. Small-value mainnet ingress, delivery, and refund canaries remain outstanding.

## 1. What judges should understand

Pact uses Aurora to hide cross-chain payment mechanics from event sponsors and payees. Sponsors choose their source network and send a supported asset to one payment address. Pact receives USDC in the event vault on Monad. Payees will choose their preferred destination network and asset when outbound settlement passes its live canaries.

The integration changed in four important ways:

1. We replaced a wallet-first swap flow with persistent deposit addresses so sponsors do not need to connect a wallet to Pact
2. We separated Aurora's routing status from Pact's financial finality and verify the destination transfer ourselves
3. We upgraded the event vault after discovering that the first contract could start a route but could not finalize delivery or restore a refund
4. We removed blockchain infrastructure from the sponsor interface after user feedback exposed confusing addresses and Monad-specific language

## 2. Integration journey

This timeline shows what we built, what we learned, and what changed.

| Stage | Initial approach | What failed or caused concern | Correction |
| --- | --- | --- | --- |
| Product model | Treat each funding request as a separate escrow | Multiple escrows fragmented event liquidity and complicated allocation | Give each event one permanent vault and attribute deposits by funding request |
| Sponsor payment | Ask sponsors to connect a wallet and approve a transfer | Corporate sponsors may prefer an invoice and a payment address | Use Aurora persistent deposit addresses so a normal transfer can fund the event |
| Network target | Develop against Monad testnet | Aurora's documented persistent deposit API targets Monad mainnet and exposes no testnet selector | Gate routing by chain ID and deploy Pact contracts to Monad mainnet |
| API integration | Use an undocumented supported-token endpoint | The response shape did not match the current API | Use `GET /api/tokens/{apiKey}` and read its `tokens` array |
| Asset configuration | Configure `destinationAsset=USDC` | Aurora returned an exact Monad USDC asset identifier, so the generic symbol did not match our readiness audit | Configure `nep245:v2_1.omni.hot.tg:143_2dmLwYWkCQKyTjeUPAsGJuiVLbFx` |
| Secret handling | Put an API key in `.env.example` while testing | `.env.example` is designed for source control | Remove the key, verify it did not enter Git history, rotate it, and store the replacement only in `apps/web/.env.local` |
| Inbound finality | Trust Aurora's success response | A routing provider's status is not proof that the event vault received the expected token | Verify the Monad receipt, USDC contract, event-vault recipient, amount, transaction hash, and log index |
| Outbound accounting | Transfer allocated funds to Aurora and track `paymentRouting` | The first vault had no terminal transition for delivery or refunds | Add resolver-only `Delivered` and `Refunded` transitions and deploy a new factory |
| Failed route retry | Unlock a payment after an application error | The vault transfer may already have succeeded, creating duplicate-payment risk | Preserve the transaction and processing lock, then retry submission or reconciliation idempotently |
| Sponsor interface | Show the event vault, USDC token contract, Aurora warnings, and Monad fallback | Sponsors saw two addresses and blockchain terminology without knowing which address received payment | Show one payment address for the selected network and keep direct Monad details behind an advanced fallback |

## 3. Architecture goal

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

## 4. Why we chose persistent deposit addresses

Pact uses **Intents Deposits / Persistent Addresses**, not the wallet-oriented swap widget.

Reasons:

- A sponsor can make a normal transfer without connecting a wallet to Pact.
- Addresses are deterministic and reusable.
- `sender` can be the Pact funding-request ID, giving each invoice an attributable deposit route.
- `recipient` is the event vault, so custody remains event-scoped.
- `destinationAsset` fixes the output to USDC.

Official references:

- [Aurora Intents deposits](https://docs.intents.aurora.dev/intents-deposits/what-are-intents-deposits.md)
- [Persistent deposit addresses](https://docs.intents.aurora.dev/intents-deposits/persistent-addresses.md)
- [Persistent address API integration](https://docs.intents.aurora.dev/intents-deposits/quickstart/api-integration.md)
- [Create a persistent deposit address](https://docs.intents.aurora.dev/api-reference/persistent-addresses-api-reference/create-persistent-deposit-address.md)
- [Get persistent deposit status](https://docs.intents.aurora.dev/api-reference/persistent-addresses-api-reference/get-persistent-deposit-status.md)
- [Aurora API rate limits](https://docs.intents.aurora.dev/getting-started/integration-best-practices/rate-limits.md)

## 5. Why mainnet became necessary

Aurora's documented Persistent Deposit API accepts `destinationChain: "monad"`; it does not expose a Monad-testnet selector, EVM chain ID override, or documented sandbox. Pact's live contracts are now deployed on Monad mainnet, chain ID `143`.

Therefore:

- Aurora routing is feature-gated.
- The server must confirm that the configured Aurora destination chain ID equals the event vault chain ID before requesting an address.
- Direct USDC transfer remains an advanced fallback, not the primary sponsor experience
- Live Aurora routing remains feature-gated until the API key, asset identifier, and network match Pact's deployment

This guard prevents a sponsor from sending real funds to an Aurora address whose destination does not match the event vault deployment.

## 6. Persistent address API contract

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
  "destinationAsset": "nep245:v2_1.omni.hot.tg:143_2dmLwYWkCQKyTjeUPAsGJuiVLbFx",
  "confidential": false
}
```

`evm` produces one address usable across supported EVM source chains. Non-EVM source chains such as `btc`, `sol`, `tron`, `near`, and `stellar` require their own address. Stellar may also return a required memo.

Poll route status:

```http
GET https://intents-api.aurora.dev/api/persistent-deposit-status/{apiKey}?type=success&address={depositAddress}
```

Pact treats Aurora's status as routing evidence, not final financial truth. A route becomes received only after Pact verifies the destination USDC transfer into the exact event vault.

## 7. Security and finality rules

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

## 8. Current configuration

The web app uses:

```dotenv
AURORA_INTENTS_ENABLED=true
AURORA_INTENTS_API_KEY=your_aurora_api_key_here
AURORA_INTENTS_BASE_URL=https://intents-api.aurora.dev
AURORA_DESTINATION_CHAIN=monad
AURORA_DESTINATION_ASSET=nep245:v2_1.omni.hot.tg:143_2dmLwYWkCQKyTjeUPAsGJuiVLbFx
AURORA_DESTINATION_CHAIN_ID=143
AURORA_DESTINATION_RPC_URL=your_monad_rpc_url_here
AURORA_DESTINATION_TOKEN_ADDRESS=0x754704Bc059F8C67012fEd69BC8A327a5aafb603
AURORA_PAYOUT_ORIGIN_ASSET_ID=nep245:v2_1.omni.hot.tg:143_2dmLwYWkCQKyTjeUPAsGJuiVLbFx
AURORA_PAYOUTS_ENABLED=false
```

Keep the API key in `apps/web/.env.local`. Never add it to `.env.example`. Inbound routing is enabled. Outbound payouts remain disabled until the live delivery and refund canaries pass.

## 9. Implementation checklist

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
- [x] Deploy the registry and route-aware event-vault factory on Monad mainnet.
- [x] Submit the complete signed Aurora `quoteResponse` with outbound deposit transaction hashes.
- [x] Require destination transaction evidence before marking a routed payout delivered.
- [x] Keep routed payments locked after `FAILED` until Aurora reports and returns a refund
- [x] Configure an approved Aurora API key and exact Monad USDC asset identifier
- [x] Authenticate against `GET /api/tokens/{apiKey}` and confirm canonical Monad USDC
- [x] Add onchain route resolution for delivered and refunded outbound routes
- [x] Deploy the route-resolution factory to Monad mainnet
- [x] Replace infrastructure-first sponsor copy with a network-first payment experience
- [ ] Run a small-value mainnet ingress canary from one EVM and one non-EVM network
- [ ] Run outbound delivery and refund canaries from a vault created by the new factory
- [ ] Enable outbound payouts after both canaries pass

## 10. Implemented inbound flow

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

### Sponsor experience and advanced fallback

The primary interface asks sponsors to choose their source network. It does not mention Aurora, Monad, bridges, or token contracts. Pact then shows one payment address for that network. Direct Monad USDC remains under **Other payment method** for advanced users.

If Aurora fails its server-side safety gate, Pact does not expose infrastructure errors to the sponsor. The page says payment setup is still in progress and asks the sponsor to retry later.

## 11. Operational limits

- Persistent-address creation is limited to Aurora-approved organisations. An unapproved key receives HTTP 403.
- Aurora documents limits of 100 requests per 10 seconds and 2,000 requests per hour, per endpoint and API key.
- Rejected requests count toward the hourly limit.
- Webhooks are documented as coming soon, so Pact currently uses explicit status refresh and bounded server-side polling.
- API errors and Aurora correlation IDs must be stored without exposing the API key.

## 12. Mainnet deployments

Pact mainnet now has:

- Monad mainnet chain ID: `143`
- Agreement registry: `0xc2B0D2A7e858F13b349843fF87dBF4EBF9227F49`
- Route-resolution event-vault factory: `0x0115CA8539906db2d9a4beE36C64eA94a0d7Fa31`
- Route resolver: `0x2e5d8B56F9B4770a88794a47C32c177542d2f6ea`
- Previous route-only factory: `0xF7602C048F8C7Cc5E8c514522D633eb9A16a3a1B`
- Canonical USDC: `0x754704Bc059F8C67012fEd69BC8A327a5aafb603`

The registry address happens to match the previous testnet deployment because the deployer used the same nonce on both chains. Network identity must always include chain ID; the address alone is not sufficient.

## 13. Outbound payee settlement

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
5. `SUCCESS` with destination transaction evidence changes it to `delivered` and increments the scheduled payment's paid amount exactly once.
6. `FAILED` keeps the processing lock while Pact waits for Aurora's refund result
7. `REFUNDED` calls the vault's refund resolver, which restores the payment allocation only when the vault has sufficient returned USDC
8. Direct Monad USDC settlement remains a separate `direct` mode and may become `confirmed` as soon as the vault release confirms
9. Cross-chain payout execution is controlled by `AURORA_PAYOUTS_ENABLED`. Keep it disabled until delivery and refund canaries pass against a vault created by the route-resolution factory
10. `POST /api/deposit/submit/{apiKey}` receives `txHash`, `depositAddress`, and the complete original `quoteResponse`, as required by Aurora's current API
11. If quote submission fails after the Monad vault transfer confirms, Pact preserves the transaction and payment lock so retries resubmit the same transfer instead of authorizing another one

Outbound configuration:

```dotenv
AURORA_PAYOUTS_ENABLED=false
AURORA_PAYOUT_ORIGIN_ASSET_ID=nep245:v2_1.omni.hot.tg:143_2dmLwYWkCQKyTjeUPAsGJuiVLbFx
AURORA_PAYOUT_SLIPPAGE_BPS=100
```

`PactEventVault.routePayment` moves Aurora-bound value from allocated funds into `paymentRouting` and `agreementRouting`. It does not increment `paymentPaid` or `agreementPaid`. Direct Monad payouts continue to use `release`. Application reconciliation marks the database payment delivered only after Aurora reports destination success and destination transaction evidence.

The route-resolution revision is deployed. For routes created by the new factory, Pact now closes `paymentRouting` into `paymentPaid` after verified delivery, or restores `paymentAllocated` after Aurora reports a refund and the returned USDC is available in the vault. Resolution is idempotent and restricted to the configured resolver, which cannot change recipients, amounts, or initiate a route.

Existing vaults are immutable and remain attached to the previous factory revision. They do not gain route resolution automatically. Do not enable cross-chain payouts for an event unless its vault was created by `0x0115CA8539906db2d9a4beE36C64eA94a0d7Fa31`; recreate unfunded test events or explicitly migrate funded events before using outbound routing.

## 14. Mainnet readiness audit, October 2, 2026

The integration was checked against Aurora's current official Persistent Addresses and Swap API references.

### Corrected during this audit

- Supported payout assets now come from the documented `GET /api/tokens/{apiKey}` response and its `tokens` array.
- Outbound deposit submission now includes the complete saved quote response.
- An Aurora submission failure after a confirmed Monad transfer no longer unlocks the payment or creates double-spend risk.
- `SUCCESS` without a destination transaction hash stays unresolved instead of reporting payment.
- A delivered final scheduled payment now marks its payable invoice paid, matching direct settlement.
- Ingress and payout availability both require Aurora's network and settlement token to match Pact's Monad deployment.

### Current local readiness

The approved API key returned HTTP 200 from `GET /api/tokens/{apiKey}`. The response contained 202 assets and matched canonical Monad USDC by contract address. Pact now uses Aurora's exact asset identifier for both inbound destination configuration and outbound origin configuration.

The inbound readiness check now passes. `AURORA_PAYOUTS_ENABLED` remains false because contract tests do not replace live delivery and refund canaries.

### Activation order

1. [x] Add the approved API key to server-only configuration
2. [x] Query `GET /api/tokens/{apiKey}` and configure the exact Monad USDC asset identifier
3. [x] Confirm the returned token contract equals Pact's canonical Monad USDC address
4. [x] Enable `AURORA_INTENTS_ENABLED`
5. Run a small ingress canary from one EVM and one non-EVM network
6. Confirm destination transfer verification, receipt deduplication, funding totals, and receivable invoice state
7. [x] Deploy the route-resolution vault factory and test delivery and refund accounting
8. Run live delivery and refund canaries from a newly created event vault
9. Enable `AURORA_PAYOUTS_ENABLED` after the canaries pass for each supported destination family

## 15. What remains unproven

The following items require real value on mainnet. Passing unit tests, type checks, and API authentication does not prove them:

- A sponsor deposit from an EVM network settles into the exact Pact event vault
- A sponsor deposit from a non-EVM network settles with the expected amount and memo handling
- Destination receipt reconciliation credits the funding source exactly once
- An outbound route delivers the payee's selected asset and closes onchain routing accounting
- A refunded outbound route returns sufficient USDC and restores the original payment allocation
- Rate-limit handling remains usable during repeated status checks

We will record transaction hashes, observed timings, returned Aurora correlation IDs, and any corrections in this file after each canary.

## 16. Validation evidence

The implementation currently passes:

- 24 Solidity tests, including resolver authorization, terminal-state replay protection, and refund solvency
- 15 web tests, including Aurora retry and upstream error behavior
- TypeScript type checking
- Next.js production build
- Onchain verification of the new factory's registry, settlement token, and resolver

Deployment evidence:

- Route-resolution factory transaction: `0x8ebed039d8290308c4568b09f1dcfa0f3c215966c69e568b801106b73e9545be`
- Route-resolution factory: `0x0115CA8539906db2d9a4beE36C64eA94a0d7Fa31`
