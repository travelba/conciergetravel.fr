# Bootstrap prompts — browser-automation playbooks

These are copy-paste-ready prompts for browser-automation agents
(Claude Computer Use, Cowork, ChatGPT Operator, OpenAI Atlas, …) that
operate the dashboards a human would have to click through during
project bootstrap or credential rotation.

The Cursor agent **cannot run these prompts itself** because it doesn't
have a browser. The human (maintainer) hands them to a computer-use
agent that does have one.

Each playbook is designed to:

- Be self-sufficient (the browser agent doesn't read the rest of the repo).
- Be precise on selectors (text labels, button names, panel titles).
- Never print secrets — secrets are copied from one tab to another.
- Stop and ask if the UI doesn't match what's described (no hallucination).

Reference: [ADR-0018](../../docs/adr/0018-env-vars-vercel-source-of-truth.md).

---

## Playbook 1 — First-time Vercel env-vars setup (Supabase + Site URL)

Use this prompt when you've just linked the repo to Vercel and need to
populate the 4 essential env vars across the 3 environments. Total
elapsed time: ~10 min.

> **Replace the placeholders** if you fork this for another project:
> the Supabase project ref (`fsmfozxgujskluxakeoq`), the Vercel team
> slug (`travelba`), and the Vercel project name (`myconciergehotel-com`).

```text
TÂCHE — Configurer les 4 variables d'environnement Supabase + Site URL
dans Vercel pour le projet "myconciergehotel-com" sur l'équipe
"travelba".

PRÉREQUIS À VÉRIFIER AVANT DE COMMENCER

1. Je dois être déjà loggué dans Supabase Dashboard (sinon ouvre
   https://supabase.com/dashboard et arrête-toi pour me laisser me
   connecter).
2. Je dois être déjà loggué dans Vercel (sinon ouvre https://vercel.com
   et arrête-toi pour me laisser me connecter).

CONTEXTE

Vercel est la source de vérité unique pour les secrets du projet (cf.
ADR-0018). Je dois ajouter 4 variables d'environnement réparties sur les
3 environnements Vercel (Development, Preview, Production). Trois sont
des clés Supabase, la quatrième est l'URL du site.

NE COMMENTE PAS LE CONTENU DES SECRETS. NE PRINT JAMAIS LE
service_role KEY EN CLAIR DANS TES MESSAGES. Copie-colle uniquement d'un
onglet à l'autre.

===================================================================
PHASE 1 — Récupérer le SUPABASE_SERVICE_ROLE_KEY (depuis Supabase)
===================================================================

1. Ouvre dans un nouvel onglet :
   https://supabase.com/dashboard/project/fsmfozxgujskluxakeoq/settings/api-keys

2. Localise la section "Project API keys". Cherche la ligne dont la
   colonne "name" affiche "service_role" et la colonne "type" affiche
   "secret".

3. Sur cette ligne, clique sur "Reveal" (icône œil) puis "Copy" pour
   copier la valeur dans le presse-papier. Elle commence par "eyJhbGci…"
   et fait environ 250 caractères.

4. STOP — Ne la print pas. Ne l'écris dans aucun message. Garde-la dans
   le presse-papier pour la Phase 2.

5. Si tu vois une bannière "Disable legacy API keys", NE clique PAS
   dessus. On ne migre pas aujourd'hui.

===================================================================
PHASE 2 — Ajouter les 4 variables dans Vercel
===================================================================

Ouvre dans un nouvel onglet :
https://vercel.com/travelba/myconciergehotel-com/settings/environment-variables

Pour chaque variable ci-dessous, fais EXACTEMENT cette séquence :

  a. Si la variable existe déjà avec une valeur vide : clique sur les
     "..." à droite de la ligne, choisis "Edit", colle la valeur, coche
     les 3 environnements (Development, Preview, Production) selon le
     tableau, puis "Save".
  b. Si la variable n'existe pas : clique sur "Add Another" (ou
     "Add New") en haut, remplis le nom et la valeur, coche les
     environnements selon le tableau, puis "Save".
  c. NE coche JAMAIS la case "Sensitive" pour les variables publiques
     (préfixe NEXT_PUBLIC_). Tu peux la cocher pour
     SUPABASE_SERVICE_ROLE_KEY mais ce n'est pas obligatoire aujourd'hui.

VARIABLES À CONFIGURER

  NEXT_PUBLIC_SUPABASE_URL
    Valeur : https://fsmfozxgujskluxakeoq.supabase.co
    Envs   : Development + Preview + Production

  NEXT_PUBLIC_SUPABASE_ANON_KEY
    Valeur : sb_publishable_TRHnIU1dHpQ2SBGrU0AmTQ_mJdkrqxr
    Envs   : Development + Preview + Production

  SUPABASE_SERVICE_ROLE_KEY
    Valeur : [colle depuis le presse-papier — Phase 1, étape 3]
    Envs   : Development + Preview + Production

  NEXT_PUBLIC_SITE_URL (Production)
    Valeur : https://myconciergehotel.com
    Envs   : Production UNIQUEMENT

  NEXT_PUBLIC_SITE_URL (Development)
    Valeur : http://localhost:3000
    Envs   : Development UNIQUEMENT

ATTENTION sur NEXT_PUBLIC_SITE_URL :
- Tu vas créer DEUX entrées distinctes pour cette variable (une pour
  Production, une pour Development). Vercel permet ça parce qu'on coche
  des environnements différents.
- Ne crée AUCUNE valeur pour Preview. C'est volontaire — le code lit
  VERCEL_URL automatiquement injectée par Vercel, et chaque preview
  deploy a sa propre URL dynamique. Hardcoder la prod en Preview cassera
  les liens canonical des PR previews.

===================================================================
PHASE 3 — Validation finale
===================================================================

Reste sur la page Vercel env variables et confirme visuellement :

1. NEXT_PUBLIC_SUPABASE_URL : présente, valeur "Encrypted", envs
   "Development, Preview, Production".
2. NEXT_PUBLIC_SUPABASE_ANON_KEY : idem.
3. SUPABASE_SERVICE_ROLE_KEY : idem.
4. NEXT_PUBLIC_SITE_URL : DEUX lignes — une "Production", une
   "Development". Aucune ligne "Preview" pour cette variable.

Compte le total : on doit avoir AU MOINS 5 lignes ajoutées/modifiées
dans le tableau.

===================================================================
RAPPORT FINAL
===================================================================

Termine ton tour avec un message structuré (sans aucun secret) :

  ✓ Phase 1 — service_role key copiée depuis Supabase dashboard
  ✓ Phase 2 — 5 entrées créées/mises à jour dans Vercel env variables :
      - NEXT_PUBLIC_SUPABASE_URL (Dev/Preview/Prod)
      - NEXT_PUBLIC_SUPABASE_ANON_KEY (Dev/Preview/Prod)
      - SUPABASE_SERVICE_ROLE_KEY (Dev/Preview/Prod)
      - NEXT_PUBLIC_SITE_URL (Production = https://myconciergehotel.com)
      - NEXT_PUBLIC_SITE_URL (Development = http://localhost:3000)
  ✓ Phase 3 — validation visuelle OK

  Tu peux maintenant lancer dans ton terminal :
    pnpm bootstrap:env

Si tu rencontres une étape qui ne correspond pas exactement à ce qui est
décrit (UI Vercel changée, nom de section différent, etc.), ARRÊTE-TOI
et décris-moi précisément ce que tu vois — ne devine pas.
```

---

## Playbook 2 — Rotation d'une seule clé compromise (template)

Use this when a key has been pasted in the wrong place, accidentally
shared, or simply periodically rotated. Replace `{PROVIDER}`, `{KEY_NAME}`,
and the dashboard URLs.

```text
TÂCHE — Rotation d'urgence : la clé {KEY_NAME} doit être révoquée
et remplacée dans Vercel.

PHASE 1 — Révoquer la clé existante
-----------------------------------
1. Ouvre {PROVIDER_DASHBOARD_URL}
2. Localise la clé compromise (préfixe : {KEY_PREFIX}...)
3. Clique sur "Revoke" / "Delete" / "Disable" (selon le provider)
4. Confirme la révocation

PHASE 2 — Générer une nouvelle clé
----------------------------------
1. Sur la même page, clique "Create new key"
2. Nomme-la "{KEY_NAME_2026-MM}" pour traçabilité
3. Configure les scopes/permissions identiques à l'ancienne
4. Copie la nouvelle valeur dans le presse-papier
5. NE LA PRINT JAMAIS

PHASE 3 — Mettre à jour Vercel
------------------------------
1. Ouvre
   https://vercel.com/travelba/myconciergehotel-com/settings/environment-variables
2. Cherche la ligne {KEY_NAME}
3. Clique "..." → "Edit"
4. Remplace la valeur (sélectionne tout + colle)
5. Vérifie que les 3 environnements restent cochés (sauf instruction contraire)
6. "Save"

PHASE 4 — Triggerer un redéploiement
------------------------------------
1. Va sur https://vercel.com/travelba/myconciergehotel-com/deployments
2. Trouve le dernier deployment Production
3. Clique "..." → "Redeploy" → confirme
4. Attends que le build passe (≈ 90 sec) — le redeploy utilise les
   nouvelles env vars.

PHASE 5 — Rapport
-----------------
  ✓ Phase 1 — ancienne clé {KEY_NAME} révoquée chez {PROVIDER}
  ✓ Phase 2 — nouvelle clé générée et stockée dans le presse-papier
  ✓ Phase 3 — Vercel env var {KEY_NAME} mise à jour sur 3 envs
  ✓ Phase 4 — redeploy production déclenché (status : building/ready)

Demande à l'utilisateur de lancer `pnpm bootstrap:env` pour
propager la nouvelle valeur localement.
```

---

## Playbook 3 — Audit visuel des env vars (read-only)

Use this when you want to verify Vercel state without modifying anything.
Useful before a big release or after suspecting a sync drift.

```text
TÂCHE — Audit read-only des env vars Vercel pour
myconciergehotel-com / travelba.

1. Ouvre
   https://vercel.com/travelba/myconciergehotel-com/settings/environment-variables

2. Compte le nombre total de lignes dans le tableau.

3. Pour chaque variable, note dans un tableau Markdown :
   - Nom
   - Type (Standard | Sensitive)
   - Environnements (Dev / Preview / Prod)
   - "Encrypted" oui/non
   - Last updated (date)

4. Identifie les anomalies :
   - Variables avec valeur "(empty)" → à fixer
   - Variables présentes dans seulement 1 ou 2 envs (sauf NEXT_PUBLIC_SITE_URL
     qui DOIT être absente en Preview)
   - Variables non documentées dans .env.example (à comparer si tu y as accès)

5. NE clique sur AUCUN bouton "..." / "Edit" / "Save" / "Add".
   Read-only strictement.

6. Termine par un rapport :
   - Total : N variables, M environnements couverts
   - Anomalies : [liste ou "aucune"]
   - Recommandations : [liste ou "aucune"]
```

---

## Pourquoi capitaliser ces prompts dans le repo

1. **Reproductibilité** : la rotation d'une clé tous les 6 mois ne doit pas
   réinventer le prompt à chaque fois.
2. **Audit log textuel** : le repo Git garde l'historique de qui a fait quoi
   (le prompt amorce, et le rapport final de l'agent vit dans le terminal).
3. **Onboarding** : un nouveau maintainer peut bootstraper son env en
   collant Playbook 1 dans son agent computer-use préféré, sans connaître
   la stack Vercel/Supabase préalablement.
4. **Garde-fous explicites** : "NE PRINT JAMAIS le service_role" est plus
   robuste qu'une convention orale.

## Anti-patterns

- ❌ Coller un secret dans le prompt lui-même (annule l'objectif).
- ❌ Demander à l'agent de "trouver la bonne clé" sans URL exacte — il va
  errer et inventer.
- ❌ Lui demander de "vérifier que tout est en ordre" sans critères
  mesurables — il dira oui même si rien n'est en ordre.
- ❌ Lui dire "fais comme tu veux" — la phase d'instructions explicites est
  ce qui empêche les hallucinations destructrices.
