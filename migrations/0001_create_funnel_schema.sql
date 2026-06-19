-- ════════════════════════════════════════════════════════════════════
-- Chariow Funnel Engine — Phase 1 : modèle de données
-- La mémoire d'état vit ICI (Insforge), jamais dans Chariow (lecture seule).
-- Idempotence garantie par les contraintes UNIQUE sur les clés chariow_*.
-- RLS activé + AUCUNE policy = deny-all : seul l'accès serveur (clé admin,
-- qui bypass RLS) peut lire/écrire. La clé anon ne voit rien.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Types énumérés ───────────────────────────────────────────────────
do $$ begin
  create type sale_status as enum ('successful', 'abandoned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sequence_trigger as enum ('abandoned_sale', 'successful_sale', 'manual_reactivation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type run_status as enum ('pending', 'sent', 'stopped', 'converted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_channel as enum ('whatsapp', 'email');
exception when duplicate_object then null; end $$;

-- ── Fonction trigger : updated_at automatique ────────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── customers ────────────────────────────────────────────────────────
create table if not exists customers (
  id               uuid primary key default gen_random_uuid(),
  chariow_id       text not null unique,              -- clé de déduplication
  email            text,
  whatsapp         text,
  full_name        text,
  segment          text[] not null default '{}',      -- dormant, vip, mono_produit, ...
  last_purchase_at timestamptz,
  total_spent      numeric(14,2) not null default 0,  -- FCFA
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_customers_email    on customers (email);
create index if not exists idx_customers_whatsapp on customers (whatsapp);
create index if not exists idx_customers_segment  on customers using gin (segment);

-- ── products ─────────────────────────────────────────────────────────
create table if not exists products (
  id                 uuid primary key default gen_random_uuid(),
  chariow_product_id text unique,
  name               text,
  slug               text,
  price              numeric(14,2),                   -- FCFA
  checkout_ref       text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── sales ────────────────────────────────────────────────────────────
create table if not exists sales (
  id              uuid primary key default gen_random_uuid(),
  chariow_sale_id text not null unique,               -- idempotence webhooks
  customer_id     uuid references customers(id) on delete set null,
  product_ref     text,
  amount          numeric(14,2),                      -- FCFA
  status          sale_status not null,
  occurred_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_sales_customer_id on sales (customer_id);
create index if not exists idx_sales_status      on sales (status);

-- ── sequences ────────────────────────────────────────────────────────
create table if not exists sequences (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  trigger    sequence_trigger not null,
  steps      jsonb not null default '[]'::jsonb,       -- [{channel, delay_hours, template_key}]
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── sequence_runs (LE CŒUR) ──────────────────────────────────────────
create table if not exists sequence_runs (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id) on delete cascade,
  sequence_id  uuid not null references sequences(id) on delete cascade,
  current_step int not null default 0,
  status       run_status not null default 'pending',
  next_due_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- Index clé pour le scheduler (Phase 3) : runs dus à traiter.
create index if not exists idx_runs_due         on sequence_runs (status, next_due_at);
create index if not exists idx_runs_customer_id on sequence_runs (customer_id);
create index if not exists idx_runs_sequence_id on sequence_runs (sequence_id);

-- ── message_logs ─────────────────────────────────────────────────────
create table if not exists message_logs (
  id                  uuid primary key default gen_random_uuid(),
  sequence_run_id     uuid references sequence_runs(id) on delete set null,
  channel             message_channel not null,
  recipient           text,
  template_key        text,
  provider_status     text,
  provider_message_id text,
  raw_response        jsonb,
  sent_at             timestamptz not null default now(),
  created_at          timestamptz not null default now()
);
create index if not exists idx_logs_run_id  on message_logs (sequence_run_id);
create index if not exists idx_logs_sent_at on message_logs (sent_at);

-- ── Triggers updated_at ──────────────────────────────────────────────
drop trigger if exists trg_customers_updated     on customers;
create trigger trg_customers_updated     before update on customers     for each row execute function set_updated_at();
drop trigger if exists trg_products_updated      on products;
create trigger trg_products_updated      before update on products      for each row execute function set_updated_at();
drop trigger if exists trg_sales_updated         on sales;
create trigger trg_sales_updated         before update on sales         for each row execute function set_updated_at();
drop trigger if exists trg_sequences_updated     on sequences;
create trigger trg_sequences_updated     before update on sequences     for each row execute function set_updated_at();
drop trigger if exists trg_sequence_runs_updated on sequence_runs;
create trigger trg_sequence_runs_updated before update on sequence_runs for each row execute function set_updated_at();

-- ── RLS : activer partout, aucune policy (deny-all sauf clé admin) ────
alter table customers     enable row level security;
alter table products      enable row level security;
alter table sales         enable row level security;
alter table sequences     enable row level security;
alter table sequence_runs enable row level security;
alter table message_logs  enable row level security;
