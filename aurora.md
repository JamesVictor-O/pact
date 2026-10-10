# How Pact integrated Aurora Intents

This document records Pact's Aurora Intents integration from product idea to mainnet implementation. It explains our decisions, mistakes, corrections, security constraints, contract changes, user feedback, and remaining production tests.

> **Current status, October 8, 2026:** Inbound Aurora routing is live on Monad mainnet. Pact has created and used a persistent Arbitrum/EVM deposit address, observed the source deposit, verified the destination USDC transfer into the correct event vault, and credited the funding request without double counting. The canary also exposed a sub-cent accounting bug, which is now fixed by retaining exact USDC atomic units while crediting only safe whole cents. Outbound cross-chain payouts are implemented but remain disabled until live delivery and refund canaries pass.

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
- [x] Run a small-value mainnet ingress canary from an EVM network
- [ ] Run a small-value mainnet ingress canary from a non-EVM network
- [ ] Run outbound delivery and refund canaries from a vault created by the new factory
- [ ] Enable outbound payouts after both canaries pass

## 10. Implemented inbound flow

This is the exact path currently implemented in Pact.

```text
Organizer creates an event
        ↓
Pact creates one deterministic PactEventVault for that event on Monad
        ↓
Organizer creates a funding source and funding request
        ↓
Pact creates a receivable invoice and unguessable sponsor link
        ↓
Sponsor chooses the network family they are paying from
        ↓
Pact requests an Aurora persistent deposit address
        ↓
Sponsor sends a supported asset to that address
        ↓
Aurora detects and routes the deposit into USDC on Monad
        ↓
USDC is transferred to the event's PactEventVault
        ↓
Pact independently verifies the Monad receipt and USDC Transfer log
        ↓
Pact stores an idempotent receipt and credits the funding source
        ↓
The funding request and receivable invoice advance only after verified value arrives
```

The persistent address is an entry route, not the escrow. The event vault is the event-level escrow and canonical destination. A funding request receives its own attributable Aurora route, while every successful request for the same event settles into the same vault.

### Event vault creation

1. Creating an event initiates vault setup through `PactEventVaultFactory`.
2. The organizer signs an EIP-712 `EventVaultAuthorization` containing the canonical event ID, organizer address, and deadline.
3. A relayer submits `createEventVault`; it cannot alter the signed fields or gain authority over the vault.
4. The factory uses `CREATE2` with the event ID as salt, producing one deterministic `PactEventVault` for that event.
5. The vault permanently stores the event ID, organizer, agreement registry, canonical USDC token, and route resolver.
6. The event record stores the vault address, factory address, transaction hash, and readiness state.

The vault accepts ordinary USDC transfers. No sponsor wallet connection to Pact is required, and the factory or relayer cannot withdraw event funds without an organizer-signed instruction.

### Route creation

1. The organizer creates a funding source, then creates a funding request for an amount under that source.
2. Pact stores the request, creates its receivable invoice, and generates an unguessable public slug.
3. The sponsor opens `/fund/{slug}`. This link grants access only to that funding request; it does not expose the organizer's authenticated workspace.
4. The browser loads `GET /api/fund/{slug}/routes` to obtain existing routes and server-computed availability. The Aurora API key is never returned.
5. The sponsor chooses a source-chain family: `evm`, `btc`, `sol`, `tron`, `near`, or `stellar`.
6. The browser calls `POST /api/fund/{slug}/routes` with only the chosen `depositChain`.
7. `createAuroraRoute` reloads the funding request and event from PostgreSQL. It does not trust a vault, recipient, destination chain, asset, or sender reference supplied by the browser.
8. Pact requires the event vault to be `ready`, the configured Aurora chain ID to equal the vault chain ID, and the configured destination token to equal Pact's settlement token.
9. The server calls `POST /api/persistent-deposit-address/{apiKey}` with:
   - `recipient = event.vaultAddress`
   - `sender = fundingRequest.id`
   - `depositChain = sponsor selection`
   - `destinationChain = monad`
   - `destinationAsset = canonical Monad USDC Aurora asset ID`
   - `confidential = false`
