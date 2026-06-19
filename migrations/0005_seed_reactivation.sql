-- Phase 5 — séquence de réactivation manuelle (lancée depuis le dashboard).
insert into sequences (name, trigger, steps, is_active)
select 'Réactivation', 'manual_reactivation',
  '[
     {"channel":"whatsapp","delay_hours":0,  "template_key":"reactivation_whatsapp"},
     {"channel":"email",   "delay_hours":48, "template_key":"reactivation_email"}
   ]'::jsonb,
  true
where not exists (select 1 from sequences where name = 'Réactivation');
