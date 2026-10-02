# Pact Product Flow
## Implementation Specification for Onboarding and Core Event-Finance UX

**Status:** Build-ready  
**Primary implementation target:** Organizer onboarding + first event creation  
**Product:** Pact  
**Core principle:** Pact should feel like a normal financial operations product. Blockchain infrastructure must stay below the user experience.

---

# 1. Product Definition

Pact is the financial operating layer for producing events.

It helps organizers coordinate:

- where event money is coming from,
- what money has actually arrived,
- what money is already committed,
- what vendors need to be paid,
- what payments are funded,
- what remains available,
- and where cash gaps exist.

The core product loop is:

```text
Funding → Obligations → Allocation → Coverage → Payment / Refund
```

Pact is not an event-planning platform.

Do not introduce:

- ticketing,
- seating,
- RSVP flows,
- speaker management,
- event websites,
- attendee CRM,
- vendor discovery,
- generic task management.

---

# 2. UX North Star

A successful Pact experience should make a user eventually ask:

> "Wait, this is a Web3 product?"

That means:

- no wallet-first onboarding,
- no chain selection during normal onboarding,
- no gas language,
- no bridge language,
- no transaction hashes as primary status,
- no requirement to understand Monad,
- no requirement to understand Aurora,
- no seed phrase or extension requirement where embedded account infrastructure can avoid it.

Use familiar financial language.

| Infrastructure | Pact language |
|---|---|
| Wallet connection | Sign in / Choose payment method |
| Cross-chain intent | Fund |
| Token balance | Available funds |
| Onchain allocation | Allocate funds |
| Contract milestone | Payment |
| Execute release | Pay vendor |
| Tx pending | Payment processing / Funding in progress |
| Tx hash | Receipt reference |
| Refund call | Return funds |

---

# 3. User Types

Pact has three primary user experiences.

## 3.1 Organizer

The organizer is the main product user.

They need to:

- create an account,
- create an event,
- define the event budget,
- record expected funding,
- add expenses/vendors,
- create payment schedules,
- track cash coverage,
- allocate received funds,
- release vendor payments,
- manage eligible refunds.

The organizer gets a full workspace.

---

## 3.2 Sponsor / Contributor

The sponsor should not need to learn Pact.

They need to:

- open a funding link,
- understand the event,
- understand how much they are contributing,
- understand what the contribution funds,
- choose a payment source,
- confirm,
- receive a receipt.

The sponsor should not be forced through a full app onboarding flow.

---

## 3.3 Vendor

The vendor primarily needs payment certainty.

They need to:

- open a secure vendor link,
- review the contract/payment schedule,
- confirm payout details,
- see which payments are funded,
- see due dates,
- see when payments are paid.

The vendor does not need the organizer dashboard.

---

# 4. Organizer Onboarding

This is the first implementation priority.

The onboarding goal is not to collect every possible detail.

The goal is:

> Get the organizer from first visit to a useful event-finance workspace with as little friction as possible.

---

# 5. Organizer Entry Flow

## Route

```text
/
```

Primary CTA:

```text
Create your Pact
```

Secondary CTA:

```text
Sign in
```

Recommended hero copy:

```text
Run the money behind your event in one place.

Track funding, vendor commitments, payment schedules, and cash gaps without spreadsheets.
```

Do not mention blockchain in the hero.

---

# 6. Authentication Flow

## Route

```text
/auth
```

Recommended options:

```text
Continue with Google
Continue with email
```

Optional:

```text
Continue with Apple
```

Do not use:

```text
Connect Wallet
Connect Web3 Wallet
Select Network
```

If an embedded wallet/account is provisioned internally, do it silently after authentication.

The user should experience account creation, not wallet creation.

---

# 7. First-Time User Decision

After successful authentication:

```text
Does user already have an event?
```

### If no events exist

Send directly to:

```text
/events/new
```

### If one or more events exist

Send to:

```text
/dashboard
```

Do not show an empty dashboard before event creation.

---

# 8. Create Event Flow

## Route

```text
/events/new
```

The first event creation flow should be extremely short.

### Screen title

```text
Create your Pact
```

### Supporting copy

```text
Start with the basics. You can add funding, vendors, and payment schedules next.
```

### Required fields

#### Event name

Example:

```text
Build Forward Conference
```

#### Event date

Example:

```text
October 28, 2026
```

#### Estimated budget

Example:

```text
30000
```

#### Display currency

Default:

```text
USD
```

Options may include:

```text
USD
NGN
EUR
GBP
```

Important:

Display currency is a UI/accounting preference.

