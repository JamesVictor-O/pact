# Payment feasibility spike

Status: in progress. Started September 15, 2026. Catalog discovery works; no funded settlement has been executed. Gate 1 is not complete.

## Run the read-only discovery

From the repository root:

```sh
npm run spike:payments
npm run test:spike
```

The discovery command reads the public NEAR Intents 1Click token catalog and lists Monad stablecoins plus Base USDC, Ethereum ETH, and Solana SOL candidates. It does not request an executable quote, generate a deposit address, sign, transfer funds, or write payment records. Catalog membership is not a liquidity check.

## Evidence and interpretation

The live catalog returned these Monad candidates during this session:

| Symbol | Decimals | Reported contract |
| --- | --- | --- |
| USDC | 6 | 0x754704bc059f8c67012fed69bc8a327a5aafb603 |
| USDT0 | 6 | 0xe7cd86e13ac4309349f30b3435a9d337750fc82d |

Source: [1Click token catalog](https://1click.chaindefuser.com/v0/tokens). Independently validate the chosen token against issuer documentation and the selected Monad network before putting it in the application registry. Neither asset is selected yet.

The [official 1Click quickstart](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/making-a-request) documents origin-chain funding into a quote-specific deposit address, followed by destination delivery. This supports a working hypothesis that a sponsor does not submit the final Monad transaction in that flow. It does not prove who pays destination gas on an actual Monad route. Origin-chain funding still requires a transaction; source gas must be accounted for.

The [swap-types specification](https://docs.near-intents.org/integration/distribution-channels/1click-api/swap-types) supports EXACT_OUTPUT, where the requested amount is the destination amount and slippage applies to input. This is the candidate mode for fixed sponsor commitments. Verify actual event receipt, fee treatment, and refund behavior using a real route before committing to it.

The [status schema](https://docs.near-intents.org/api-reference/oneclick/check-swap-execution-status) places final-chain transaction references in `swapDetails.destinationChainTxHashes[]`. Treat these as discovery hints for Envio, not proof of payment. An array also means a single-hash assumption needs testing.

[Aurora Intents](https://intents.aurora.dev/) describes its execution layer on top of NEAR Intents. The generic 1Click contract investigated here is not yet established as the correct Aurora integration endpoint. Do not silently substitute a generic NEAR integration for the requested Aurora integration.

[Dynamic custom EVM networks](https://docs.dynamic.xyz/chains/evmNetwork) documents network configuration. This is separate from native gas sponsorship. The original brief's unsupported-Monad sponsorship constraint remains unresolved; neither general EVM support nor ZeroDev documentation establishes native EIP-7702 sponsorship on Monad.

## Architecture issues to resolve before payment completion

- **Custody wording:** a bridge deposit is not a single sponsor-to-event transfer. Pact must describe intermediate execution, contract custody, and bridge trust assumptions accurately after tracing them.
- **Sponsor attribution:** the final transfer sender can be a solver or bridge. Do not store that address as an authenticated sponsor without separate source-payment evidence.
- **Link binding:** recipient/token/amount plus an unused hash is insufficient to prevent an unrelated old transfer from being claimed. Bind the provider quote/deposit identifier to an immutable link server-side before funding, then verify the destination transfer independently.
- **Expiry and indexing lag:** the plan currently makes expired terminal but also proposes checking the transfer timestamp. An on-time transfer indexed after expiry would be rejected under one rule and accepted under the other. Choose reconciliation semantics explicitly before implementing terminal transitions.
- **Protocol refunds:** a solver returning an unsuccessful deposit to the sponsor is transport failure handling, distinct from Pact's eligible unreleased-fund refunds.

## Next evidence required

1. Confirm initial stablecoin and mainnet/testnet choice.
2. Locate and verify the Aurora integration contract and its Monad support.
3. Obtain dry EXACT_OUTPUT quotes for the three source candidates. Record exact input/output, fees, validity and errors. Use no assumed exchange rates.
4. Confirm Dynamic signing and source-gas requirements, plus the separate same-chain Monad path.
5. With a specified Pact test address, funded sponsor wallet, and spending limit, execute a small route. Record the source transaction, provider identifier, final Monad hash, sender, recipient, token, amount, and gas payer.
6. Confirm that Envio indexes that actual transaction, including its canonical block/finality evidence. No Envio integration or finality behavior has been tested yet.
7. Only then lock the payment adapter and implement the authoritative verifier and durable database transitions.

No relayer, paymaster, contract, paid API subscription, or funded transaction has been added.
