# Cluster 4 — Fonctionnalités métier · Authentification & Sécurité · Cohérence design

> Audit pré-production MyConciergeHotel.com — `apps/web` (Next.js 16 App Router,
> Supabase auth + RBAC). **Read-only** : aucune modification code/DB, aucun commit.
> Date : 2026-06-23. Phase projet : éditorial-only (Phase 6 booking gelée).
>
> Légende sévérité : 🔴 bloquant / exposition · 🟠 majeur · 🟡 mineur · 🔵 amélioration.
>
> Rappel de périmètre : l'absence de prix / disponibilité (Amadeus, Little, GDS)
> est **gelée Phase 6** et n'est PAS comptée comme bug (AGENTS.md §4ter).

---

## Synthèse exécutive

- **Aucune exposition de sécurité 🔴.** Patterns solides : Zod aux frontières,
  rate-limit Upstash, honeypot, CSRF natif Server Actions, nonce CSP par requête,
  zéro secret/PII côté client, garde de session sur toutes les pages `/compte/*`.
- Les funnels critiques **fonctionnent** : contact, adhésion Club / waitlist
  Prestige, auth (connexion/inscription/reset), demande de réservation concierge
  sur fiche hôtel (`/reservation/start`), suggest de recherche.
- Deux écarts métier réels : **la newsletter est un placeholder désactivé** (la
  fonctionnalité annoncée ne marche pas) et **WhatsApp n'existe que comme copy
  marketing** (aucune intégration click-to-chat).
- Design cohérent (palette crème/taupe, logo MC homogène header/footer, icônes
  100 % SVG inline) mais **double système de tokens** maintenu à la main.

---

## 5. MÉTIER — Fonctionnalités

### ✅ Contact (`/le-concierge/contact`)

`apps/web/src/app/[locale]/le-concierge/contact/page.tsx` +
`apps/web/src/server/contact/contact-request.ts`.

Formulaire **live, conforme et complet** : Server Action en progressive
enhancement, validation Zod (`ContactRequestSchema` : name/email/subject/message

- longueurs bornées), honeypot `website` (champ hors flux + `tabIndex=-1`, traité
  en faux-succès), double rate-limit Upstash (IP + email), idempotency Redis 24 h,
  ref `CR-YYYYMMDD-XXXXX`, insert Supabase service-role, emails Brevo (accusé invité
- relais ops via `Promise.allSettled`), et 3 bannières de feedback
  (`sent` / `rate_limited` / `error`) avec `role="status"`/`role="alert"`. RAS.

### 🟠 Newsletter désactivée — fonctionnalité annoncée non fonctionnelle

**Page/Fichier** : `apps/web/src/app/[locale]/le-concierge/newsletter/page.tsx`
(L208-243).
**Problème** : le formulaire d'inscription newsletter est un **placeholder
entièrement désactivé** : `<input disabled>`, `<input type="checkbox" disabled>`,
`<button type="button" disabled>` + disclaimer « WIP ». L'intégration Brevo
double opt-in n'est pas câblée.
**Impact** : un visiteur qui atterrit sur la page newsletter (lien footer + page
institutionnelle indexable) ne peut **pas** s'abonner. Une surface de capture de
leads présentée comme active est inerte — frustration + perte de conversion +
incohérence avec la promesse éditoriale de la page.
**Recommandation** : soit câbler le double opt-in Brevo (le seam contact prouve
que la stack email est prête — réutiliser `sendBrevoTransactionalEmail` + une
table `newsletter_subscribers`), soit, à défaut court terme, remplacer le faux
formulaire par un CTA explicite vers le formulaire de contact / un message clair
« inscription bientôt disponible » au lieu d'inputs grisés trompeurs.

### ✅ Club & waitlist Prestige (`/le-concierge-club`)

`apps/web/src/app/[locale]/le-concierge-club/page.tsx` + `joinPrestigeWaitlistAction`.