Do not imply that settlement necessarily happens in that fiat currency.

### Optional field

Event type:

```text
Conference
Community Event
Concert
Corporate Event
Creator Event
Wedding
Other
```

This should be optional and should not affect the core financial workflow.

### CTA

```text
Create Pact
```

---

# 9. Event Creation UX Rules

Do not ask for:

- wallet address,
- Monad network,
- settlement contract,
- sponsor details,
- vendor details,
- location,
- event description,
- banner image,
- attendee count,
- ticket setup,
- website,
- speaker information.

Those are not required to establish the event's financial container.

---

# 10. Event Creation Success

After the user clicks:

```text
Create Pact
```

System behavior:

1. Create event record.
2. Create associated organizer ownership relationship.
3. Provision onchain event state only if required by architecture.
4. Do not block the user on chain execution if the infrastructure can be initialized asynchronously.
5. Send user to the Event Overview.

Destination:

```text
/events/:eventId
```

---

# 11. First Event Overview

This screen must teach the product immediately.

It should not look like an empty admin dashboard.

## Header

```text
Build Forward Conference
October 28, 2026
```

## Primary financial cards

```text
Estimated budget
$30,000
```

```text
Funding received
$0
```

```text
Committed to vendors
$0
```

```text
Available
$0
```

## Empty-state section

Heading:

```text
Start building your event finances
```

Two primary actions:

```text
Add funding
Add expense
```

Supporting explanation:

```text
Track where your money is coming from and what your event needs to pay.
```

These two actions should visually dominate the first-run experience.

---

# 12. Organizer Product Navigation

Recommended navigation:

```text
Overview
Funding
Expenses
Payments
People
Activity
```

Optional later:

```text
Reports
Settings
```

Do not use blockchain-centric navigation such as:

```text
Wallet
Bridge
Tokens
Contracts
Transactions
```

---

# 13. Add Funding Flow

Entry points:

```text
Overview → Add funding
Funding → Add funding source
```

## Step 1 — Funding source type

Question:

```text
Where is this money coming from?
```

Options:

```text
Organizer funds
Sponsor
Partner
Ticket revenue
Grant
Other
```

---

# 14. Organizer Funds Flow

If user selects:

```text
Organizer funds
```

Ask:

```text
How much are you adding?
```

Input:

```text
$5,000
```

Then ask:

```text
Where should this money go?
```

Options:

```text
Keep available for the event
Allocate it now
```

If `Allocate it now`:

Show existing expenses/payments and allow selection.

If no expenses exist:

Disable allocation and explain:

```text
Add an expense first to allocate this funding.
```

---

# 15. Organizer Funding Payment Flow

After amount/purpose:

Question:

```text
How would you like to fund this?
```

Show available payment methods/assets.

Example:

```text
USDC
$8,421 available
```

```text
USDT
$3,810 available
```

```text
ETH
≈ $12,740 available
```

If network needs to be shown, keep it secondary:

```text
USDC · Base
```

Not:

```text
Select source chain
```

Confirmation screen:

```text
You pay
5,012 USDC

Your Pact receives
5,000 USDC

Fee
12 USDC

Estimated time
~20 seconds
```

Primary CTA:

```text
Add $5,000
```

Aurora handles cross-chain routing underneath.

---

# 16. Funding Processing State

After confirmation:

Show:

```text
Adding funds...
```

Then:

```text
$5,000 added to Build Forward Conference
```

If delayed:

```text
Funding in progress
```

Supporting copy:

```text
Your payment has been received and is still being settled into the event.
```

Do not show only a spinner.

Do not show a raw transaction hash as the main state.

Technical details may be available under:

```text
View technical details
```

---

# 17. Sponsor Funding Source Flow

If organizer selects:

```text
Sponsor
```

Fields:

### Sponsor name

```text
Aurora Labs
```

### Committed amount

```text
$8,000
```

### Expected by

```text
October 10, 2026
```

### What is this funding for?

Options:

```text
General event funding
Specific expenses
```

If `Specific expenses`:

Allow allocations such as:

```text
Production — $5,000
Venue — $3,000
```

Primary CTA:

```text
Create funding request
```

---

# 18. Sponsor Funding Source State

After creation:

```text
Aurora Labs
$8,000 committed
$0 received
Due October 10
```

Actions:

```text
Send funding link
Edit
```

The system must preserve the difference between:

```text
Committed
Received
```

A commitment must never count as received funds.

---

# 19. Sponsor Funding Link

Example route:

```text
/fund/:requestId
```

This is a public or secure-link payment surface.

