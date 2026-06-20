-- R2 — journal des campagnes de réactivation lancées depuis le dashboard.
create table if not exists campaigns (
  id         uuid primary key default gen_random_uuid(),
  segment    text not null,
  matched    int not null default 0,
  enqueued   int not null default 0,
  created_at timestamptz not null default now()
);
alter table campaigns enable row level security;