Server Action fonctionnelle, 3 états gérés (anonyme → CTA vers
`/compte/rejoindre?next=…` ; connecté hors-liste → form submit ; déjà inscrit →
notice), redirections avec flags `joined=1` / `err=1` / `gated=1` et bannières
`role="status"`/`role="alert"`. JSON-LD `MemberProgram` sans `priceSpecification`
(volontaire, Phase 6). RAS.

### ✅ Authentification (connexion / inscription / reset)

`apps/web/src/app/[locale]/compte/connexion/page.tsx` (+ `inscription`,
`mot-de-passe-oublie`, `nouveau-mot-de-passe`).

Server Actions (`signInAction` …), inputs requis + `minLength`, `autoComplete`
correct, bannières d'erreur i18n pilotées par un set d'`error` whitelistés
(`invalid_credentials`, `rate_limited`, `email_not_confirmed`…), redirection si
déjà connecté, propagation `?next=`. RAS.

### ✅ Fiche hôtel — CTA « Réserver via le Concierge »

`booking-slot.tsx` → `booking-concierge-rail.tsx` → `/reservation/start`.

Pour les hôtels publiés en `display_only` / `email` (la quasi-totalité du
catalogue), le rail de réservation rend un **funnel concierge fonctionnel** :
form de demande de devis (nom/email/tél requis, message), Server Action
`submitEmailBookingRequest` (Zod + rate-limit + idempotency + Brevo), page de
confirmation `/reservation/confirmation/[ref]`. C'est le chemin Phase-1 attendu
(éditorial, sans GDS) — il marche. La page est `noindex` (normal). RAS.

### 🟡 Slot de réservation « coming soon » sans CTA de repli

**Page/Fichier** : `apps/web/src/components/hotel/booking-coming-soon.tsx`
(L92-99) + dispatch `booking-slot.tsx` (L117-124).
**Problème** : quand un hôtel publié n'a **ni** `display_only` **ni** `email`
(ni mode supplier), le slot de conversion principal rend un bouton **désactivé**
(`disabled`, `aria-disabled`) sans aucun lien. Aucun repli vers
`/le-concierge/contact` ou `/le-concierge/reserver`.
**Impact** : sur ces fiches-là (cas-limite : la plupart sont `display_only`),
le slot le plus converti de la page est un cul-de-sac. AGENTS.md §4ter demande
de conserver un CTA éditorial vers le flux statique dans ce placeholder.
**Recommandation** : ajouter dans `BookingComingSoon` un lien secondaire vers
`/le-concierge/contact` (ou `/le-concierge/reserver`) pour que le slot ne soit
jamais un dead-end ; vérifier en base le nombre de fiches publiées avec
`booking_mode` NULL/non-concierge pour calibrer la priorité.

### 🟡 WhatsApp Business — aucune intégration, uniquement du copy

**Page/Fichier** : `apps/web/src/i18n/messages/{fr,en}.json` (clés
`whatsapp_concierge_24_7`, L4425+) ; aucune occurrence de `wa.me` /
click-to-chat dans `apps/web/src`.
**Problème** : « Concierge WhatsApp 24/7 » n'apparaît **que** comme bénéfice
marketing du Club. Il n'existe **aucun** bouton/lien WhatsApp fonctionnel — ni
sur la page contact (qui ne liste que téléphone + email), ni sur la fiche hôtel,
ni ailleurs.
**Impact** : promesse d'un canal « 24/7 » sans surface réelle. Le copy précise
« à partir de la Phase 6 » dans certains passages mais pas tous (ex. titre
`whatsapp_concierge_24_7.title` = « Concierge WhatsApp 24/7 » sec). Risque de
revendication de disponibilité trompeuse (DGCCRF) tant que le canal n'existe pas.
**Recommandation** : soit ajouter un vrai lien `https://wa.me/<numéro>` (canal
Business) sur la page contact + en option fiche hôtel, soit harmoniser le copy
pour cadrer explicitement WhatsApp comme avantage **futur** (« dès la Phase 6 »)
partout où il est mentionné.