It should not look like the organizer app.

No sidebar.

No dashboard.

No forced account creation.

Example content:

```text
Build Forward Conference

Aurora Labs sponsorship

$8,000

Your contribution will fund:

Production
$5,000

Venue
$3,000

Event date
October 28, 2026
```

Primary CTA:

```text
Fund $8,000
```

---

# 20. Sponsor Payment Experience

After clicking:

```text
Fund $8,000
```

Show available payment sources.

Keep blockchain mechanics hidden.

Confirmation:

```text
You pay
$8,012

Build Forward receives
$8,000

Fee
$12
```

CTA:

```text
Confirm funding
```

Success:

```text
Contribution funded

Your $8,000 contribution has been added to Build Forward Conference.
```

If allocated:

```text
$5,000 → Production
$3,000 → Venue
```

Secondary:

```text
View receipt
```

Optional:

```text
Track this sponsorship
```

Only then invite the sponsor to create/sign into an account.

Never require account creation before payment.

---

# 21. Add Expense Flow

Entry:

```text
Overview → Add expense
Expenses → Add expense
```

Do not call this:

```text
Create obligation
```

Use familiar language.

## Step 1 — Expense details

### What are you paying for?

Example:

```text
Production
```

### Vendor

Example:

```text
Pixel Production Ltd.
```

### Vendor email

Example:

```text
payments@pixelproduction.com
```

### Total amount

Example:

```text
$8,000
```

### Category

Options:

```text
Venue
Production
Catering
Security
Travel
Media
Equipment
Contractor
Other
```

---

# 22. Payment Schedule Flow

After expense details:

Question:

```text
How will this be paid?
```

Options:

```text
Single payment
Deposit + balance
Custom payment schedule
```

## Deposit + balance example

```text
Deposit
$3,000
Due Oct 5

Final balance
$5,000
Due Oct 28
```

Do not expose the word `milestone` unless needed in technical/admin contexts.

Users think in payment schedules.

---

# 23. Expense Creation Success

After save:

```text
Production added
```

Then:

```text
Pixel Production will receive an invitation to confirm payout details.
```

Actions:

```text
View expense
Add another expense
```

System creates:

- expense record,
- payment records,
- vendor relationship,
- vendor invitation.

---

# 24. Vendor Invitation

Vendor email/message copy should communicate value immediately.

Example:

```text
Build Forward Conference has scheduled $8,000 in payments to Pixel Production Ltd.

Deposit
$3,000 — October 5

Final payment
$5,000 — October 28

Review payment schedule
```

Do not say:

```text
You have been invited to Web3.
```

Do not lead with wallet setup.

---

# 25. Vendor View

Route:

```text
/vendor/:inviteId
```

Example:

```text
Build Forward Conference

Pixel Production Ltd.

Your payment schedule

Deposit
$3,000
October 5
Funded

Final payment
$5,000
October 28
Not yet funded
```

Primary CTA if payout details missing:

```text
Set up payout
```

---

# 26. Vendor Payout Setup

For MVP, support the available payout infrastructure without exposing unnecessary chain concepts.

Preferred UX:

```text
How would you like to receive payment?
```

Possible options depending on implementation:

```text
Existing wallet
Pact account
```

Future:

```text
Bank account
Stablecoin
```

If using an embedded wallet:

- provision silently,
- do not ask the user to save a seed phrase during normal onboarding,
- do not make "wallet" the primary product concept.

---

# 27. Allocation Flow

Organizer can allocate received money to an expense/payment.

Entry:

```text
Funding source → Allocate
Expense → Add funding
Overview → Allocate funds
```

Example:

```text
Available event funds
$6,000

Allocate to
Production deposit

Amount
$3,000
```

CTA:

```text
Allocate $3,000
```

Success:

```text
Production deposit is fully funded.
```

Allocation changes financial state but does not pay the vendor yet.

---

# 28. Coverage Logic

Core financial states:

```text
Committed
Received
Available
Allocated
Funded
Paid
Refundable
Refunded
```

Definitions:

## Committed

Promised but not necessarily received.

## Received

Successfully settled into Pact.

## Available

Received and not allocated or paid.

## Allocated

Reserved for a specific payment but not released.

## Funded

The payment has enough allocated funds to cover its required amount.

## Paid

Released to the vendor.

## Refundable

Eligible to return to contributor.

## Refunded

Successfully returned.

---

# 29. Organizer Dashboard Calculations

The Overview should answer:

```text
Can this event safely meet its upcoming payments?
```

Show:

```text
Budget
Committed funding
Received funding
Available
Allocated
Paid
Upcoming payments
Funding gap
Cash gap
```

