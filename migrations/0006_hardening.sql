-- Phase 6 — durcissement.

-- Retry : nombre de tentatives d'envoi sur l'étape courante d'un run.
alter table sequence_runs add column if not exists attempts int not null default 0;

-- Rate-limiting (fenêtre fixe). 1 ligne par "bucket" (route + IP).
create table if not exists rate_limits (
  bucket       text primary key,
  count        int not null default 0,
  window_start timestamptz not null default now()
);
alter table rate_limits enable row level security;

-- Incrémente atomiquement et dit si la requête est sous le plafond.
create or replace function rate_hit(p_bucket text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
as $$
declare
  c int;
begin
  insert into rate_limits (bucket, count, window_start)
    values (p_bucket, 1, now())
  on conflict (bucket) do update set
    count = case
      when rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
      then 1 else rate_limits.count + 1 end,
    window_start = case
      when rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
      then now() else rate_limits.window_start end
  returning count into c;
  return c <= p_limit;
end;
$$;
