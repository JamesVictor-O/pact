# Build context

```yaml
stack:
  workspace: TypeScript monorepo (provisional; versions deferred until plan approval)
  web: React/Next.js (provisional)
  api: TypeScript service (framework deferred)
  indexer: Envio on Monad
  database: PostgreSQL (provisional)
  wallet: Dynamic embedded wallets
  routing: Aurora Intents / NEAR Intents via HOT Bridge
  installed_skills: []
  configured_mcps: []
architecture:
  pattern: non-custodial payment-link monorepo with independent indexed verification
  decisions:
    - sponsor funding into an event's programmable settlement layer
    - no custom contract by default
    - backend is authoritative for payment state
    - implementation gated on gas/route feasibility spike
build_status:
  mvp_complete: false
  tests_passing: false
  devnet_deployed: false
planning_status: awaiting_user_review
```

The source scaffold intentionally contains no feature code, installed dependencies, cloned starter repository, or MCP configuration. The project is Monad/EVM rather than Solana, and the user explicitly requires plan review before implementation/tool setup.
