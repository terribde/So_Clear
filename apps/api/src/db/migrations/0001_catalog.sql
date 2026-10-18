create schema if not exists core;
create schema if not exists published;

create table core.institutions (
  id text primary key,
  name text not null
);

create table core.departments (
  id text primary key,
  institution_id text not null references core.institutions (id),
  name text not null,
  sort_order integer not null default 0,
  unique (institution_id, name)
);

create table core.terms (
  id text primary key,
  institution_id text not null references core.institutions (id),
  label text not null,
  is_current boolean not null default false,
  sort_order integer not null default 0
);

create unique index terms_one_current_per_institution
  on core.terms (institution_id)
  where is_current;

create table core.courses (
  id text primary key,
  institution_id text not null references core.institutions (id),
  department_id text not null references core.departments (id),
  name text not null,
  sort_order integer not null default 0
);

create table core.teachers (
  id text primary key,
  institution_id text not null references core.institutions (id),
  department_id text not null references core.departments (id),
  name text not null,
  title text not null,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  data_version integer not null default 1,
  updated_at timestamptz not null
);

create table core.teacher_courses (
  teacher_id text not null references core.teachers (id) on delete cascade,
  course_id text not null references core.courses (id),
  sort_order integer not null,
  primary key (teacher_id, course_id)
);

create table core.sections (
  id text primary key,
  term_id text not null references core.terms (id),
  course_id text not null references core.courses (id),
  section_code text not null,
  campus text not null,
  capacity integer check (capacity is null or capacity > 0),
  note text,
  data_version integer not null default 1,
  source_updated_at timestamptz not null,
  unique (term_id, section_code)
);

create table core.section_teachers (
  section_id text not null references core.sections (id) on delete cascade,
  teacher_id text not null references core.teachers (id),
  position integer not null,
  mapping_state text not null default 'confirmed'
    check (mapping_state in ('confirmed', 'pending')),
  primary key (section_id, teacher_id)
);

create table core.meetings (
  id bigint generated always as identity primary key,
  section_id text not null references core.sections (id) on delete cascade,
  sort_order integer not null,
  weekday smallint check (weekday between 1 and 7),
  start_period smallint check (start_period between 1 and 14),
  end_period smallint check (end_period between 1 and 14),
  weeks text,
  location text,
  time_unknown boolean not null default false,
  check (
    (time_unknown
      and weekday is null
      and start_period is null
      and end_period is null
      and location is null)
    or
    (not time_unknown
      and weekday is not null
      and start_period is not null
      and end_period is not null
      and end_period >= start_period)
  )
);

create table core.reviews (
  id text primary key,
  teacher_id text not null references core.teachers (id),
  course_id text not null references core.courses (id),
  term_id text not null references core.terms (id),
  status text not null
    check (status in ('pending', 'published', 'rejected', 'hidden', 'withdrawn')),
  current_revision integer not null check (current_revision >= 1),
  publication_generation integer not null default 0 check (publication_generation >= 0),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table core.review_revisions (
  review_id text not null references core.reviews (id) on delete cascade,
  revision_no integer not null check (revision_no >= 1),
  clarity smallint not null check (clarity between 1 and 5),
  organization smallint not null check (organization between 1 and 5),
  feedback smallint not null check (feedback between 1 and 5),
  assessment_transparency smallint not null check (assessment_transparency between 1 and 5),
  difficulty smallint check (difficulty between 1 and 5),
  workload smallint check (workload between 1 and 5),
  attendance text check (
    attendance is null
    or attendance in ('每节必点', '经常点名', '偶尔点名', '基本不点名', '未说明')
  ),
  comment text,
  rating_schema_version integer not null,
  submitted_at timestamptz not null,
  published_at timestamptz,
  primary key (review_id, revision_no)
);

create table core.teacher_ai_summaries (
  teacher_id text primary key references core.teachers (id) on delete cascade,
  state text not null check (state in ('ready', 'generating', 'unavailable')),
  sentences jsonb not null default '[]'::jsonb check (jsonb_typeof(sentences) = 'array'),
  limitations text not null,
  generated_at timestamptz,
  teacher_summary_epoch integer not null default 0 check (teacher_summary_epoch >= 0)
);

create index teachers_department on core.teachers (department_id) where is_active;
create index sections_term_course on core.sections (term_id, course_id);
create index section_teachers_teacher on core.section_teachers (teacher_id);
create index reviews_teacher_status on core.reviews (teacher_id, status);
create index reviews_course_status on core.reviews (course_id, status);
create index review_revisions_published_at
  on core.review_revisions (published_at desc)
  where published_at is not null;

create view published.review_public as
select
  r.id,
  r.teacher_id,
  r.course_id,
  r.term_id,
  r.current_revision,
  rv.clarity::int as clarity,
  rv.organization::int as organization,
  rv.feedback::int as feedback,
  rv.assessment_transparency::int as assessment_transparency,
  rv.difficulty::int as difficulty,
  rv.workload::int as workload,
  rv.attendance,
  rv.comment,
  rv.published_at
from core.reviews r
join core.review_revisions rv
  on rv.review_id = r.id
 and rv.revision_no = r.current_revision
where r.status = 'published'
  and rv.published_at is not null;
