begin;

-- Every record created before the mainnet cutover belongs to Monad Testnet.
alter table events add column if not exists network_chain_id bigint;
update events set network_chain_id=10143 where network_chain_id is null;
alter table events alter column network_chain_id set not null;
alter table events alter column network_chain_id set default 143;
create index if not exists events_owner_network_idx on events(owner_user_id,network_chain_id,created_at desc);

alter table payment_agreements add column if not exists network_chain_id bigint;
update payment_agreements a set network_chain_id=e.network_chain_id from events e where e.id=a.event_id and a.network_chain_id is null;
alter table payment_agreements alter column network_chain_id set not null;
alter table payment_agreements alter column network_chain_id set default 143;

alter table event_vault_attempts add column if not exists network_chain_id bigint;
update event_vault_attempts a set network_chain_id=e.network_chain_id from events e where e.id=a.event_id and a.network_chain_id is null;
alter table event_vault_attempts alter column network_chain_id set not null;
alter table event_vault_attempts alter column network_chain_id set default 143;

alter table allocations add column if not exists network_chain_id bigint;
update allocations a set network_chain_id=e.network_chain_id from events e where e.id=a.event_id and a.network_chain_id is null;
alter table allocations alter column network_chain_id set not null;
alter table allocations alter column network_chain_id set default 143;

alter table payment_settlements add column if not exists network_chain_id bigint;
update payment_settlements s set network_chain_id=e.network_chain_id from events e where e.id=s.event_id and s.network_chain_id is null;
alter table payment_settlements alter column network_chain_id set not null;
alter table payment_settlements alter column network_chain_id set default 143;

alter table payout_route_quotes add column if not exists network_chain_id bigint;
update payout_route_quotes r set network_chain_id=e.network_chain_id from events e where e.id=r.event_id and r.network_chain_id is null;
alter table payout_route_quotes alter column network_chain_id set not null;
alter table payout_route_quotes alter column network_chain_id set default 143;

create index if not exists agreements_event_network_idx on payment_agreements(event_id,network_chain_id);
create index if not exists allocations_event_network_idx on allocations(event_id,network_chain_id);
create index if not exists settlements_event_network_idx on payment_settlements(event_id,network_chain_id);
create index if not exists payout_routes_event_network_idx on payout_route_quotes(event_id,network_chain_id);

commit;
