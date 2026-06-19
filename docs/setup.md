# Chariow Funnel Engine — Setup

Tunnel de vente + relance automatisée pour la boutique Chariow (bigreussite).

**Stack :** Next.js 14 (App Router, TS) · Insforge (BaaS) · Vercel · GitHub
**Bras d'envoi :** WasenderAPI (WhatsApp) · Brevo (email)

---

## 0. ⚠️ Emplacement du projet — volume externe

Le projet vit sur `/Volumes/DISC D/DEVELOPPEMENT D APPLICATION/FUNNEL` (disque externe).
**Si le volume se démonte, git et le dev server cassent.** Avant toute session :
vérifier que le volume est monté (`ls "/Volumes/DISC D"`). Envisager de déplacer
vers le disque interne (`~/Documents/code`) si des coupures se répètent.

---

## 1. Variables d'environnement

Toutes les variables sont **serveur uniquement** — jamais de secret côté client.

1. Copier le modèle : `cp .env.example .env.local`
2. Remplir les valeurs (voir `.env.example` pour la liste complète).
3. `.env.local` est gitignored. Pour la prod, configurer les mêmes variables
   dans Vercel (Project → Settings → Environment Variables).

Rappels pièges :
- **Brevo** : clé API REST `≠` clé SMTP. Header `api-key` (pas `Authorization`).
- **Insforge** : `INSFORGE_SERVICE_KEY` = clé admin pleine puissance, serveur only.
- **Chariow** : API en lecture seule — toute la mémoire d'état vit dans Insforge.

---

## 2. Authentifier le domaine Brevo (DKIM) — OBLIGATOIRE

Sans authentification de domaine, les emails partent depuis `@brevosend.com`
(mauvaise délivrabilité, spam). Étapes :

1. Brevo → **Settings → Senders, Domains & Dedicated IPs → Domains**.
2. **Add a domain** → saisir le domaine d'envoi (ex. `bigreussite.com`).
3. Brevo génère des enregistrements DNS :
   - **DKIM** : un TXT `mail._domainkey.<domaine>` (clé publique).
   - **DMARC** : un TXT `_dmarc.<domaine>` (politique).
   - **Brevo code** : un TXT de vérification de propriété.
   - (Optionnel SPF) : inclure `include:spf.brevo.com` dans le TXT SPF.
4. Ajouter ces enregistrements chez le registrar/DNS du domaine.
5. Revenir sur Brevo → **Verify / Authenticate**. Attendre la propagation DNS
   (jusqu'à 24–48 h).
6. Vérifier que `BREVO_SENDER_EMAIL` utilise une adresse **sur ce domaine
   authentifié** (ex. `noreply@bigreussite.com`).

Tant que le badge n'est pas vert dans Brevo, ne pas lancer d'envois en volume.

---

## 3. Backend Insforge

- Projet lié via `.insforge/project.json` (NON committé — contient la clé admin).
- Re-lier une machine : `npx @insforge/cli link`.
- Inspecter le backend : `npx @insforge/cli metadata`.
- Migrations schéma : `npx @insforge/cli db migrations up --all`.
- Backup quotidien : fonction edge `backup-daily` + schedule cron (voir Phase 0).

---

## 4. Déploiement

- `npm run build` doit passer en local avant tout déploiement.
- Déploiement Vercel sur push (preview sur PR, prod sur `main`).
- Endpoint de vie : `GET /api/health` → `{ ok: true, timestamp }`.

---

## Phases du projet

0. Fondations & garde-fous  ← (cette base)
1. Modèle de données (schéma Insforge)
2. Ingestion Chariow (pull cron + webhooks)
3. Moteur de séquences
4. Bras d'envoi (Wasender + Brevo)
5. Dashboard
6. Durcissement & prod
