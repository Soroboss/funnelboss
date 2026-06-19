-- Phase 4b — stocker l'URL de checkout de la vente (reprise panier abandonné)
-- pour alimenter la variable {lien_checkout} des templates.
alter table sales add column if not exists checkout_url text;
