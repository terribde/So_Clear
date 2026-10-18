create table core.reports (
  id uuid primary key,
  review_id text not null references core.reviews (id) on delete cascade,
  reporter_account_id uuid not null references private.accounts (id) on delete cascade,
  reason_code text not null
    check (reason_code in ('privacy', 'harassment', 'false_info', 'spam', 'other')),
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'resolved', 'dismissed')),
  resolution_code text
    check (resolution_code is null or resolution_code in ('hide', 'dismiss')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolver_account_id uuid references private.accounts (id),
  constraint reports_note_length check (note is null or char_length(note) <= 1000),
  constraint reports_resolution_consistency check (
    (status = 'pending'
      and resolution_code is null
      and resolved_at is null
      and resolver_account_id is null)
    or (status <> 'pending'
      and resolution_code is not null
      and resolved_at is not null
      and resolver_account_id is not null)
  ),
  unique (review_id, reporter_account_id)
);

create index reports_status_created on core.reports (status, created_at);
create index reports_review on core.reports (review_id, created_at desc);
