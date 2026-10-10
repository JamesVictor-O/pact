begin;

create table if not exists payout_profile_revisions (
  id text primary key,
  user_id text not null,
  payout_type text not null check(payout_type in ('mera','external_wallet')),
  destination_chain text not null,
  destination_asset_id text not null,
  destination_asset_symbol text not null,
  destination_asset_decimals integer not null,
  destination_address text not null,
  destination_verification text not null,
  created_at timestamptz not null default now()
);

create index if not exists payout_profile_revisions_user_idx
  on payout_profile_revisions(user_id,created_at desc);

commit;
