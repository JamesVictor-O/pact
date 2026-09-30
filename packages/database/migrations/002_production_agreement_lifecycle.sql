begin;

alter table payment_agreements drop constraint if exists payment_agreements_status_check;
alter table payment_agreements add constraint payment_agreements_status_check check(status in ('draft','awaiting_acceptance','acceptance_signed','registration_pending','active','declined','cancelled','completed'));
alter table payment_agreements add column if not exists proposal_expires_at timestamptz;
alter table payment_agreements add column if not exists onchain_agreement_id varchar(66);
alter table payment_agreements add column if not exists onchain_tx_hash varchar(66);
alter table payment_agreements add column if not exists registration_error text;
alter table payment_agreements add column if not exists registered_at timestamptz;
alter table payment_agreements add column if not exists registration_claimed_at timestamptz;

alter table agreement_registration_attempts add column if not exists updated_at timestamptz not null default now();
create unique index if not exists agreement_registration_single_inflight_idx
  on agreement_registration_attempts(agreement_id) where status in ('submitting','submitted');

create index if not exists payment_agreements_organizer_idx on payment_agreements(organizer_user_id, created_at desc);
create index if not exists payment_agreements_registration_queue_idx on payment_agreements(status, updated_at)
  where status in ('acceptance_signed','registration_pending');

commit;
