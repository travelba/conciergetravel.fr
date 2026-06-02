# Spike — Cache Components × CSP nonce × JSON-LD (Vague G-1bis)

- Date : 2026-06-02
- Auteur : agent (spike de faisabilité)
- Branche spike : `spike/g1-cache-components-poc` (JETABLE — **zéro modification de code**, identique à `main`)
- Next.js : **16.2.6** (exact, `pnpm-workspace.yaml` catalog) · React **19.2.6**
- Fiche testée : Airelles Gordes → route dynamique `apps/web/src/app/[locale]/hotel/[slug]/page.tsx`
- Base : `main` post-merge #119 (inventaire G-1) + #120 (ADR-0026)
- Statut : **terminé — verdict par analyse statique** (boucle empirique non exécutée, voir §Méthode)
- Décision rattachée : `docs/adr/0026-csp-rendering-strategy.md` (option α)

---

## Méthode — pourquoi le verdict est déductif et non mesuré

La spec du spike prévoyait une boucle empirique (`pnpm build && pnpm start`,
2 requêtes, lecture `x-nextjs-cache` / nonce / violations CSP). Elle **n'a pas
été exécutée**, pour deux raisons cumulées :

1. **Contradiction de garde-fou (bloquante).** Activer Cache Components
   (`use cache` + PPR) sur Next 16 **exige** `cacheComponents: true` dans
   `next.config.ts` (doc officielle Next : « This replaces the old
   `experimental.ppr` flag »). Sans ce flag, la directive `'use cache'`
   **échoue au build**. Or le garde-fou du spike interdit explicitement de
   toucher `next.config.ts`. Mesurer revenait donc à violer un garde-fou dur.

2. **Verdict déjà déterminé à haute confiance** par (a) le code de la fiche,
   (b) la contrainte documentée de Next 16 sur `use cache`, et (c) un incident
   de production **déjà observé** (PR #57, voir §Preuves). La boucle empirique
   n'aurait fait que **re-démontrer le bug PR #57**.

Le verdict ci-dessous s'appuie donc sur des **faits vérifiables** (lignes de
code, doc éditeur, incidents historiques), pas sur des mesures fabriquées.
Les cellules « mesure » de la matrice sont marquées **Prédit** et non
inventées.

---

## Cartographie (Étape 1 — lecture seule)

| Élément                    | Constat (grounded)                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Composant racine           | `apps/web/src/app/[locale]/hotel/[slug]/page.tsx` (1238 l., RSC pur), route dynamique `[slug]`               |
| Rendu actuel               | `export const dynamic = 'force-dynamic'` (L115), rationale L92-114                                           |
| Lecture nonce              | `const nonce = (await headers()).get('x-nonce') ?? undefined;` (L909)                                        |
| Consommateurs nonce        | ≥ 6 `<JsonLdScript … nonce={nonce} />` (L937-951)                                                            |
| Émission JSON-LD           | `components/seo/json-ld.tsx` → `<script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML=…>` |
| Source du nonce            | `proxy.ts` (génère le nonce par requête) → header `x-nonce` + source CSP `'nonce-…'`                         |
| CSP `script-src`           | `'self' 'nonce-{n}' 'strict-dynamic'` — **pas de `'unsafe-inline'`** (hard rule `security-csp.mdc`)          |
| `next.config.ts`           | **aucun** `cacheComponents` / `ppr` activé                                                                   |
| Îlots dynamiques candidats | `<BookingSlot>` (placeholder gelé ADR-0025), `<TrackPageView>` (analytics)                                   |

---

## Le mécanisme du blocage (raisonnement décisif)

1. CSP prod : `script-src 'self' 'nonce-{n}' 'strict-dynamic'`, **sans
   `'unsafe-inline'`**.
2. **Tout** `<script>` inline doit porter le nonce par-requête, ou le
   navigateur le bloque : notre JSON-LD **et** le bootstrap d'hydratation
   Next (`self.__next_f.push(...)`).
3. Le nonce est **par-requête** (proxy.ts). Un chunk pré-rendu (`use cache` /
   shell PPR statique) est calculé au build ou **partagé entre requêtes** : il
   ne peut pas embarquer un nonce frais par requête.
4. **Contrainte Next 16 documentée** : « _Cannot access `cookies()`,
   `headers()`, or `searchParams` inside `use cache`_ ». Un shell caché **ne
   peut littéralement pas lire le nonce** (`headers().get('x-nonce')`).
5. Conséquence : tout script porteur de nonce est **forcé hors** du shell
   statique, dans le trou dynamique (Suspense) — y compris les scripts
   framework qui hydratent la page.
6. Net : shell caché ⇒ scripts framework sans nonce frais ⇒ navigateur refuse
   ⇒ **hydratation cassée**. C'est **exactement** le bug PR #57.

α **relocalise** le mur identifié en G-1, il ne le supprime pas. Les seules
sorties sont les options **déjà rejetées** : **hash build-time** (rejeté G-1 —
payload RSC variable par page, 2219 fiches) ou **`'unsafe-inline'`** (interdit
par `security-csp.mdc`).

---

## Preuves (incidents historiques déjà au dossier)

Le docstring de `apps/web/src/components/seo/json-ld.tsx` (L19-37) documente
les deux échecs **déjà rencontrés** quand le nonce et le cache se croisent :

