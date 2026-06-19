-- Phase 4a — module Connexions + auth admin.
-- RLS deny-all : accès serveur uniquement (clé admin Insforge, bypass RLS).

-- Compte admin unique (mot de passe haché bcrypt). 1 seule ligne attendue.
create table if not exists admin_account (
  id            uuid primary key default gen_random_uuid(),
  password_hash text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Réglages / clés des intégrations (Wasender, Brevo, Chariow, ...).
-- key = identifiant logique ; value = secret en clair (table verrouillée RLS,
-- jamais renvoyée au navigateur). Chiffrement at-rest = durcissement Phase 6.
create table if not exists app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_admin_account_updated on admin_account;
create trigger trg_admin_account_updated before update on admin_account
  for each row execute function set_updated_at();

drop trigger if exists trg_app_settings_updated on app_settings;
create trigger trg_app_settings_updated before update on app_settings
  for each row execute function set_updated_at();

alter table admin_account enable row level security;
alter table app_settings  enable row level security;