10. Pact writes the returned address, optional memo, Aurora correlation ID, destination, recipient, and sender reference to `aurora_deposit_routes` before showing the address.
11. The unique `(funding_request_id, deposit_chain)` constraint makes route creation idempotent. If two requests race, Pact returns the already-persisted route.

For `evm`, Aurora returns one address usable across its supported EVM source networks. Non-EVM families receive their own route, and Stellar may require the returned memo.

### Deposit synchronization

1. The sponsor selects **Check deposit**, which calls `POST /api/fund/{slug}/routes/{routeId}/sync`.
2. Pact verifies that the route belongs to the funding request identified by the public slug.
3. Pact applies a ten-second route cooldown so repeated browser actions cannot poll Aurora too aggressively.
4. The server requests Aurora observations separately for `received`, `success`, and `failed` states.
5. Every observation is retained in `aurora_route_deposits`, including source chain, destination chain, asset ID, atomic amount, addresses, timestamp, transaction hash, and raw Aurora payload. These records provide support and audit evidence but do not by themselves credit funds.
6. Pact reconciles each `success` observation against Monad through `AURORA_DESTINATION_RPC_URL`.
7. The verifier requires a valid destination transaction hash, a successful Monad receipt, the configured USDC contract, and an ERC-20 `Transfer` whose recipient is the exact event vault stored for the route.
8. Each matching transfer becomes a `funding_receipts` record containing its exact atomic amount, chain ID, transaction hash, log index, block number, contributor, settlement token, and confirmation time.
9. A unique `(chain_id, transaction_hash, log_index)` constraint makes receipt credit idempotent. Repeated synchronization can update route evidence but cannot credit the same transfer twice.
10. `recordConfirmedFundingReceipt` locks the funding request row before calculating credit. This serializes concurrent receipts and protects the carried sub-cent remainder.
11. Only a newly inserted confirmed receipt can increment `funding_sources.received_amount_minor`.
12. Pact sums confirmed receipt credit for that funding request. Once it reaches the requested amount, the request becomes `received` and its receivable invoice becomes `paid`; otherwise an observed in-flight deposit remains `routing`.

### Amount precision

The event vault and `funding_receipts.amount_atomic` preserve the complete six-decimal USDC value. Pact's current product ledger stores USD amounts in cents, so `funding_receipts.amount_minor` records only the newly creditable whole cents.

Pact calculates that credit cumulatively:

```text
all confirmed atomic units for the request
        ↓ convert only complete cents
safe cumulative cent total
        ↓ subtract cents credited by earlier receipts
new cent credit for this receipt
```

This means a receipt smaller than one cent is still recorded and is not lost. Its atomic units combine with later receipts for the same request until another complete cent can be credited. The ledger never rounds up and therefore never reports more spendable money than the vault received.

### Implemented state transitions

```text
Aurora route: ready → deposit_received → success
                                  ↘ failed

Funding request: sent → routing → received

Receipt: confirmed once Monad USDC delivery is independently verified
```

Aurora `success` is necessary evidence, but it is not sufficient financial finality. Pact credits money only after its own destination-chain verification succeeds.

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

### Exact outbound implementation status

The outbound path is implemented in the contracts, database, server repositories, and payment APIs, but it is deliberately feature-gated off in production configuration.

1. During agreement acceptance, the payee chooses and verifies a payout destination. Pact stores the destination chain, Aurora asset ID, symbol, decimals, and destination address in the payout profile.
2. When a scheduled payment is fully allocated, Pact fetches Aurora's supported assets from `GET /api/tokens/{apiKey}` and requests an exact-input quote from `POST /api/quote/{apiKey}`.
3. The quote fixes the origin asset as Monad USDC, the payee's verified destination, the event vault as `refundTo`, slippage, amount, deposit address, minimum output, and deadline.
4. Pact stores the full quote in `payout_route_quotes`. The organizer then signs an EIP-712 route authorization containing the agreement ID, payment ID, route ID, Aurora deposit address, exact amount, nonce, and deadline.
5. The relayer calls `PactEventVault.routePayment`. The vault verifies the active onchain agreement, allocation, organizer signature, nonce, and deadline before sending USDC to Aurora's quoted deposit address.
6. The vault moves the amount from `allocated` to `routing`; it does not call it paid.
7. After the Monad transaction confirms, Pact submits its hash, deposit address, and the unchanged complete quote response to `POST /api/deposit/submit/{apiKey}`.
8. Pact keeps the scheduled payment locked while routing. Submission or reconciliation errors do not authorize a second transfer.
9. Pact polls Aurora and requires destination transaction evidence before calling the resolver and marking the settlement `delivered`.
10. If Aurora reports a refund, Pact first requires the returned USDC to be available in the vault, then calls `resolveRouteRefunded` to restore the original allocation.

