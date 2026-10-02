begin;

alter table events add column if not exists organizer_address text;
alter table events add column if not exists vault_address text;
alter table events add column if not exists vault_factory_address text;
alter table events add column if not exists vault_status text not null default 'not_started';
alter table events add column if not exists vault_authorization_signature bytea;
alter table events add column if not exists vault_authorization_deadline timestamptz;
alter table events add column if not exists vault_transaction_hash text;
alter table events add column if not exists vault_error text;
alter table events add column if not exists vault_provisioning_claimed_at timestamptz;

do $$ begin
  alter table events add constraint events_vault_status_check
    check (vault_status in ('not_started','provisioning','ready','retryable_failure'));
exception when duplicate_object then null;
end $$;

create unique index if not exists events_vault_address_unique
  on events(lower(vault_address)) where vault_address is not null;

create table if not exists event_vault_attempts (
  id bigserial primary key,
  event_id text not null references events(id),
  attempt_number integer not null,
  status text not null check (status in ('submitting','submitted','confirmed','failed')),
  transaction_hash text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, attempt_number)
);

create index if not exists event_vault_attempts_event_idx
  on event_vault_attempts(event_id, created_at desc);

commit;
