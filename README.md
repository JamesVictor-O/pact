# Pact

**Financial infrastructure for the money behind an event.**

Pact helps event organizers manage funding, vendor commitments, payment schedules, and payouts from one place.

Instead of coordinating sponsor money, vendor deposits, outstanding balances, spreadsheets, invoices, chats, and payment screenshots separately, Pact turns an event budget into a live financial system.

> Know what is funded, what is due, and where every dollar is going.

---

## The problem

Events are financed over time.

Money may come from sponsors, organizers, partners, ticket revenue, or contributors, while payments are already due to venues, production teams, caterers, security, contractors, and other vendors.

A sponsor may commit $10,000 without sending it yet.

A venue may require a 40% deposit today and the remaining 60% later.

A production company may be paid across several stages.

The organizer's bank balance does not tell them how much money is actually free to spend.

An event can be fully funded **on paper** and still have a cash gap.

Pact makes that financial state visible.

---

## How Pact works

### 1. Create an event

The organizer creates a Pact with the event budget and date.

### 2. Add funding

Funding sources can include sponsors, organizer capital, partners, ticket revenue, or other contributors.

Pact separates:

`Committed → Received → Available`

A promised contribution is never treated as money that has already arrived.

### 3. Add vendors and payments

Expenses are broken into real payment schedules.

For example:

| Production — $8,000 | Amount |
|---|---:|
| Deposit | $3,000 |
| Setup | $3,000 |
| Final payment | $2,000 |

### 4. Allocate and pay

Received funds can remain available or be allocated to specific payments.

Pact tracks each payment as:

`Unfunded → Partially Funded → Funded → Paid`

This lets organizers see upcoming funding gaps before a vendor payment is missed.

---

## Built for three users

### Organizer

Creates the event, tracks funding, adds vendors, allocates money, identifies cash gaps, and releases payments.

### Sponsor

Opens a funding link, sees exactly what they are funding, chooses how to pay, and receives a receipt.

No need to understand Pact's internal infrastructure.

### Vendor

Sees their payment schedule, whether each payment is funded, when it is due, and when it has been paid.

---

## Why Monad

Monad is Pact's programmable settlement layer.

Event funding, allocations, vendor payment state, releases, and refunds can be represented and executed onchain instead of existing only as rows in a spreadsheet.

The organizer sees:

`Funded`

not:

`0x7f82...`

The blockchain is infrastructure, not the interface.

---

## Why Aurora Intents

Sponsors may hold funds on different chains.

Pact should not require them to manually bridge assets, change networks, acquire gas, and then return to the event.

Aurora Intents handles the cross-chain funding path underneath the product.

The user experience stays:

`Choose what to fund → Choose payment source → Confirm`

while Pact settles the event's financial state on Monad.

---

## UX principle

Pact is designed so users do not need to understand Web3 to use it.

We translate infrastructure into normal financial actions:

| Web3 concept | Pact |
|---|---|
| Bridge assets | Fund |
| Connect wallet | Choose payment method |
| Token balance | Available funds |
| Smart-contract allocation | Allocate |
| Contract execution | Pay vendor |
| Transaction hash | Receipt |
| Pending settlement | Funding in progress |

The goal is for the product to work well enough that a user eventually asks:

> **"Wait, this is a Web3 product?"**

---

## What Pact is not

Pact is not another event-management suite.

We are not building ticketing, RSVP management, seating charts, event websites, speaker schedules, or vendor discovery.

Pact focuses on one workflow:

```text
Funding
   ↓
Obligations
   ↓
Allocation
   ↓
Coverage
   ↓
Payment / Refund
```

## MVP

The current build focuses on the complete event-finance loop:

- Event creation
- Funding sources and commitments
- Vendor payment schedules
- Funding coverage dashboard
- Cross-chain funding through Aurora Intents
- USDC settlement on Monad
- Fund allocation
- Vendor payment release
- Refunds for eligible unreleased funds
- Sponsor and vendor views

## Example

```text
Total event obligations     $30,000
Funding committed           $30,000
Funding received            $13,000
Due within 14 days          $16,500
Immediate cash gap           $3,500
```

Traditional budgeting may show the event as fully funded.
Pact shows that the organizer is $3,500 short of meeting the next set of payments.
That is the difference between knowing the budget and knowing the financial state of the event.

## Local development

```sh
git clone <repository-url>
cd pact
npm install
npm run dev
```

Environment configuration will be documented in .env.example.

## Status

Pact is currently in active development.
The current focus is locking the organizer, sponsor, and vendor experience before expanding the protocol surface.