### ✅ Recherche / suggest (`/api/search/suggest`)

Validation Zod (`q` 1-80, `locale`, limites), rate-limit IP 60/min (`gateSuggestByIp`,
degrade-open), clé Algolia **search-only**, hrefs locale-aware, aucune PII loggée,
échecs → tableaux vides (pas de 500). RAS.
**🔵 Mineur** : `QuerySchema` déclare `countries` (L23) mais le `safeParse`
(L93-98) ne lit jamais `searchParams.get('countries')` → la valeur reste toujours
au défaut (3). Sans impact fonctionnel ; à nettoyer pour la cohérence.

### ✅ / 🟡 Pages d'erreur

- ✅ `[locale]/error.tsx` : `'use client'`, `Sentry.captureException`,
  `console.error` **dev-only**, bouton `reset()` (cible 44px). RAS.
- ✅ `global-error.tsx` : `<html>/<body>` autonomes, Sentry capture, copy FR
  (dernier recours acceptable). RAS.
- 🟡 **`[locale]/not-found.tsx` (L15)** : le libellé du lien retour
  `←&nbsp;Retour à l'accueil` est **hardcodé en français** alors que titre et
  description passent par i18n (`t('notFoundTitle')` …). Sur `/en`, le 404
  affiche un CTA en français. Viole la hard-rule AGENTS §6 (i18n, pas de string
  en dur). **Recommandation** : remplacer par une clé `errors.backHome`.

---

## 6. AUTH / SÉCURITÉ

### ✅ Routes protégées `/compte/*`

`compte/page.tsx`, `compte/favoris/page.tsx` : garde page-level via
`getOptionalUser()` → `redirect({ href: '/compte/connexion', query: { next } })`
si non authentifié. Toutes les pages compte sont `force-dynamic` +
`robots: { index:false, follow:false }`. La page connexion redirige vers
`/compte` si déjà connecté. RAS.

### ✅ Gating par rôle / tier

`server/auth/require-user.ts` : `requireUser({ minTier:'prestige' })` redirige les
non-Prestige vers `/le-concierge-club?gated=1`. Le tier est résolu **serveur**
depuis `loyalty_members` (`getLoyaltyMember`), jamais lu côté client. Pas de
surface admin dans `apps/web` (l'admin = `apps/admin` Payload). RAS.

### ✅ Secrets & logs côté client

- **0** occurrence de `process.env` dans `apps/web/src/components`.
- **0** lecture de secret non-public en composant client ; secrets lus uniquement
  via `@/lib/env` / `@mch/config/env` (serveur).
- **0** `console.log` en composant. Le seul `console.info`
  (`server/observability/club-events.ts` L88-91) est **gardé `NODE_ENV !==
'production'`** et ne logue que des identifiants **hachés** (HMAC-SHA256,
  `hashUserId`) — aucune PII ni token.
- CSP nonce par requête (`proxy.ts` L52-54), refresh de session Supabase qui
  dégrade proprement si env absent.

### 🔵 Défense en profondeur — pas de garde au niveau proxy

**Fichier** : `apps/web/src/proxy.ts` + `lib/supabase/middleware.ts`.
**Problème** : le middleware ne fait **que** rafraîchir la session — il ne garde
**aucune** route. La protection est exclusivement page-level. Aujourd'hui toutes
les pages `/compte/*` appellent la garde, donc c'est correct ; mais une future
page `/compte/*` qui oublierait l'appel serait servie sans protection (pas de
filet de sécurité au bord réseau).
**Impact** : faible aujourd'hui, mais fragile à la maintenance.
**Recommandation** : factoriser un guard partagé (layout `compte/layout.tsx`
appelant `requireUser`, ou check `pathname.startsWith('/compte')` dans le proxy)
pour garantir la protection même si une page oublie l'appel.

