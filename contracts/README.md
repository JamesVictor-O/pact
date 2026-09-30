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
