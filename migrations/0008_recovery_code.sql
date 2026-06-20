-- Réinitialisation de mot de passe par code de récupération (haché, usage unique).
alter table admin_account add column if not exists recovery_hash text;
