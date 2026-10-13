# Pact demo video — production handoff for Claude

## Your assignment

You are the producer, story editor, and assembly guide for Pact's hackathon demo video.

Use this document as the product and recording source of truth. Your job is to:

1. turn the implemented Pact journey into a concise narrative;
2. tell the founder exactly which screens and interactions to record;
3. provide a file-naming and asset checklist;
4. review the submitted recordings for missing states or unusable footage;
5. write the final voiceover and on-screen captions around the footage that actually exists; and
6. assemble a polished demo without overstating unverified behavior.

Do not begin by writing a generic script. First ask for the hackathon's maximum video length, required aspect ratio, submission criteria, and whether the founder will narrate. If those details are unavailable, use the recommended 3-minute, 16:9 version in this document.

## What Pact is

Pact is the financial operating layer for events.

Events receive money from sponsors, grants, partners, organizers, and contributors. At the same time, they owe venues, production teams, speakers, contractors, caterers, media teams, and other payees on different schedules.

The problem is not simply sending money. The problem is knowing:

- what has been promised;
- what has actually arrived;
- what remains available;
- what has been reserved for each obligation; and
- what can safely be paid now.

Pact keeps these states separate:

```text
Committed != Received != Available != Allocated != Paid
```

The product flow is:

```text
Funding -> Agreements -> Allocation -> Payment
```

The desired audience reaction is:

> This feels like a normal financial product, even though blockchain infrastructure is securing the workflow underneath.

## The story the video must tell

Tell one continuous event story involving three people:

- **Organizer** — creates an event, requests funding, creates a payment agreement, allocates real funds, and authorizes payment.
- **Sponsor** — opens a link and funds the event from a network where they already hold value.
- **Payee** — signs in with the email named in the agreement, accepts the terms, selects where to receive payment, and tracks settlement.

Do not structure the video as four disconnected sponsor integrations. Dynamic, Mera, Monad, and Aurora must appear as parts of the same transaction.

## How the infrastructure connects

### Dynamic — identity and access

Dynamic gives organizers and payees familiar Google or email login. Pact verifies the authenticated identity server-side and uses the verified email to return the correct events, agreements, invoices, and payments.

Dynamic answers:

> Who is using Pact, and which records may they access?

### Mera — account and authorization

Mera gives each user a passkey-secured Pact account. Face ID, Touch ID, or a device passkey authorizes exact agreement terms, allocations, and payment instructions without requiring seed phrases, wallet extensions, gas management, or manual chain switching.

Mera answers:

> Did the correct person authorize this exact action?

The relayer pays gas and submits the signed instruction, but it cannot change the recipient, amount, agreement, route, nonce, or deadline.

### Monad — verifiable financial state

Monad is where Pact anchors accepted agreement hashes and holds event funds in one event-scoped USDC vault. The vault separates available money from allocated money and releases funds only after organizer authorization.

Monad answers:

> Which agreement is active, what money is available or reserved, and which movement of value was actually authorized?

### Aurora Intents — cross-chain entry and exit

Aurora allows sponsors to fund from a supported source network and asset. Aurora converts and delivers canonical USDC into the event vault on Monad. Pact independently verifies the destination-chain USDC transfer before crediting received funding.

For outbound settlement, Pact has implemented payee-selected destination networks and Aurora payout routing. Do not call outbound cross-chain delivery production-proven until a live delivery and refund canary have passed. A direct Monad USDC payout is the safe end-to-end payment path for the current demo.

Aurora answers:

> How can value enter—or eventually leave—the event's financial system without making users operate a bridge?

## Recommended demo format

- **Primary cut:** 3 minutes, 16:9, 1920x1080, 30 fps.
- **Optional social cut:** 60–75 seconds, 9:16, made only after the main demo is complete.
- **Tone:** calm, precise, credible, product-led.
- **Visual direction:** stark editorial fintech; white and warm-gray product surfaces, black typography, restrained Pact blue, subtle green only for confirmed states.
- **Motion:** crisp and minimal. Use smooth cursor movement, short focus zooms, and direct cuts. Avoid crypto-style neon effects, spinning tokens, excessive gradients, and cinematic transitions.
- **Music:** optional, quiet, and instrumental. Voiceover and interface sounds take priority.

## Recommended three-minute narrative

### Scene 1 — The problem, 0:00–0:15

**Narrative purpose:** establish that an event can look funded on paper and still be unable to pay.

**On-screen text:**

```text
$30,000 committed
$13,000 received
$16,500 due
```

Then reveal:

```text
$3,500 cash gap
```

**Voiceover direction:**

> Event money is rarely one balance. Sponsors promise funds before they arrive, while payees are owed deposits and installments on different dates. Pact shows what is real, what is reserved, and what can safely happen next.

