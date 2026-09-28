# Web application

Next.js landing page for Pact with responsive event-finance sections and an interactive simulated sponsor-funding flow. The demo does not connect a wallet or move funds.

From the repository root, run `npm ci` and `npm run dev`, then open http://localhost:3000. Run `npm run build` for a production build and `npm run typecheck` for TypeScript validation. No environment variables are required for the landing page.

Dynamic, Aurora Intents, QR generation, and the public payment route remain unimplemented. The web application must never authoritatively mark a real payment paid.