Important distinction:

```text
Funding gap = total obligations - secured funding
```

```text
Cash gap = upcoming payments - received/allocated capital available for that period
```

---

# 30. Cash Gap Alert

Example:

```text
You have a $3,500 cash gap

Two upcoming payments are not fully covered.
```

Breakdown:

```text
Catering
$3,500 due Oct 8
$1,500 funded
$2,000 gap
```

```text
Video
$2,000 due Oct 12
$500 funded
$1,500 gap
```

Primary action:

```text
Request funding
```

Secondary:

```text
Allocate available funds
```

---

# 31. Vendor Payment Release

Expense detail:

```text
Production

Deposit
$3,000

Status
Funded

Due
October 5
```

Primary CTA:

```text
Pay $3,000
```

Confirmation:

```text
Pay Pixel Production $3,000?

Production — Deposit

Payment destination verified by Pixel Production.
```

CTA:

```text
Confirm payment
```

---

# 32. Payment Processing

After confirm:

```text
Payment processing
```

Then:

```text
$3,000 paid
```

Vendor receives updated state.

Technical transaction details should be secondary.

---

# 33. Refund Flow

Eligible unreleased funds may become refundable when:

- event is cancelled,
- payment is cancelled,
- sponsor funding terms require return,
- organizer explicitly returns unused eligible funds.

Flow:

```text
Eligible contribution
→ Mark refundable
→ Confirm return
→ Processing
→ Refunded
```

Never automatically claw back released vendor payments.

---

# 34. Failure UX

Never expose raw infrastructure errors as the primary user experience.

## Cross-chain funding delayed

Show:

```text
Funding in progress

Your payment has been received, but it has not finished settling into the event yet.
```

## Cross-chain execution fails after deposit

Show:

```text
Action required

Your funds were received but could not be added to the selected payment.

No funds were lost.
```

Provide:

```text
Retry
Move to event reserve
Return funds
```

depending on implementation.

## Vendor payout fails

Show:

```text
Payment not completed

The funds are still secured for this payment.
```

Allow:

```text
Retry payment
Update payout details
```

---

# 35. Suggested Route Map

```text
/
├── /auth
├── /dashboard
├── /events/new
├── /events/:eventId
│   ├── /funding
│   ├── /expenses
│   ├── /payments
│   ├── /people
│   ├── /activity
│   └── /settings
│
├── /fund/:requestId
└── /vendor/:inviteId
```

---

# 36. Suggested Core Data Model

## User

```ts
type User = {
  id: string
  name: string
  email: string
  createdAt: string
}
```

## Event

```ts
type Event = {
  id: string
  ownerId: string
  name: string
  date: string
  estimatedBudget: number
  displayCurrency: string
  settlementAsset: string
  status: "draft" | "active" | "cancelled" | "closed"
  createdAt: string
}
```

## FundingSource

```ts
type FundingSource = {
  id: string
  eventId: string
  type:
    | "organizer"
    | "sponsor"
    | "partner"
    | "ticket_revenue"
    | "grant"
    | "other"
  name: string
  committedAmount: number
  receivedAmount: number
  expectedDate?: string
  status: "expected" | "partial" | "received" | "cancelled"
}
```

## Expense

```ts
type Expense = {
  id: string
  eventId: string
  vendorId?: string
  title: string
  category: string
  totalAmount: number
  status: "active" | "completed" | "cancelled"
}
```

## Payment

```ts
type Payment = {
  id: string
  expenseId: string
  label: string
  amount: number
  dueDate?: string
  fundedAmount: number
  status:
    | "unfunded"
    | "partially_funded"
    | "funded"
    | "processing"
    | "paid"
    | "cancelled"
}
```

## Allocation

```ts
type Allocation = {
  id: string
  eventId: string
  fundingSourceId?: string
  paymentId?: string
  amount: number
  status: "active" | "released" | "refunded"
}
```

## Vendor

```ts
type Vendor = {
  id: string
  name: string
  email: string
  payoutStatus: "missing" | "pending" | "verified"
}
```

---

# 37. Onboarding State Machine

Recommended onboarding states:

```text
UNAUTHENTICATED
    ↓
AUTHENTICATED_NO_EVENT
    ↓
CREATING_EVENT
    ↓
EVENT_CREATED
    ↓
FIRST_ACTION_PENDING
    ↓
ACTIVE_ORGANIZER
```

`FIRST_ACTION_PENDING` means:

The user has created the event but has not yet added either:

- a funding source,
- or an expense.

