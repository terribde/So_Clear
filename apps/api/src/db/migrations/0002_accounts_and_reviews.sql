create table private.accounts (
  id uuid primary key,
  handle text not null unique,
  display_name text not null,
  password_hash text not null,
  role text not null default 'user'
    check (role in ('user', 'content_admin', 'system_admin')),
  status text not null default 'active'
    check (status in ('active', 'restricted', 'disabled')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.account_sessions (
  id uuid primary key,
  account_id uuid not null references private.accounts (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index account_sessions_account on private.account_sessions (account_id);
create index account_sessions_active
  on private.account_sessions (token_hash, expires_at)
  where revoked_at is null;

create table private.student_grants (
  account_id uuid primary key references private.accounts (id) on delete cascade,
  grant_id uuid not null unique,
  status text not null check (status in ('active', 'revoked')),
  institution_scope text not null,
  assurance text not null check (assurance in ('demo_only', 'verified_at_claim')),
  is_demo boolean not null default false,
  version integer not null default 1 check (version >= 1),
  verified_at timestamptz not null,
  revoked_at timestamptz
);

create table private.review_authorship (
  review_id text primary key references core.reviews (id) on delete cascade,
  account_id uuid not null references private.accounts (id),
  created_at timestamptz not null default now()
);

create index review_authorship_account on private.review_authorship (account_id);

create table private.review_slots (
  account_id uuid not null references private.accounts (id),
  teacher_id text not null references core.teachers (id),
  course_id text not null references core.courses (id),
  term_id text not null references core.terms (id),
  active_review_id text references core.reviews (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, teacher_id, course_id, term_id)
);

alter table core.reviews
  add column version integer not null default 1 check (version >= 1);

create index reviews_status_created on core.reviews (status, created_at);

create table core.moderation_actions (
  id bigint generated always as identity primary key,
  review_id text not null references core.reviews (id) on delete cascade,
  revision_no integer not null,
  actor_account_id uuid not null references private.accounts (id),
  action text not null check (action in ('submit', 'approve', 'reject', 'hide', 'withdraw')),
  reason_code text,
  from_status text,
  to_status text not null,
  created_at timestamptz not null default now()
);

create index moderation_actions_review on core.moderation_actions (review_id, created_at);
