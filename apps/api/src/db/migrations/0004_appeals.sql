create table core.review_appeals (
  id uuid primary key,
  review_id text not null unique references core.reviews (id) on delete cascade,
  appellant_account_id uuid not null references private.accounts (id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  resolution_code text check (resolution_code in ('restored', 'upheld')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolver_account_id uuid references private.accounts (id),
  check (
    (status = 'pending' and resolution_code is null
      and resolved_at is null and resolver_account_id is null)
    or (status = 'accepted' and resolution_code = 'restored'
      and resolved_at is not null and resolver_account_id is not null)
    or (status = 'rejected' and resolution_code = 'upheld'
      and resolved_at is not null and resolver_account_id is not null)
  )
);

create index review_appeals_status_created
  on core.review_appeals (status, created_at);