Use this state to show strong guided empty states.

---

# 38. First-Run Guidance

After event creation, use lightweight prompts instead of a forced tutorial.

Example:

```text
1. Add where your event money is coming from
2. Add what your event needs to pay
3. Pact will show what is covered and what is not
```

Avoid full-screen product tours.

The user should learn Pact by doing real work.

---

# 39. Acceptance Criteria — Organizer Onboarding

The onboarding implementation is complete when:

- [ ] A new user can sign in without connecting a wallet manually.
- [ ] A first-time user is routed directly to event creation.
- [ ] Event creation requires no more than 4 core fields.
- [ ] Creating an event takes less than roughly 60 seconds for a user who knows their event name/date/budget.
- [ ] No blockchain terminology appears in the normal onboarding flow.
- [ ] The new event opens directly into a useful Event Overview.
- [ ] The Overview clearly offers `Add funding` and `Add expense`.
- [ ] Empty states teach the product without requiring a tutorial.
- [ ] The event financial summary renders correctly with zero values.
- [ ] The user can add their first funding source.
- [ ] The user can add their first expense/payment schedule.
- [ ] Committed and received funding are stored separately.
- [ ] Organizer funds and sponsor commitments follow different flows.
- [ ] Loading and failure states use financial/product language, not RPC/chain language.

---

# 40. Acceptance Criteria — Sponsor Flow

- [ ] Sponsor can open a funding link without signing in.
- [ ] Sponsor immediately sees event, amount, and funding purpose.
- [ ] Sponsor does not need to know the destination network.
- [ ] Sponsor does not manually bridge assets.
- [ ] Sponsor receives a clear success/failure state.
- [ ] Sponsor receives a receipt.
- [ ] Sponsor account creation is optional after payment.

---

# 41. Acceptance Criteria — Vendor Flow

- [ ] Vendor can open invitation without navigating the organizer app.
- [ ] Vendor sees contract amount and payment schedule.
- [ ] Vendor sees whether each payment is funded.
- [ ] Vendor can confirm payout details.
- [ ] Vendor is never asked to release their own payment.
- [ ] Vendor receives clear paid/processing status.
- [ ] Technical transaction details remain secondary.

---

# 42. Implementation Priority

Build in this order:

## Phase 1 — Organizer onboarding

1. Landing page CTA
2. Authentication
3. First-time routing
4. Create Event
5. Event Overview empty state
6. Navigation shell

## Phase 2 — Financial setup

7. Add funding source
8. Organizer funds
9. Sponsor commitment
10. Add expense
11. Payment schedule
12. Dashboard calculations

## Phase 3 — External user surfaces

13. Sponsor funding link
14. Vendor invitation
15. Vendor payment view

## Phase 4 — Money movement

16. Aurora funding integration
17. Monad event state
18. Allocation
19. Vendor payment release
20. Refund flow

## Phase 5 — Reliability

21. Processing states
22. Failed route recovery
23. Payout failure recovery
24. Activity history
25. Receipts

---

# 43. Important Product Rules for Implementation

1. **Do not create wallet-first onboarding.**
2. **Do not expose Monad during normal event creation.**
3. **Do not expose Aurora as a user-facing product feature.**
4. **Do not treat committed funding as received funding.**
5. **Do not treat allocated funds as available funds.**
6. **Do not use "obligation" or "milestone" as the default user-facing language.**
7. **Do not require sponsors to create accounts before paying.**
8. **Do not make organizers manually enter vendor wallet addresses when the vendor can verify payout details themselves.**
9. **Do not use a transaction hash as the user's primary receipt.**
10. **Do not add event-management features outside the financial workflow during MVP.**

---

# 44. Final Product Mental Model

For the organizer:

```text
Where is my money coming from?
        ↓
What do I need to pay?
        ↓
Which payments are already covered?
        ↓
What is still at risk?
        ↓
Pay when ready.
```

For the sponsor:

```text
What am I funding?
        ↓
How much?
        ↓
Pay.
        ↓
Receipt.
```

For the vendor:

```text
What am I owed?
        ↓
Is it funded?
        ↓
When is it due?
        ↓
Has it been paid?
```

For the infrastructure:

```text
Aurora answers:
Where can the money come from?

Monad answers:
What is the money allowed to do once it arrives?

Pact answers:
What does the human need to know or do?
```

---

# 45. Implementation Goal

The first onboarding release should prove one thing:

> A non-crypto-native organizer can create an event, understand Pact's financial model, and begin adding funding and expenses without encountering a Web3 concept.

Do not expand scope until that flow feels obvious.
