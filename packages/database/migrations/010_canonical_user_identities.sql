begin;

-- Pact owns a stable user identifier. Authentication-provider subjects are
-- credentials for that user, not the ownership key for financial records.
create table if not exists pact_users (
  id text primary key,
  normalized_email text not null unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dynamic_identities (
  subject text primary key,
  user_id text not null references pact_users(id),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists dynamic_identities_user_idx on dynamic_identities(user_id);

commit;
