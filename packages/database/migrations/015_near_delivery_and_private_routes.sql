begin;

-- NEAR HACKATHON (built after the pre-hackathon tag).
--
-- 1. Private (confidential) routing on NEAR Intents for payouts and contributions.
-- 2. Independent destination-chain delivery evidence for routed payouts.
-- 3. One destination transaction can settle at most one payout route.

alter table payout_route_quotes
  add column if not exists confidentiality text not null default 'public'
    check (confidentiality in ('public','basic','advanced'));
alter table payout_route_quotes add column if not exists destination_verified_at timestamptz;
alter table payout_route_quotes add column if not exists destination_verified_amount_atomic numeric(78,0);
alter table payout_route_quotes add column if not exists destination_verification jsonb;

-- A NEAR (or other destination) transaction is evidence for exactly one payout.
-- Without this, two routes to the same payee for the same amount could both
-- claim one delivery when hashes are discovered rather than reported.
create unique index if not exists payout_route_quotes_destination_tx_idx
  on payout_route_quotes(destination_chain, destination_transaction_hash)
  where destination_transaction_hash is not null;

-- Contribution routes: a Private route is a different Aurora persistent
-- address (confidential is part of the address identity), so a funding request
-- may hold one public and one private route per source family.
alter table aurora_deposit_routes add column if not exists confidential boolean not null default false;
alter table aurora_deposit_routes drop constraint if exists aurora_deposit_routes_funding_request_id_deposit_chain_key;
create unique index if not exists aurora_routes_request_chain_privacy_idx
  on aurora_deposit_routes(funding_request_id, deposit_chain, confidential);

commit;
