-- Phase 3 — séquences par défaut. Idempotent (guard par name).

insert into sequences (name, trigger, steps, is_active)
select 'Relance abandon', 'abandoned_sale',
  '[
     {"channel":"whatsapp","delay_hours":0,  "template_key":"abandon_doux"},
     {"channel":"email",   "delay_hours":24, "template_key":"abandon_promo"},
     {"channel":"whatsapp","delay_hours":72, "template_key":"abandon_dernier_rappel"}
   ]'::jsonb,
  true
where not exists (select 1 from sequences where name = 'Relance abandon');

insert into sequences (name, trigger, steps, is_active)
select 'Post-achat', 'successful_sale',
  '[
     {"channel":"whatsapp","delay_hours":0,  "template_key":"merci_achat"},
     {"channel":"email",   "delay_hours":48, "template_key":"upsell"}
   ]'::jsonb,
  true
where not exists (select 1 from sequences where name = 'Post-achat');
