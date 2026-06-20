# FunnelBoss — Contrôle de sécurité

Audit réalisé le 2026-06-19. État par point :

| # | Contrôle | État | Détail |
|---|----------|------|--------|
| 1 | Clés API hors code | ✅ | Secrets serveur dans `.env.local` + env Vercel ; clés providers dans la table `app_settings` (RLS deny-all). Jamais de secret côté client. |
| 2 | `.env.local` gitignored | ✅ | `.gitignore` couvre `.env*.local` ; scan : aucun secret dans le repo. |
| 3 | RLS activé sur toutes les tables | ✅ | Les 10 tables ont `rowsecurity = true`. |
| 4 | Politique RLS | ✅ (deny-all) | RLS activé **sans policy** = refus total pour la clé anon (publique). Tout l'accès passe par les routes serveur avec la **clé admin** (qui bypass RLS). Aucune table n'est exposée à la clé anon. |
| 5 | Validation côté serveur | ✅ | Token webhook vérifié, signature Wasender vérifiée, clés de réglages **whitelistées** (`SETTING_KEYS`), segments validés, longueur mot de passe ≥ 8, JSON parsé en try/catch. |
| 6 | npm audit | ✅ (durci) | Montée **Next.js 14 → 15** : 4 vulnérabilités hautes + 1 modérée éliminées. Restent 2 modérées (postcss, transitif build-time, non exploitables à l'exécution). |
| 7 | Middleware d'authentification | ✅ | `middleware.ts` protège `/api/settings*` et `/api/admin*` (session JWT signée obligatoire → 401 sinon). |
| 8 | Vérification par email | N/A | Architecture à **admin unique** (mot de passe haché bcrypt, pas d'inscription d'utilisateurs) → pas de flux d'email à vérifier. |
| 9 | Rate limiting | ✅ | Fonction PG atomique `rate_hit` (fenêtre fixe, fail-open) sur `/api/webhooks/*` (60/60s/IP) **et `/api/auth/login` + `/api/auth/setup`** (5/5min/IP, anti-brute-force). |

## Posture générale
- **Modèle d'accès** : tout l'accès aux données se fait côté serveur avec la clé admin Insforge. La clé anon (publique, `NEXT_PUBLIC_`) n'est utilisée nulle part côté client et serait de toute façon bloquée par le RLS deny-all.
- **Auth admin** : mot de passe haché bcrypt (coût 10), session JWT HS256 signée (`AUTH_SECRET`), cookie httpOnly + secure + sameSite=lax, expiration 7 jours.
- **Secrets** : `INSFORGE_SERVICE_KEY`, `AUTH_SECRET`, `CRON_SECRET`, `CHARIOW_WEBHOOK_SECRET` en env serveur ; clés providers chiffrables at-rest (durcissement futur).

## Durcissement futur (non bloquant)
- Chiffrement at-rest des clés providers dans `app_settings`.
- 2 vulnérabilités postcss modérées : disparaîtront avec une montée Next ultérieure.
- Monitoring/alerting des 401/429.
