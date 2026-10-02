begin;

alter table allocations add column if not exists agreement_id text references payment_agreements(id);
alter table allocations add column if not exists amount_atomic numeric(78,0);
alter table allocations add column if not exists organizer_nonce numeric(78,0);
alter table allocations add column if not exists authorization_signature bytea;
alter table allocations add column if not exists authorization_deadline timestamptz;
alter table allocations add column if not exists transaction_hash text;
alter table allocations add column if not exists execution_status text not null default 'legacy_unconfirmed';
alter table allocations add column if not exists execution_error text;
alter table allocations add column if not exists confirmed_at timestamptz;

do $$ begin
  alter table allocations add constraint allocations_execution_status_check
    check (execution_status in ('legacy_unconfirmed','authorization_signed','submitted','confirmed','failed','reversed'));
exception when duplicate_object then null; end $$;

create unique index if not exists allocations_event_nonce_unique
  on allocations(event_id, organizer_nonce) where organizer_nonce is not null;
create index if not exists allocations_execution_queue_idx
  on allocations(execution_status, updated_at) where execution_status in ('authorization_signed','submitted','failed');

alter table payment_settlements add column if not exists authorization_deadline timestamptz;
create unique index if not exists payment_settlements_transaction_unique
  on payment_settlements(lower(transaction_hash)) where transaction_hash is not null;

commit;
