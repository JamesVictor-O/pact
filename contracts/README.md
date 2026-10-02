# Contracts (architecture gate)

Pact may require narrowly scoped Monad contracts for event funding, allocations, vendor releases, and eligible refunds. Contract scope must follow the documented state model and be validated before implementation.

This directory is reserved for that validated settlement layer. Any custody, upgrade, or authorization design requires an explicit architecture decision because it changes audit and delivery risk.

## Agreement registry

Deploy the registry to the configured Monad environment:

```bash
PACT_DEPLOYER_PRIVATE_KEY=... forge script contracts/script/DeployPactAgreementRegistry.s.sol:DeployPactAgreementRegistry --rpc-url "$MONAD_RPC_URL" --broadcast
```

Copy the deployed address into `PACT_AGREEMENT_REGISTRY_ADDRESS` and
`NEXT_PUBLIC_PACT_AGREEMENT_REGISTRY_ADDRESS`. The relayer pays gas but cannot
fabricate either party's EIP-712 signature.

## Event vaults

New events use `PactEventVaultFactory` to create one deterministic, permanent
USDC vault per event. The organizer authorizes creation with Mera using EIP-712;
any relayer may submit that signature, but neither the factory nor the relayer
can move vault funds. Sponsors may make a plain USDC transfer to the event vault
without connecting a wallet to Pact. Allocation, payout, and refund actions
still require nonce-protected organizer signatures.

```bash
PACT_DEPLOYER_PRIVATE_KEY=... \
PACT_AGREEMENT_REGISTRY_ADDRESS=... \
PACT_SETTLEMENT_TOKEN_ADDRESS=... \
forge script contracts/script/DeployPactEventVaultFactory.s.sol:DeployPactEventVaultFactory \
  --rpc-url "$MONAD_RPC_URL" --broadcast
```

Store the deployment as `PACT_EVENT_VAULT_FACTORY_ADDRESS` and
`NEXT_PUBLIC_PACT_EVENT_VAULT_FACTORY_ADDRESS`.

## Legacy shared treasury

`PactTreasury` is retained for records created before event vaults. It keeps
available and allocated balances separated by event,
binds allocations to active registered agreements, and releases funds only from
organizer-signed, nonce-protected instructions. A relayer may submit those
instructions but has no privileged withdrawal authority.

Deploy only after verifying the settlement token address on the configured Monad
network:

```bash
PACT_DEPLOYER_PRIVATE_KEY=... \
PACT_AGREEMENT_REGISTRY_ADDRESS=... \
PACT_SETTLEMENT_TOKEN_ADDRESS=... \
forge script contracts/script/DeployPactTreasury.s.sol:DeployPactTreasury \
  --rpc-url "$MONAD_RPC_URL" --broadcast
```

Store the deployment as `PACT_TREASURY_ADDRESS` and
`NEXT_PUBLIC_PACT_TREASURY_ADDRESS`. Do not route sponsor funds to the treasury
address as a plain token transfer: payment entry must call `fund(eventId,
fundingRequestId, amount)` so the deposit can be attributed safely.