**Assets:** create this as a designed data frame. Do not screen-record a spreadsheet.

### Scene 2 — Familiar entry, 0:15–0:30

**Record:** landing page, authentication, and returning-user routing.

**Product actions:**

1. Open `/` and show the Pact product statement.
2. Choose the organizer entry action.
3. Show Dynamic's Google or email login briefly.
4. Land on `/dashboard` for a returning organizer, or `/events/new` for a fresh demo account.

**Voiceover direction:**

> Organizers enter Pact with the identity they already use. Dynamic handles familiar authentication, while Pact securely maps that identity to the correct financial workspace.

**Do not show:** Dynamic dashboard configuration, JWTs, environment variables, or wallet connection language.

### Scene 3 — Create the event and financial account, 0:30–0:48

**Record:** `/events/new`, followed by the event overview or funding page.

**Enter realistic demo data:**

```text
Event: Build Forward Conference
Date: a future date
Budget: $25,000
Currency: USD
```

**Show:** the event appearing in the organizer workspace and the secure event account reaching its ready state.

**Voiceover direction:**

> Creating an event also provisions one permanent USDC account for that event on Monad. Every confirmed sponsor route settles into the same event-level vault, keeping liquidity together while Pact preserves who each receipt came from.

**Editing note:** if vault provisioning takes too long, record the click and the ready state separately, then use a clean time-compression cut. Do not imply instant confirmation.

### Scene 4 — Create and share a funding request, 0:48–1:05

**Record:** event funding page, create-funding flow, and the completed request row.

**Demo data:**

```text
Source: Northstar Labs
Type: Sponsor
Committed amount: $25.00
Funding request: $5.00
```

**Show:** the distinction between committed, received, and available. Copy or open the sponsor link.

**Voiceover direction:**

> A sponsor commitment is not counted as cash. Pact creates a receivable request and shareable payment link, but received funding increases only after value actually reaches the event account.

### Scene 5 — Sponsor funds from another network, 1:05–1:32

**Record in a private browser window:** `/fund/{slug}`.

**Product actions:**

1. Show the event and requested amount.
2. Choose a source network already verified in production—prefer Arbitrum for the main recording.
3. Generate or reveal the Aurora payment address.
4. Copy the address.
5. Insert verified transaction evidence or send a controlled canary amount.
6. Select **Check payment**.
7. Show the request changing from awaiting payment/routing to received.
8. Return to the organizer funding page and show received and available balances updated.

**Voiceover direction:**

> The sponsor chooses where they are paying from and makes a normal transfer. Aurora handles conversion and delivery into USDC on Monad. Pact then verifies the actual USDC transfer into the correct event vault before the money becomes received and available.

**Strong proof insert:** use the verified Arbitrum ETH to Monad USDC route or the Stellar XLM to Monad USDC route. A short Aurora transaction-history capture can appear as technical evidence after the product state changes, not as the main interface.

**Do not:** use a Base USDC deposit below Aurora's route minimum; show an API key; claim that every listed source asset has been live-tested; or call Aurora status alone financial finality.

### Scene 6 — Create the obligation, 1:32–1:52

**Record:** event expense creation.

**Demo data:**

```text
Expense: Event photography
Payee: Maya Okafor
Payee email: a dedicated demo email
Total: $5.00
Schedule: one payment, $5.00
```

Alternatively, for a richer schedule:

```text
Production — $20.00
Deposit — $10.00
Final balance — $10.00
```

**Show:** organizer proposal authorization using the Mera-backed Pact account and the resulting **Awaiting acceptance** state.

**Voiceover direction:**

> The organizer creates the obligation in normal financial language: who is being paid, how much, and when. Pact prepares the invoice and payment agreement, while Mera lets the organizer authorize the exact terms with a passkey.

**Passkey recording note:** operating-system biometric prompts may be hidden or black in screen recordings. Capture the button press and confirmed result. If necessary, add a brief label—`Authorized with device passkey`—instead of fabricating the system prompt.

### Scene 7 — Payee reviews and accepts, 1:52–2:15

**Record in a separate browser profile:** payee sign-in and `/agreements/{agreementId}`.

**Product actions:**

1. Sign in using the exact email named in the agreement.
2. Show that Pact returns only that payee's agreement.
3. Review the event, amount, schedule, and Pact-prepared invoice.
4. Show the saved payout preference if the payee already has one. Do not reconnect the same wallet unnecessarily.
5. If this is the first agreement, choose the Pact account on Monad for the fully proven payout path.
6. Accept using the Mera/passkey flow.
7. Show **Finalizing agreement**, then **Agreement active** after Monad confirmation.

**Voiceover direction:**