`AURORA_PAYOUTS_ENABLED=false` is intentional. The implementation must complete live delivery and refund canaries before organizers can use cross-chain payee settlement.

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
5. [x] Run a small ingress canary from an EVM network
6. [x] Confirm destination transfer verification, receipt deduplication, and funding totals for that EVM canary
7. Run a small ingress canary from a non-EVM network and confirm memo handling where applicable
8. [x] Deploy the route-resolution vault factory and test delivery and refund accounting
9. Run live delivery and refund canaries from a newly created event vault
10. Enable `AURORA_PAYOUTS_ENABLED` after the canaries pass for each supported destination family

## 15. What remains unproven

The following items require real value on mainnet. Passing unit tests, type checks, and API authentication does not prove them:

- A sponsor deposit from a non-EVM network settles with the expected amount and memo handling
- An outbound route delivers the payee's selected asset and closes onchain routing accounting
- A refunded outbound route returns sufficient USDC and restores the original payment allocation
- Rate-limit handling remains usable during repeated status checks

We will record transaction hashes, observed timings, returned Aurora correlation IDs, and any corrections in this file after each canary.

## 16. Validation evidence

The implementation currently passes:

- 24 Solidity tests, including resolver authorization, terminal-state replay protection, and refund solvency
- 19 web tests, including Aurora retry, upstream error behavior, and fractional settlement accounting
- TypeScript type checking
- Next.js production build
- Onchain verification of the new factory's registry, settlement token, and resolver

Deployment evidence:

- Route-resolution factory transaction: `0x8ebed039d8290308c4568b09f1dcfa0f3c215966c69e568b801106b73e9545be`
- Route-resolution factory: `0x0115CA8539906db2d9a4beE36C64eA94a0d7Fa31`

## 17. First successful inbound mainnet canary, October 7, 2026

The first EVM Persistent Address canary completed from Arbitrum ETH into Monad USDC.

- Persistent deposit address: `0x43e00c8E5604710390a7E8812b27835f745E1747`
- Source transaction: `0xf96ea9ddfe256bea5804558c13965f5b4ce040299e46fdc45beb0b6611f3489d`
- Source amount: `0.000014 ETH`
- Destination event vault: `0xa34C4648428Af097bdFA5d655f104b1742CA5e3A`
- Monad settlement transaction: `0xb61cf6b91c273113f2370ea418b07f3643ea96c2e2a294dfe011c89f8bd6c6aa`
- USDC delivered: `0.035305`
- Final Pact route state: `success`

### Accounting correction discovered by the canary

The original reconciliation code required every Aurora settlement to be exactly divisible into USD cents. Real swap output can contain valid sub-cent precision, so the successful `0.035305 USDC` transfer was initially rejected by Pact even though the funds were already present in the event vault.

Pact now keeps the complete token amount in atomic units, credits only whole cents so available funds are never overstated, and carries the atomic remainder across later receipts for the same funding request. In this canary, Pact records all `35,305` atomic units, credits `$0.03`, and retains the remaining `5,305` atomic units for future aggregation. Receipt recording remains idempotent by chain ID, transaction hash, and log index.

This distinction matters operationally: Aurora delivery finality and Pact's display-currency accounting are separate checks. A formatting limitation must never cause a valid onchain receipt to appear lost.

## 18. Stellar route isolation correction, October 9, 2026

