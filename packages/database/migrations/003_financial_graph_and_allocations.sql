begin;

create table if not exists events (
  id text primary key,
  owner_user_id text not null,
  name text not null,
  event_date date not null,
  estimated_budget_minor bigint not null check (estimated_budget_minor >= 0),
  display_currency varchar(3) not null,
  event_type text,
  status text not null default 'active' check (status in ('active')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_owner_idx on events(owner_user_id, created_at desc);

create table if not exists funding_sources (
  id text primary key,
  event_id text not null references events(id),
  source_type text not null,
  name text not null,
  committed_amount_minor bigint not null check (committed_amount_minor >= 0),
  received_amount_minor bigint not null check (received_amount_minor >= 0),
  expected_date date,
  notes text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists funding_sources_event_idx on funding_sources(event_id, created_at desc);

create table if not exists expenses (
  id text primary key,
  event_id text not null references events(id),
  title text not null,
  category text not null,
  payee_name text not null,
  payee_email text not null,
  total_amount_minor bigint not null check (total_amount_minor > 0),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expenses_event_idx on expenses(event_id, created_at desc);

create table if not exists expense_payments (
  id text primary key,
  expense_id text not null references expenses(id) on delete cascade,
  label text not null,
  amount_minor bigint not null check (amount_minor > 0),
  due_date date,
  paid_amount_minor bigint not null default 0 check (paid_amount_minor >= 0),
  processing_started_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expense_payments_expense_idx on expense_payments(expense_id);

create table if not exists allocations (
  id text primary key,
  event_id text not null references events(id),
  funding_source_id text not null references funding_sources(id),
  payment_id text not null references expense_payments(id),
  amount_minor bigint not null check (amount_minor > 0),
  created_by_user_id text not null,
  reversed_at timestamptz,
  reversed_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists allocations_source_idx on allocations(funding_source_id) where reversed_at is null;
create index if not exists allocations_payment_idx on allocations(payment_id) where reversed_at is null;

create table if not exists financial_activity (
  id bigserial primary key,
  event_id text not null references events(id),
  actor_user_id text not null,
  action text not null,
  subject_type text not null,
  subject_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists financial_activity_event_idx on financial_activity(event_id, created_at desc);

commit;