> The payee signs in with the same verified email. They review the agreement and invoice, then accept with a passkey-secured Pact account. The signature is not presented as final immediately—Pact waits for Monad to confirm the agreement registration.

**Optional insert:** show the payout settings page with `USDC on Base` as a verified preference to demonstrate the destination-selection experience. Clearly describe this as the selected destination for future routed payouts unless an outbound canary has been completed.

### Scene 8 — Allocate real funds, 2:15–2:32

**Record as organizer:** the specific payment detail page.

**Product actions:**

1. Show that money in the event account is available but not yet assigned.
2. Select **Allocate $5.00**.
3. Authorize with Mera.
4. Show the payment become fully funded and ready to pay.

**Voiceover direction:**

> Received money is still not automatically spendable against every obligation. The organizer allocates real event funds to this payment. That reservation is authorized and enforced by the event vault.

### Scene 9 — Pay the payee, 2:32–2:48

**Record:** the payment's ready state, organizer authorization, processing, and confirmed payment.

**Product actions:**

1. Show agreement active, invoice confirmed, payout verified, and payment fully funded.
2. Select **Pay $5.00**.
3. Authorize the exact release with Mera.
4. Show processing and then paid.
5. Switch to the payee payment view and show the received/paid state.

**Voiceover direction for the proven direct path:**

> Once the agreement is active, the invoice is confirmed, the destination is verified, and the payment is fully funded, the organizer authorizes release. The relayer pays gas, but the vault can transfer only according to the organizer's signed instruction.

**If demonstrating Aurora outbound after a successful canary:** change the narration to explain `Routing` separately from `Paid`, and show destination transaction evidence before presenting the payment as delivered.

### Scene 10 — Close, 2:48–3:00

**Visual:** return to the organizer overview showing funding received, obligations, allocations, and paid value. End on a clean Pact logo card.

**On-screen statement:**

```text
Know what is funded,
what is due,
and what can safely be paid.
```

**Voiceover direction:**

> Pact connects money coming into an event with the agreements and payments going out—while keeping blockchain complexity beneath a familiar financial workflow.

## Exact recording checklist

Ask the founder to deliver these clips as separate files. Do not ask for one continuous recording.

| File | Role | Route or surface | Required state |
|---|---|---|---|
| `01-landing-auth.mov` | Organizer | `/`, `/auth` | Landing CTA and Dynamic sign-in |
| `02-create-event.mov` | Organizer | `/events/new` | Form entry, submission, resulting event |
| `03-event-account.mov` | Organizer | event funding page | Event account ready; redact full address if needed |
| `04-create-funding.mov` | Organizer | funding creation | Commitment/request created; copy link |
| `05-sponsor-route.mov` | Sponsor | `/fund/{slug}` | Source network selection and Aurora address |
| `06-route-proof.mov` | Technical evidence | Aurora dashboard/explorer | Successful source-to-Monad route, no secrets |
| `07-funding-received.mov` | Organizer | funding/overview | Received and available amounts updated |
| `08-create-expense.mov` | Organizer | expense creation | Payee, schedule, invoice/agreement created |
| `09-organizer-sign.mov` | Organizer | agreement proposal | Mera/passkey authorization and awaiting acceptance |
| `10-payee-login.mov` | Payee | `/auth`, `/agreements` | Dynamic login and correct agreement list |
| `11-payee-accept.mov` | Payee | agreement review | Invoice review, payout destination, acceptance |
| `12-agreement-active.mov` | Payee or organizer | agreement detail | Finalizing to active |
| `13-allocate.mov` | Organizer | payment detail | Available funds allocated to the payment |
| `14-release.mov` | Organizer | payment detail | Ready, authorization, processing, paid |
| `15-payee-paid.mov` | Payee | `/agreements/payments` | Paid amount and destination |
| `16-overview-final.mov` | Organizer | event overview | Final financial state |

Also request:

- Pact SVG or transparent PNG logo;
- two or three high-resolution product screenshots for cutaways;
- verified transaction URLs that may be shown publicly;
- hackathon and sponsor logo-use rules;
- exact project URL or CTA for the end card; and
- the founder's preferred name and pronunciation for narration credits.

## Recording instructions for the founder

1. Record at 2560x1440 or 1920x1080, 30 fps, with browser zoom at 100%.
2. Use separate browser profiles for organizer and payee. Use a private window for the sponsor link.
3. Hide the bookmarks bar, extensions, desktop notifications, password manager popups, and unrelated tabs.
4. Use dedicated demo emails and wallets. Never expose a private key, API key, RPC credential, personal inbox, or seed phrase.
5. Use realistic amounts large enough to display clearly and above Aurora route minimums.
6. Pause for one second before and after every click so the editor has clean cut points.
7. Move the cursor slowly and intentionally. Do not circle elements while speaking.
8. Record loading, processing, success, and error-recovery states separately when possible.
9. If a blockchain confirmation takes time, capture the pre-action and confirmed states as separate clips. Preserve truthful status labels.
10. Record without narration. Capture voiceover separately in a quiet environment.
11. Export clips without aggressive compression. Prefer MOV or high-bitrate MP4.
12. Keep full wallet addresses and emails out of the final cut unless they are dedicated public demo identities.