- **PR #56** — `headers()` caché dans un RSC feuille ⇒ `DYNAMIC_SERVER_USAGE`
  500 sur la fiche hôtel.
- **PR #57** — HTML silencieusement caché avec `nonce=""` ⇒ le navigateur
  **refuse d'exécuter** les scripts (home). C'est la matérialisation exacte du
  point 6 ci-dessus.

La fiche lit donc le nonce **au niveau page** (L909) précisément pour forcer le
rendu dynamique et éviter PR #57. Activer un shell caché ré-ouvre ce bug.

---

## Matrice résultats

> Cellules « mesure » = **Prédit** (analyse statique + doc Next 16 + incidents
> PR #56/#57). Aucune valeur n'est inventée ; la boucle `build/start` n'a pas
> été lancée (garde-fou `next.config.ts`).

| Critère                                             | Cible    | Prédiction R1 | Prédiction R2                                                           | Verdict         |
| --------------------------------------------------- | -------- | ------------- | ----------------------------------------------------------------------- | --------------- |
| Shell cache HIT (R2)                                | HIT      | MISS          | HIT possible **uniquement** si le shell n'embarque aucun script à nonce | ⚠️ conditionnel |
| Nonce frais R1 vs R2 sur un shell caché             | OUI      | n1            | **= n1 (figé)** si HIT, sinon n2                                        | ❌ incompatible |
| Violations CSP (scripts framework)                  | 0        | —             | **> 0** (scripts pré-rendus sans nonce frais bloqués)                   | ❌              |
| Hydratation OK                                      | OUI      | —             | **NON** sur shell caché (cf. PR #57)                                    | ❌              |
| JSON-LD présent dans le shell **avec** nonce valide | OUI      | —             | **NON** (`headers()` interdit dans `use cache`)                         | ❌              |
| TTFB R2                                             | < 200 ms | —             | gain réel **seulement** sur la part statique sans script, marginal ici  | ⚠️              |

Lecture : un shell réellement caché n'est atteignable **qu'en évacuant tous les
scripts à nonce** (framework + JSON-LD) vers le dynamique — ce qui annule le
bénéfice pour les éléments qui comptent (hydratation, JSON-LD), et rouvre PR #57
dès qu'un script à nonce reste dans le shell.

---

## Verdict

- [ ] α viable sans réserve → ADR-0026 → Accepted, écrire Vague G-2.
- [ ] α viable sous conditions `<X, Y>` → ADR-0026 Accepted avec contraintes.
- [x] **α non viable** — raison : **le nonce CSP par-requête est inconciliable
      avec un shell pré-rendu/caché** (les scripts framework `self.__next_f.push`
      et le JSON-LD exigent un nonce frais ; `use cache` interdit `headers()` ;
      CSP refuse `'unsafe-inline'` et le hash a été rejeté en G-1). → **ADR-0026
      reste `Proposed`**, réévaluer **β** (`script-src-attr 'unsafe-hashes'`,
      revue sécu requise) et **γ** (`force-dynamic` permanent optimisé).

---

## Recommandation

Cache Components / PPR (option α) **ne débloque pas l'ISR sur les fiches** tant
que la CSP repose sur un **nonce par-requête** : il déplace le mur G-1 du
build-time hash vers la frontière shell/îlot, sans le franchir. Le seul moyen
de rendre α viable serait de **changer de modèle CSP** (abandonner le nonce pour
`script-src-attr 'unsafe-hashes'` + hashes — option β, qui affaiblit la CSP et
demande une revue sécurité), ou d'accepter `'unsafe-inline'` (exclu par hard
rule). Autrement dit, **α dépend de β** : ce n'est pas une option indépendante.

Compte tenu de la priorité Phase 1 (`AGENTS.md §4bis` : contenu d'abord, infra
ensuite) et du gel booking jusqu'en Phase 6 (ADR-0025), la voie la moins
risquée reste **γ optimisé** (acter `force-dynamic`, amender ADR-0007 en « ISR
effectif via cache CDN », chiffrer le coût Fluid Compute) — **mais attention** :
γ partage le même piège nonce × cache CDN (le `s-maxage` fige le nonce → PR #57
au niveau CDN). γ n'est sûr **que** si le proxy cesse de régénérer le nonce pour
les réponses servies depuis le cache, ce qui revient encore à β/hash. **Le vrai
nœud à trancher en ADR-0026 est donc la stratégie CSP elle-même**, pas la
stratégie de rendu : tant que le nonce par-requête est maintenu, aucune des
trois options ne restaure un cache statique des scripts.

Prochaine étape suggérée : faire de la **décision CSP** (garder nonce vs migrer
vers hashes/`script-src-attr`) le point d'entrée d'ADR-0026, le rendu (ISR/PPR/
force-dynamic) en découlant mécaniquement.

---

## Nettoyage

- Branche `spike/g1-cache-components-poc` : **aucune modification de code**
  (diff vide vs `main`) → supprimée localement après ce constat (rien à
  conserver).
- Ce doc d'audit migre vers `main` via PR séparée (`docs/spike-cache-components-results`).
- `next.config.ts`, `proxy.ts`, `csp.ts`, `app/**` : **non touchés**.
- ADR-0026 : **non touchée** (reste `Proposed`).
