# ADR-0027 — CSP Model Evolution

- Status: Proposed
- Date: 2026-06-02
- Deciders: TBD (architecture + security review)
- Supersedes: —
- Superseded by: —
- Related: ADR-0007 (ISR target), ADR-0013 (CSP × ISR debt), ADR-0024 (photo transform), ADR-0025 (editorial-first / gel booking), ADR-0026 (rendering strategy — Proposed, conditionnée par cette ADR)

> **Préalable amont d'ADR-0026.** Le spike Vague G-1bis a montré que les trois
> options de _rendu_ d'ADR-0026 (α PPR / β script-src-attr / γ force-dynamic)
> sont en réalité **conditionnées par le modèle CSP**. Cette ADR tranche le
> modèle CSP en premier ; ADR-0026 en découle mécaniquement. Tant que cette ADR
> reste `Proposed`, ADR-0026 ne peut pas passer en `Accepted`.

## Context

Le spike Vague G-1bis (PR #122, `docs/audits/2026-06-02-spike-cache-components-poc.md`)
a démontré que l'option α d'ADR-0026 (Next 16 Cache Components / PPR) **n'est pas
viable sous le modèle CSP actuel** (`script-src 'self' 'nonce-{n}' 'strict-dynamic'`,
nonce par requête, sans `'unsafe-inline'`).

Raisonnement déductif consolidé en main :

1. Tout script inline (JSON-LD per-page, bootstrap d'hydratation Next.js
   `self.__next_f.push`) exige le nonce frais par requête.
2. Next 16 interdit `headers()` à l'intérieur de `'use cache'` → un shell caché
   ne peut littéralement pas lire le nonce.
3. Un chunk pré-rendu / partagé entre requêtes ne peut pas embarquer un nonce frais.
4. Conclusion : shell caché ⇒ scripts framework sans nonce frais ⇒ navigateur
   refuse ⇒ hydratation cassée (= bug PR #57, déjà documenté dans `json-ld.tsx`).

Par symétrie, l'option γ d'ADR-0026 (`force-dynamic` optimisé + cache CDN `s-maxage`)
**fige le nonce au niveau du CDN** entre requêtes servies par le même cache key →
même piège que α relocalisé au CDN, sécurité dégradée ou scripts bloqués selon
implémentation.

**Constat structurant** : les trois options de rendu d'ADR-0026 (α/β/γ) sont en
réalité **conditionnées par le modèle CSP**. Tant que le modèle CSP reste
`nonce per-request strict`, aucune ne restaure un cache statique exploitable.
L'option β d'ADR-0026 (`script-src-attr 'unsafe-hashes'`) n'est pas une option
de rendu : c'est en réalité **un changement de modèle CSP**. D'où la nécessité
de cette ADR amont.

Cette ADR isole donc **la seule variable qui pilote tout le reste** : le modèle
CSP des scripts. ADR-0013 avait posé le nonce par requête comme défaut ;
l'inventaire G-1 a écarté le hash build-time pur ; le spike G-1bis a écarté PPR
sous nonce. Le choix résiduel est entre trois familles de modèle CSP décrites
ci-dessous.

## Decision drivers

- **D1** — Honorer ADR-0007 (ISR `revalidate = 3600`) ou l'amender explicitement.
- **D2** — Sécurité CSP : refus de `'unsafe-inline'` sur `script-src` (hard rule `security-csp.mdc`), maintenir une posture XSS forte.
- **D3** — Compatibilité Next.js 16 (RSC streaming, Cache Components, hydratation `self.__next_f.push`).
- **D4** — Coût maintenance long terme (hashes recalculés à chaque build/release Next vs nonce auto-géré par le framework).
- **D5** — Coût infrastructure (Fluid Compute permanent vs cache CDN/edge).
- **D6** — Surface d'attaque (handlers inline autorisés vs interdits).
- **D7** — Réversibilité du choix.
- **D8** — Alignement avec l'écosystème Next.js (direction officielle vs hack maison).

## Considered options

### Option CSP-α — Maintenir `nonce` per-request (statu quo)

Garder `script-src 'self' 'nonce-{n}' 'strict-dynamic'`. Accepter que les fiches
hôtels restent en `force-dynamic` permanent. **Amender ADR-0007** pour acter
qu'ISR effectif passe par cache CDN (`s-maxage` + `stale-while-revalidate`),
pas par runtime Next.js statique.

**Pros**

- Zéro refactor, prod stable.
- Sécurité CSP maximale (nonce par requête = anti-replay natif).
- Compatible Next.js sans flag expérimental.
- Hydratation native, aucun risque régression.

**Cons**

- ADR-0007 doit être amendée (dette de gouvernance assumée).
- Coût Fluid Compute récurrent (à chiffrer mensuellement).
- Cache hit CDN dépend de la stratégie de clés (vary headers, géoloc, locale).
- Note Vague F « transitoire » devient « permanent justifié » → Vague F-bis MDC.
- ⚠️ Le cache CDN `s-maxage` doit cacher **la réponse ET son header CSP ensemble** ; si le proxy régénère un nonce pour une réponse servie du cache, le nonce du HTML caché et celui du header divergent → bug PR #57 au niveau CDN. Un cache CDN sûr impose donc de **ne pas** réémettre de nonce sur les hits de cache (donc pas de cache de la page complète tant que le HTML embarque un nonce).

**Effort estimé** : 1–2 j.h (tuning cache headers + amendement ADR-0007) + audit coût.

### Option CSP-β — `script-src-attr 'unsafe-hashes'` + hashes handlers inline

Migrer vers une CSP autorisant les event handlers inline via `'unsafe-hashes'` +
liste de hashes SHA-256 connus. Permet le retour à un rendu ISR/PPR sans nonce
par requête sur les scripts framework (le nonce n'est plus la clé d'exécution).

**Pros**

- Débloque ADR-0026 option α (Cache Components / PPR viables).
- Aligne ADR-0007 (ISR runtime, pas seulement CDN).
- Compatible Next.js stable, pas de flag expérimental.
- Réversible (toggle CSP via flag).

**Cons**

- `'unsafe-hashes'` affaiblit la CSP (autorise les event handlers inline) — **revue sécu obligatoire** + amendement `security-csp.mdc`.
- Maintenance des hashes : recalcul à chaque release Next.js (le bootstrap `self.__next_f.push` change de forme entre versions).
- JSON-LD per-page : payload variable → externalisation ou pré-calcul requis (≈ 2219 fiches).
- Surface d'attaque XSS élargie sur les handlers inline.

**Effort estimé** : 3–5 j.h (CSP + outillage hash-check au build) + 1 semaine surveillance preview + revue sécu.

### Option CSP-γ — `'strict-dynamic'` sans nonce, zéro script inline

Modèle CSP : `script-src 'self' 'strict-dynamic' 'sha256-<root-hash>'` où seuls
les root scripts externes (`<script src="…">`) portent un hash/integrity ;
`'strict-dynamic'` propage la confiance aux scripts qu'ils chargent. **Tous les
scripts inline sont éliminés ou externalisés** : JSON-LD servi via une route
dédiée (`<script src="…/jsonld">` ou endpoint paramétré), aucun handler inline.

**Pros**

- Pas de nonce → **compatible cache statique / ISR / PPR** (le hash de root est stable au build, pas par requête).
- Sécurité forte (ni `'unsafe-inline'`, ni `'unsafe-hashes'`).
- Aligné CSP3 moderne (`'strict-dynamic'` + hash de root).

**Cons**

- ❌ **Obstacle dur** : le bootstrap d'hydratation Next.js est un `<script>` **inline** (`self.__next_f.push`) généré par le framework, non externalisable sans patcher Next, et son contenu varie par page (payload RSC) → son hash n'est pas stable. C'est exactement le mur de l'inventaire G-1.
- JSON-LD per-page doit être externalisé (route par fiche ou endpoint) → perte de la co-location, surcoût SEO/maintenance, requêtes réseau supplémentaires.
- Next.js 16 ne propose pas de mode « no-inline-bootstrap » natif → nécessiterait un hack/patch (dette infinie, cf. ADR-0026 §Alternatives rejected).

**Effort estimé** : élevé (probablement non-démarreur sur Next 16 RSC streaming sans patch framework) — à confirmer par un spike dédié avant tout engagement.

## Decision

**TBD** — cette ADR est en statut `Proposed`. Le modèle CSP sera tranché lors de
la revue d'architecture **+ sécurité** (le choix engage la posture XSS du site),
après chiffrage des trois familles. ADR-0026 (rendu) reste bloquée en `Proposed`
jusqu'à cette décision.

### Critères de tranche (à valider en revue)

| Critère                             | CSP-α nonce (statu quo) | CSP-β unsafe-hashes      | CSP-γ strict-dynamic no-inline |
| ----------------------------------- | ----------------------- | ------------------------ | ------------------------------ |
| Débloque cache statique/ISR         | ❌ (force-dynamic)      | ✅                       | ✅ en théorie                  |
| Préserve CSP stricte                | ✅ (max)                | ⚠️ (handlers inline)     | ✅                             |
| Compatible Next 16 hydratation      | ✅                      | ✅                       | ❌ (bootstrap inline)          |
| Honore ADR-0007 (ISR runtime)       | ⚠️ (amende → CDN)       | ✅                       | ✅ si faisable                 |
| Maintenance long terme              | bonne (nonce auto)      | moyenne (hashes/release) | mauvaise (patch framework)     |
| Surface d'attaque XSS               | minimale                | élargie (handlers)       | minimale                       |
| Effort j.h                          | 1–2                     | 3–5                      | élevé / non-démarreur          |
| Réversibilité                       | excellente              | bonne (flag)             | faible                         |
| Quelles options ADR-0026 débloquées | γ uniquement            | α et β                   | α (si γ faisable)              |

## Consequences

### Si CSP-α retenue (maintenir le nonce)

- ADR-0026 se résout sur **γ** (force-dynamic) — les options α/β d'ADR-0026 deviennent caduques.
- ADR-0007 **amendée** : « ISR effectif via cache CDN, pas via runtime statique Next.js », avec la contrainte « pas de nonce réémis sur les hits CDN ».
- Vague G clôturée sans G-2/G-3 ; Vague F-bis (doc) requalifie `force-dynamic` de « transitoire » à « permanent justifié ».
- Runbook : audit coût Fluid Compute mensuel.

### Si CSP-β retenue (unsafe-hashes)

- ADR-0026 se résout sur **α (PPR)** ou **β** — au choix selon l'effort.
- Amendement `security-csp.mdc` pour autoriser `'unsafe-hashes'` (**revue sécu obligatoire**, traçée).
- ADR-0007 confirmée (ISR runtime atteint).
- Vague G-2 : « Migration modèle CSP + retour ISR/PPR » + outillage hash-check au build (hashes du bootstrap Next régénérés à chaque release).

### Si CSP-γ retenue (strict-dynamic no-inline)

- Pré-requis **bloquant** : un spike dédié doit d'abord prouver qu'on peut éliminer/hasher le bootstrap inline Next.js sans patcher le framework. Sans cette preuve, γ reste théorique.
- ADR-0026 se résout sur **α (PPR)**.
- JSON-LD externalisé : nouvelle route + impact SEO à valider (le JSON-LD doit rester crawlable dans le HTML servi).

## Alternatives rejected

- **Hash build-time pur du HTML complet** (option B d'ADR-0013) : rejeté par ADR-0013, confirmé par l'inventaire G-1 (payload RSC variable par page, aucun octet fixe hashable).
- **`'unsafe-inline'` sur `script-src`** : interdit par `security-csp.mdc` (hard rule, non négociable).
- **Désactiver l'hydratation React** : non-démarreur, casse l'interactivité.
- **Self-hosting / patch de Next.js** pour externaliser le bootstrap : effort prohibitif, dette infinie (déjà rejeté en ADR-0026).
- **Trancher ADR-0026 (rendu) avant le modèle CSP** : inversion de dépendance — le spike G-1bis prouve que le rendu est subordonné au modèle CSP.

## References

- ADR-0007 — ISR target for hotel pages
- ADR-0013 — CSP × ISR debt (a posé le nonce per-request, déféra le choix final)
- ADR-0024 — Photo transform pipeline
- ADR-0025 — Editorial-first / gel booking
- ADR-0026 — Rendering strategy (Proposed, conditionnée par cette ADR)
- `docs/audits/2026-06-02-spike-cache-components-poc.md` — spike G-1bis (verdict α non viable sous nonce)
- `docs/audits/2026-06-02-vague-g1-inline-inventory.md` — inventaire CSP G-1
- `.cursor/rules/security-csp.mdc` — hard rule CSP (`script-src` nonce + strict-dynamic, jamais `'unsafe-inline'`)
- Next.js docs — Cache Components / `use cache` (contrainte `headers()` interdite)
- MDN — CSP `'strict-dynamic'`, `'unsafe-hashes'`, `script-src-attr`