## How to frame the product footage

Use a minimal browser frame rather than raw floating screenshots. Product footage should occupy 65–75% of a 16:9 frame. Keep one short label beside it, such as:

- `Commitment is not cash`
- `Pay from your network`
- `Agreement secured by passkey`
- `Real funds, deliberately allocated`
- `Authorized, then confirmed`

Use no more than eight words in a single on-screen text block. Hold product screens for at least three seconds when the viewer must read them.

Use only two recurring visual effects:

1. subtle depth shift when a product frame enters; and
2. restrained Pact-blue focus highlights around the relevant number or button.

Do not use floating crypto coins, chain logos orbiting the product, neon tunnels, glassmorphism everywhere, or animated network maps as filler.

## Editing and annotation rules

- Zoom only when a field, state label, or button would otherwise be unreadable.
- Show the cursor hovering briefly before each important click.
- Use one circle highlight or short arrow callout at a time.
- Keep chain/provider logos subordinate to the Pact product.
- Show transaction hashes only as optional proof inserts.
- Never place a success check over footage that still shows `routing`, `submitted`, or `finalizing`.
- Do not replace waiting states with fake instantaneous transitions; compress time with a labeled cut.
- Use consistent terminology: **payee**, **payment agreement**, **event account**, **available funds**, **allocate**, **ready to pay**, and **paid**.

## Evidence and claim boundaries

The following may be stated confidently:

- Pact uses Dynamic for familiar identity and verified record access.
- Pact uses Mera/passkeys for agreement and financial authorization.
- Pact registers accepted agreement state and manages event-scoped USDC vaults on Monad mainnet.
- Aurora inbound funding has been verified from Arbitrum native ETH and Stellar XLM into Monad USDC.
- Pact independently verifies destination-chain USDC receipts before crediting received funding.
- Pact separates committed, received, available, allocated, routing, paid, and refunded states.
- Direct Monad USDC payout is the confirmed payment path.

Do not state without new evidence:

- that every Aurora-listed chain/asset route has been tested;
- that Base USDC works below its documented minimum;
- that outbound cross-chain settlement is production-live;
- that a routed payment is paid before destination evidence exists;
- that Pact has users, revenue, partners, or payment volume not supplied by the founder; or
- that the relayer can freely move funds.

## Suggested voiceover style

Write like a builder explaining a system they understand, not like an advertisement.

Good:

> The sponsor has committed five dollars, but Pact does not count that as received. Only after Aurora delivers USDC into this event account—and Pact verifies the transfer—does the balance become available.

Weak:

> Pact revolutionizes event finance with cutting-edge multichain technology.

Good:

> Dynamic establishes who the payee is. Mera proves that the same person approved these exact terms. Monad records the agreement and constrains how the event account can move funds.

Weak:

> Our seamless integrations unlock trustless interoperability.

## Questions Claude must ask before final assembly

1. What is the exact maximum duration?
2. Is the video judged with sound, and will the founder narrate?
3. Is the audience primarily product judges, technical judges, or sponsor-track judges?
4. Which live inbound route will be recorded?
5. Has an outbound Aurora delivery canary passed by the recording date?
6. Which demo accounts and wallet addresses are safe to show?
7. What product URL or action belongs on the end card?
8. Are Dynamic, Mera, Monad, and Aurora logos permitted and available in high resolution?

## Claude's required deliverables

After receiving answers and recordings, return:

1. a final time-coded script;
2. a clip-to-scene edit decision list;
3. a list of missing or unusable footage;
4. final voiceover copy;
5. exact on-screen captions;
6. callout and zoom coordinates for each product clip;
7. an audio plan covering voice, music, and interface sounds;
8. a 16:9 export checklist;
9. a shorter 9:16 cut plan if requested; and
10. a final claim-verification pass against this document.

## Final instruction to Claude

The strongest Pact demo is not a tour of every page. It is one piece of money moving through a truthful financial lifecycle:

```text
Organizer creates event
-> sponsor funds from another network
-> Aurora delivers USDC to the event account
-> organizer creates an obligation
-> payee accepts with a passkey
-> organizer allocates received money
-> organizer authorizes payment
-> payee sees settlement
```

Keep that story intact. Every screen, caption, integration mention, and proof insert must advance it.
