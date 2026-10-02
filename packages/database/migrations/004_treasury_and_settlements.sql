begin;

create table if not exists funding_requests (
  id text primary key,
  event_id text not null references events(id),
  funding_source_id text not null references funding_sources(id),
  public_slug uuid not null unique,
  amount_minor bigint not null check (amount_minor > 0),
  currency varchar(3) not null,
  status text not null default 'draft' check (status in ('draft','sent','routing','received','partially_allocated','allocated','refunded','cancelled','failed')),
  onchain_request_id bytea unique,
  expires_at timestamptz,
  sent_at timestamptz,
  created_by_user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists funding_requests_source_idx on funding_requests(funding_source_id, created_at desc);

create table if not exists funding_receipts (
  id text primary key,
  funding_request_id text not null references funding_requests(id),
  event_id text not null references events(id),
  contributor_address text not null,
  settlement_token_address text not null,
  amount_atomic numeric(78,0) not null check (amount_atomic > 0),
  amount_minor bigint not null check (amount_minor > 0),
  chain_id bigint not null,
  transaction_hash text not null,
  log_index integer not null,
  block_number bigint not null,
  status text not null default 'confirmed' check (status in ('confirming','confirmed','reorged','refunded')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(chain_id, transaction_hash, log_index)
);
create index if not exists funding_receipts_request_idx on funding_receipts(funding_request_id, status);

create table if not exists treasury_allocations (
  id text primary key,
  allocation_id text references allocations(id),
  funding_request_id text not null references funding_requests(id),
  agreement_id text not null references payment_agreements(id),
  payment_id text not null references expense_payments(id),
  amount_atomic numeric(78,0) not null check (amount_atomic > 0),
  amount_minor bigint not null check (amount_minor > 0),
  organizer_nonce numeric(78,0) not null,
  authorization_signature bytea not null,
  transaction_hash text,
  status text not null default 'pending' check (status in ('pending','submitted','confirmed','failed','reversed')),
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists treasury_allocations_payment_idx on treasury_allocations(payment_id, status);

create table if not exists payment_settlements (
  id text primary key,
  event_id text not null references events(id),
  agreement_id text not null references payment_agreements(id),
  payment_id text not null references expense_payments(id),
  payout_address text not null,
  settlement_token_address text not null,
  amount_atomic numeric(78,0) not null check (amount_atomic > 0),
  amount_minor bigint not null check (amount_minor > 0),
  organizer_nonce numeric(78,0) not null,
  authorization_signature bytea not null,
  transaction_hash text,
  status text not null default 'authorization_signed' check (status in ('authorization_signed','submitted','confirmed','failed')),
  failure_message text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(payment_id, organizer_nonce)
);
create index if not exists payment_settlements_payment_idx on payment_settlements(payment_id, created_at desc);

commit;
