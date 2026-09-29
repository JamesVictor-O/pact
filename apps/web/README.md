# Web application

Next.js landing page for Pact with responsive event-finance sections and an interactive simulated sponsor-funding flow. The demo does not connect a wallet or move funds.

From the repository root, run `npm ci` and `npm run dev`, then open http://localhost:3000. Run `npm run build` for a production build and `npm run typecheck` for TypeScript validation.

To enable authentication, copy `apps/web/.env.example` to `apps/web/.env.local` and set `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID` to the Sandbox environment ID from Dynamic. In the Dynamic dashboard, enable Email and Google under Sign-in Methods and add `http://localhost:3000` under Security → Allowed Origins. Restart the development server after changing environment variables.

`NEXT_PUBLIC_ENABLE_AUTH_PREVIEW=true` enables the local, unverified preview adapter only when Dynamic is not configured. It should remain disabled in deployed environments.

Dynamic authentication is wired but requires project credentials. Aurora Intents, QR generation, and the public payment route remain unimplemented. The web application must never authoritatively mark a real payment paid.
