begin;

alter table payout_profiles alter column payout_address type text;
alter table payout_profiles add column if not exists destination_chain text not null default 'monad';
alter table payout_profiles add column if not exists destination_asset_id text;
alter table payout_profiles add column if not exists destination_asset_symbol text not null default 'USDC';
alter table payout_profiles add column if not exists destination_asset_decimals integer not null default 6;
alter table payout_profiles add column if not exists destination_address text;
alter table payout_profiles add column if not exists destination_verification text not null default 'pact_account';

update payout_profiles set destination_address=coalesce(destination_address,payout_address),destination_asset_id=coalesce(destination_asset_id,'monad:usdc');

create table if not exists payout_route_quotes (
  id text primary key,
  event_id text not null references events(id),
  agreement_id text not null references payment_agreements(id),
  payment_id text not null references expense_payments(id),
  vault_address text not null,
  deposit_address text not null,
  refund_address text not null,
  recipient_address text not null,
  origin_asset_id text not null,
  destination_chain text not null,
  destination_asset_id text not null,
  destination_asset_symbol text not null,
  amount_in_atomic numeric(78,0) not null,
  amount_out_atomic numeric(78,0) not null,
  minimum_amount_out_atomic numeric(78,0) not null,
  amount_out_formatted text not null,
  minimum_amount_out_formatted text not null,
  quote_deadline timestamptz not null,
  aurora_correlation_id text,
  status text not null default 'quoted' check(status in ('quoted','released','routing','delivered','refunded','failed','expired')),
  raw_quote jsonb not null,
  destination_transaction_hash text,
  destination_explorer_url text,
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payout_route_quotes_payment_idx on payout_route_quotes(payment_id,created_at desc);
create unique index if not exists payout_route_quotes_active_payment_idx on payout_route_quotes(payment_id) where status in ('quoted','released','routing');

alter table payment_settlements add column if not exists payout_route_quote_id text references payout_route_quotes(id);
alter table payment_settlements add column if not exists settlement_mode text not null default 'direct';
alter table payment_settlements drop constraint if exists payment_settlements_status_check;
alter table payment_settlements add constraint payment_settlements_status_check check(status in ('authorization_signed','submitted','confirmed','routing','delivered','refunded','failed'));

commit;