**Aucune exposition 🔴 détectée.**

---

## 7. DESIGN — Cohérence

### 🟡 Double système de tokens (drift risk)

**Fichiers** : `packages/ui/src/tokens.css` (namespace `--color-*`, DS global) et
`apps/web/src/styles/kit.css` (namespace `--noir` / `--or` / `--creme` /
`--accent`, scopé `.mch-kit`).
**Problème** : la **même** palette est dupliquée dans deux namespaces, maintenue
en phase **à la main** via commentaires (les deux fixent l'accent à `#6f5f3c`,
crème `#f6f1e7`, charcoal/noir `#3a352d`).
**Impact** : tout changement de palette doit être répliqué dans 2 fichiers ;
oubli = divergence visuelle entre le DS et le kit. Fonctionnel aujourd'hui
(valeurs alignées), mais source de bug futur.
**Recommandation** : faire dériver les variables du kit (`--noir`, `--or`,
`--creme`…) des tokens DS (`var(--color-charcoal)` etc.) pour une seule source
de vérité, ou documenter un test de parité.

### 🔵 Artefacts d'encodage dans `tokens.css`

**Fichier** : `packages/ui/src/tokens.css` (commentaires : `ÔÇö`, `cr├¿me`, `├ù`).
**Problème** : commentaires sauvegardés avec un mauvais encodage (mojibake).
Purement cosmétique (commentaires uniquement, aucune valeur affectée).
**Recommandation** : re-sauvegarder le fichier en UTF-8.

### ✅ Icônes — cohérence parfaite

Aucune lib d'icônes tierce importée (lucide-react / heroicons / react-icons /
tabler = 0 import). Toutes les icônes sont des **SVG inline**. Aucun set mixte.

### ✅ Logo — homogène

Header (`site-header.tsx` L78-80) et footer (`site-footer.tsx` L86-89) utilisent
le **même** monogramme `M<span class="text-gold-700">C</span>` (serif,
`text-primary-heritage`). Cohérent.

### ✅ Palette — pas de système ancien résiduel

DA crème/taupe appliquée via tokens ; contrastes WCAG AA délibérément ajustés
(accent assombri `#8c7b5a → #6f5f3c` pour 4.5:1). L'ancien gold `#c9a96e` est
documenté comme remplacé (commentaires tokens). Pas de palette obsolète active.

---

## Score Fonctionnel /10 : **7,5**

Les funnels critiques (contact, Club/waitlist, auth, demande concierge fiche
hôtel, suggest) sont fonctionnels, validés et robustes. Pénalités : newsletter
désactivée alors qu'annoncée (🟠), WhatsApp absent malgré la promesse « 24/7 »
(🟡), 404 non localisé (🟡), slot booking « coming soon » sans CTA de repli (🟡).
Ce sont des écarts de **complétude/promesse**, pas de cassure des parcours
principaux.

## Score Sécurité /10 : **8,5**

Aucune exposition 🔴. Tous les bons patterns sont en place : Zod aux frontières,
honeypot + double rate-limit + idempotency sur les Server Actions publiques,
CSRF natif non désactivé, nonce CSP par requête, zéro secret/PII côté client,
zéro `console.log` de token (le seul log est dev-only + ID haché), gardes de
session + gating tier serveur sur toutes les surfaces privées. Seule réserve :
absence de défense en profondeur au niveau proxy (protection 100 % page-level →
fragile à la maintenance, 🔵).

## Score Design /10 : **8,0**

Charte cohérente et bien tenue (palette crème/taupe unique, logo MC identique
header/footer, icônes 100 % SVG inline, contrastes AA ajustés, pas de palette
ancienne active). Pénalités : double système de tokens DS vs kit maintenu
manuellement (drift risk, 🟡) et artefacts d'encodage dans `tokens.css` (🔵).
