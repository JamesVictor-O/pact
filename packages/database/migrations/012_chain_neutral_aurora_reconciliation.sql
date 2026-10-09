begin;

-- Memo-based networks can legitimately share a collection address. The memo,
-- not the address alone, is the route identity.
alter table aurora_deposit_routes
  drop constraint if exists aurora_deposit_routes_deposit_chain_deposit_address_key;

create unique index if not exists aurora_routes_deposit_identity_idx
  on aurora_deposit_routes(deposit_chain, deposit_address, coalesce(deposit_memo, ''));

commit;
