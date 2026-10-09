begin;

alter table funding_sources
  add column if not exists is_open_contribution boolean not null default false;

alter table funding_requests
  add column if not exists request_kind text not null default 'requested'
  check (request_kind in ('requested','public_contribution'));

alter table funding_requests
  drop constraint if exists funding_requests_amount_minor_check;

alter table funding_requests
  add constraint funding_requests_amount_minor_check
  check (
    (request_kind = 'requested' and amount_minor > 0)
    or (request_kind = 'public_contribution' and amount_minor = 0)
  );

create table if not exists event_contribution_pages (
  event_id text primary key references events(id),
  funding_source_id text not null unique references funding_sources(id),
  funding_request_id text not null unique references funding_requests(id),
  public_slug uuid not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

commit;
