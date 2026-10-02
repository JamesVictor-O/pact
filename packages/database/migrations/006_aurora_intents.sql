begin;

create table if not exists aurora_deposit_routes (
  id text primary key,
  funding_request_id text not null references funding_requests(id),
  event_id text not null references events(id),
  deposit_chain text not null,
  deposit_address text not null,
  deposit_memo text,
  destination_chain text not null,
  destination_asset text not null,
  recipient_address text not null,
  sender_reference text not null,
  status text not null default 'ready' check (status in ('ready','deposit_received','processing','success','failed')),
  already_existed boolean not null default false,
  correlation_id text,
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(funding_request_id, deposit_chain),
  unique(deposit_chain, deposit_address)
);

create index if not exists aurora_routes_request_idx on aurora_deposit_routes(funding_request_id, created_at);

create table if not exists aurora_route_deposits (
  id text primary key,
  route_id text not null references aurora_deposit_routes(id),
  observation_type text not null check (observation_type in ('received','success','failed')),
  transaction_hash text not null,
  source_chain text,
  destination_chain text,
  asset_id text,
  decimals integer,
  amount_atomic numeric(78,0) not null check (amount_atomic >= 0),
  sender_address text,
  recipient_address text not null,
  aurora_created_at timestamptz,
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(route_id, observation_type, transaction_hash)
);

create index if not exists aurora_deposits_route_idx on aurora_route_deposits(route_id, created_at);

commit;