The first Stellar test exposed an important difference between account-based EVM deposits and memo-based Stellar deposits. Aurora returned a shared Stellar collection address plus a required memo. Its address-status response also contained historical successful routes that used the same collection address for different recipients and destination chains.

Pact initially treated every success returned for that address as belonging to the new funding request. It attempted to verify an old Base settlement hash against the Monad RPC and produced a misleading `Transaction receipt ... could not be found` error.

The reconciliation path now filters every Aurora observation before storing or processing it. An observation must:

- be created after the Pact route;
- use the route's deposit address;
- identify the route's event-vault recipient;
- match the selected source family for a received deposit; and
- match the exact destination chain and asset for a success or failure.

A genuine Monad settlement reported before the configured RPC can return its receipt is now retained as `deposit_received` with a retryable confirmation message instead of failing the sync request.

For Stellar, the address and memo are one payment instruction. Pact displays both, and the sponsor must include the exact memo. At the time of this correction Aurora had not returned a current `received`, `success`, or `failed` observation for the test route, so Pact correctly remains ready and awaiting detection rather than reconciling unrelated address history.

## 19. Chain-neutral transaction reconciliation, October 9, 2026

The Stellar payment later appeared as successful in Aurora's dashboard and `0.212437 USDC` was visibly present in the Monad event vault, but the Persistent Address status endpoint still returned no current observation for the public Stellar address. The endpoint returned older activity attached to the shared collection address instead. This proved that filtering the address-status response was safe but insufficient: Pact could reject unrelated records, yet it still could not discover the valid settlement.

The final correction is deliberately not Stellar-specific. Pact now combines two Aurora data planes:

1. `GET /api/persistent-deposit-status/{apiKey}` remains a compatibility and in-progress signal.
2. `GET /api/transactions/{apiKey}` is the normalized cross-chain settlement record. It provides the origin asset, destination asset, recipient, lifecycle status, exact atomic output, and destination-chain transaction hashes across EVM, Stellar, Solana, Bitcoin, NEAR, Tron, and other supported source families.
3. `GET /api/tokens/{apiKey}` maps each origin asset ID to its blockchain. Pact normalizes those blockchains into source families instead of assuming every transaction hash is EVM-shaped.
4. Pact correlates a transaction using the route creation time, normalized source family, exact destination asset, and exact event-vault recipient. When Aurora exposes the public deposit address and memo, Pact requires those values to match as well.
5. If an internal Aurora deposit identifier replaces the public address in transaction history, Pact accepts the record only when exactly one unresolved route can own it. If multiple routes qualify, Pact records an attribution warning and credits nothing. It never guesses which sponsor supplied the money.
6. After correlation, Pact still fetches the destination transaction receipt from Monad and verifies the canonical USDC contract, event-vault recipient, atomic amount, transaction status, transaction hash, and log index. Aurora success alone is not financial finality.
7. Database uniqueness on `(chain_id, transaction_hash, log_index)` makes retries idempotent. Repeated reconciliation cannot credit the same transfer twice.

Memo-bearing route identities are now unique by source family, public deposit address, and memo. This permits shared collection addresses without collapsing separate sponsor routes.

### Successful non-EVM canary

- Source family: Stellar
- Source asset: XLM
- Public collection address: `GDJ4JZXZELZD737NVFORH4PSSQDWFDZTKW3AIDKHYQG23ZXBPDGGQBJK`
- Required memo: `195835458`
- Destination event vault: `0xa34C4648428Af097bdFA5d655f104b1742CA5e3A`
- Monad settlement transaction: `0x5dede1f53f3ad2ed6bf69a385102525149d5b12c37758b42871a421d5dc46712`
- Exact USDC delivered: `0.212437`
- Pact accounting credit: `$0.21`, with `2,437` atomic units retained as the sub-cent remainder
- Final funding-request state: `received`
- Final Aurora route state: `success`

The reconciler was executed twice against the same live transaction. The ledger remained at one receipt containing `212,437` atomic units and `21` credited cents, proving retry idempotency.

The web suite now contains 30 passing tests, including source-family normalization, non-EVM history correlation, memo validation, stale shared-address rejection, fractional settlement accounting, and retry-safe receipt insertion. TypeScript checking also passes.

