# Domain package

Shared, persistence-independent financial rules for Pact.

The first slice models amounts as integer base units and enforces the core funding and obligation invariants:

- commitments are distinct from received and available funds;
- allocations cannot exceed received funds or overfund an obligation;
- payments cannot exceed allocated funds;
- obligation coverage is derived as unfunded, partially funded, funded, or paid;
- aggregate event coverage exposes committed, received, available, allocated, paid, and uncovered totals.

Run `npm run test:domain` or `npm run typecheck` from the repository root.