## 20. Public event contributions

Requested sponsor funding and unsolicited community support are different financial states. A sponsor request starts with a known commitment and a receivable invoice. A public contribution has no prior commitment and must not increase funding until value actually arrives.

Pact now supports one reusable public contribution page per event:

```text
Organizer enables public contributions
        ↓
Pact creates one zero-commitment "Community contributions" ledger source
        ↓
Pact creates one permanent public funding request for routing identity
        ↓
Donors reuse one Aurora Persistent Address per source family
        ↓
Every source transfer remains an independent Aurora transaction
        ↓
Pact verifies each Monad USDC receipt and credits it exactly once
```

The public page uses a stable sender reference tied to the event's permanent public funding request. It does not generate a persistent address for each browser, donor, or donation. One hundred anonymous EVM contributors therefore reuse the event's EVM route; Solana contributors reuse its Solana route; Bitcoin contributors reuse its Bitcoin route; and so on. Stellar continues to display its required memo as part of the payment instruction.

The accounting rules are:

- committed amount remains zero because the contribution was never promised;
- received funding increases only after verified destination settlement;
- each transaction is stored as a separate receipt with atomic precision;
- contributors are anonymous unless they independently provide identity in a future named-contribution flow;
- pausing the public page prevents new route creation and synchronization through the public link without deleting prior receipts;
- request-specific sponsor and grant invoices remain a separate flow; and
- ambiguous cross-route attribution fails closed instead of assigning money to the wrong contributor.

The organizer can enable, pause, resume, and copy the public support link from the Funding page. The public URL is `/support/{slug}` and requires no Pact account.

## 21. Payee-selected outbound settlement

Inbound routing answers how money enters an event. Outbound routing answers where an individual payee wants to receive it. Pact now treats that choice as a verified payee preference rather than an organizer-entered wallet address.

The implemented flow is:

```text
Payee chooses direct Pact account or another supported USDC network
        ↓
Pact validates the destination against Aurora's current token catalog
        ↓
EVM destinations prove ownership with a wallet signature
Non-EVM destinations use chain-aware address validation and explicit confirmation
        ↓
Pact stores the verified preference and an immutable revision record
        ↓
Organizer fully funds the scheduled payment
        ↓
Pact requests an exact-input Aurora quote from Monad USDC
        ↓
Organizer signs the exact route ID, deposit address, and amount with Mera
        ↓
The event vault transfers only that allocated amount to Aurora's quote address
        ↓
Pact submits the deposit transaction and records the payment as routing
        ↓
Aurora delivers USDC to the payee's selected network
        ↓
Pact requires destination transaction evidence before resolving the vault route as delivered
```

The payout settings page now loads only unique USDC destinations advertised by Aurora and excludes the Monad USDC origin asset because that path is handled as a direct vault release. A payee can change the preference used by future payments. An existing quote or payment already in routing remains bound to its original recipient, destination asset, and quoted output.

Pact continues to separate identity, authorization, and delivery:

- Dynamic proves which payee is authenticated.
- Mera remains the payee's Pact signing identity and the organizer's payment-authorization mechanism.
- Aurora provides the cross-chain quote and delivery lifecycle.
- Monad keeps the allocation locked until the route is delivered or a refund is verified.

The relayer cannot choose the payee's destination or alter the route. The organizer signs the exact Aurora deposit address and amount through `EventPaymentRoute`. After the Monad transfer confirms, Pact submits the deposit transaction to Aurora and changes the settlement state to `routing`, never directly to `paid`.

Aurora `SUCCESS` must include a destination-chain transaction hash before Pact marks the scheduled payment paid. `REFUNDED` restores the allocation only after the route resolver confirms the refunded state. A failure without a verified refund leaves the money locked in routing rather than making it available for a second payment.

Migration `014_payout_profile_revisions.sql` adds an audit trail for preference changes. The local environment now enables outbound payouts, but production enablement still requires the same Aurora origin asset ID, Monad chain, settlement token, upgraded route-resolution vault, and a live delivery-and-refund canary. Contract/API implementation is complete; outbound production delivery must not be claimed until those canaries pass.
