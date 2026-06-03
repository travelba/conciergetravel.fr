# ADR-0027 — Matériel d'aide à la décision (revue archi + sécu)

- Date : 2026-06-02
- Auteur : agent (doc/audit)
- Statut : **aide à la décision** — ne tranche pas, prépare la revue
- ADR concernée : `docs/adr/0027-csp-model-evolution.md` (statut `Proposed`)
- Périmètre : doc-only, lecture seule stricte (aucun code ni ADR modifié)

---

## 1. Synthèse exécutive

ADR-0027 tranche **le modèle CSP des scripts** ; ADR-0026 (stratégie de rendu :
ISR / PPR / force-dynamic) en **découle mécaniquement** — le spike G-1bis
(`docs/audits/2026-06-02-spike-cache-components-poc.md`) a prouvé que le rendu
est subordonné au modèle CSP, pas l'inverse. Tant qu'ADR-0027 reste `Proposed`,
ADR-0026 ne peut pas passer en `Accepted`.

| Modèle CSP                         | Principe                                                        | Verdict global préliminaire                                                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CSP-α** nonce (statu quo)        | `script-src 'self' 'nonce-{n}' 'strict-dynamic'`, force-dynamic | **Viable immédiatement**, sécurité maximale ; mais ISR runtime sacrifié (force-dynamic permanent + coût Fluid Compute) → amende ADR-0007.                                        |
| **CSP-β** `unsafe-hashes`          | `script-src-attr 'unsafe-hashes'` + hashes handlers             | **Débloque ISR/PPR** (options α/β d'ADR-0026) ; mais affaiblit la CSP (handlers inline) → **revue sécu obligatoire** + maintenance hashes par release Next.                      |
| **CSP-γ** strict-dynamic no-inline | `'strict-dynamic'` + hash root, zéro script inline              | **Théoriquement idéal** (sécu + perf) ; mais **bute sur le bootstrap inline Next.js** (`self.__next_f.push`) non externalisable nativement → non-démarreur sans patch framework. |

**Recommandation préliminaire (NEUTRE).** Le choix réel est un arbitrage
**sécurité ↔ coût/perf** entre **CSP-α** et **CSP-β** (CSP-γ est écartée sauf
preuve de faisabilité d'externalisation du bootstrap). Aucun favori n'est
imposé ici :

- Si la **posture sécurité XSS** prime et que le coût Fluid Compute est jugé
  acceptable → CSP-α (zéro refactor, mais chiffrer le coût, §3).
- Si l'**ISR/PPR runtime + le coût CDN** priment et que la revue sécu valide
  `'unsafe-hashes'` → CSP-β (mais surface XSS élargie + maintenance hashes).

La décision **exige** (a) les chiffres de coût CSP-α (§3, aujourd'hui TBD) et
(b) la revue sécu CSP-β (§4). Sans ces deux entrées, trancher serait prématuré.

---

## 2. Tableau comparatif (drivers D1–D8)

Légende : ✅ favorable · ⚠️ réserve · ❌ défavorable. Chaque case = verdict +
justification + source.

| Driver                              | CSP-α nonce (statu quo)                                                                                                                                             | CSP-β unsafe-hashes                                                                                                                                   | CSP-γ strict-dynamic no-inline                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **D1 — ISR alignment** (ADR-0007)   | ❌ force-dynamic permanent ; ISR atteignable **seulement** via cache CDN (amende ADR-0007). _Src : spike G-1bis ; `csp.ts` `getCspNonceOrNull` docstring L155-179._ | ✅ ISR/PPR runtime atteint (le nonce n'est plus la clé d'exécution). _Src : ADR-0026 §β ; ADR-0027 §CSP-β._                                           | ✅ statique → ISR/PPR en théorie. _Src : ADR-0027 §CSP-γ._                                                                               |
| **D2 — Sécurité posture**           | ✅ maximale : nonce par requête + `'strict-dynamic'` (anti-replay natif). _Src : `csp.ts` L103-136 ; `security-csp.mdc` §CSP._                                      | ⚠️ dégradée : `'unsafe-hashes'` autorise les event handlers inline. _Src : MDN CSP `'unsafe-hashes'` ; `security-csp.mdc` (refus `'unsafe-inline'`)._ | ✅ forte : `'strict-dynamic'` + hash root, ni `'unsafe-inline'` ni `'unsafe-hashes'`. _Src : MDN `'strict-dynamic'`._                    |
| **D3 — Compat Next 16 RSC**         | ✅ natif : le framework applique le nonce à ses scripts d'hydratation. _Src : `proxy.ts` L48-54 ; inventaire G-1 §0._                                               | ✅ compatible (ISR stable, aucun flag expérimental). _Src : ADR-0027 §CSP-β._                                                                         | ❌ bute sur le bootstrap inline `self.__next_f.push`, hash variable par page, non externalisable. _Src : inventaire G-1 §1 item 2 + §2._ |
| **D4 — Maintenance hashes**         | ✅ aucune : nonce auto-généré par requête. _Src : `csp.ts` `generateNonce` L142-151._                                                                               | ⚠️ recalcul des hashes à chaque release Next.js (le bootstrap change de forme). _Src : ADR-0026 §β (cons) ; ADR-0027 §CSP-β._                         | ❌ idem β + JSON-LD à externaliser (route par fiche). _Src : ADR-0027 §CSP-γ._                                                           |
| **D5 — Coût infra €/mois**          | ⚠️ Fluid Compute récurrent (chaque requête = invocation, force-dynamic). **Chiffrage TBD — voir §3.** _Src : ADR-0026 §γ ; ADR-0027 §CSP-α._                        | ✅ faible : cache statique/ISR → moins d'invocations runtime. _Src : ADR-0027 §CSP-β._                                                                | ✅ faible : majoritairement statique. _Src : ADR-0027 §CSP-γ._ (mais effort d'impl. élevé, cf. D3)                                       |
| **D6 — Surface XSS**                | ✅ minimale : un script injecté sans le nonce frais est bloqué. _Src : `csp.ts` ; OWASP CSP Cheat Sheet (nonce)._                                                   | ⚠️ élargie : un handler inline injecté qui matche un hash autorisé s'exécute. _Src : MDN `'unsafe-hashes'` ; OWASP CSP Cheat Sheet._                  | ✅ minimale : aucun inline autorisé. _Src : MDN `'strict-dynamic'`._                                                                     |
| **D7 — Réversibilité**              | ✅ excellente : statu quo, rien à défaire. _Src : ADR-0027 §CSP-α._                                                                                                 | ✅ bonne : bascule par flag CSP (cf. `CSP_MODE` envisagé en G-1). _Src : inventaire G-1 §3 ; ADR-0026 §β._                                            | ⚠️ faible : externalisation JSON-LD + refactor difficiles à annuler. _Src : ADR-0027 §CSP-γ._                                            |
| **D8 — Alignement écosystème Next** | ✅ aligné : doc Next recommande le nonce pour une CSP forte (⇒ rendu dynamique). _Src : inventaire G-1 §2._                                                         | ⚠️ hack maison : hasher le bootstrap Next n'est ni documenté ni supporté officiellement. _Src : ADR-0026 §β ; inventaire G-1 §2._                     | ❌ va contre le design Next : le bootstrap inline est by-design. _Src : inventaire G-1 §1-2._                                            |

---

## 3. Estimation coût CSP-α (Fluid Compute, statu quo)

> ⚠️ **Aucun chiffre fabriqué.** La recherche dans le repo (`docs/runbooks/*`,
> `docs/**`, configs Vercel) n'a **pas** livré de baseline de trafic absolu
> (pageviews/mois sur `/hotel/**`). `AGENTS.md` mentionne une répartition GA4
> ~30 % mobile, mais **pas** de volume absolu. Les inputs ci-dessous sont donc
> **TBD** et doivent être fournis par le PO / l'équipe infra.

### Inputs manquants à fournir

| Input                                                      | Unité              | Valeur | Source attendue                          |
| ---------------------------------------------------------- | ------------------ | ------ | ---------------------------------------- |
| `V` — pageviews mensuels sur `/hotel/**`                   | vues/mois          | TBD    | GA4 / Vercel Analytics                   |
| `C` — taux de cache CDN sur réponses dynamiques (s-maxage) | %                  | TBD    | Vercel Analytics (cache hit ratio)       |
| `T` — temps de compute moyen par invocation                | ms (ou GB-s)       | TBD    | Vercel Observability (Function duration) |
| `M` — mémoire allouée par fonction                         | GB                 | TBD    | config Vercel (Fluid Compute)            |
| `P` — tarif Fluid Compute 2026                             | € / GB-h (ou GB-s) | TBD    | grille tarifaire Vercel 2026             |
| `R` — région(s) d'exécution                                | —                  | TBD    | config projet Vercel                     |

### Gabarit de calcul (à remplir une fois les inputs connus)

```
Invocations runtime/mois  = V × (1 − C)
GB-secondes/mois          = Invocations × (T/1000) × M
Coût Fluid Compute/mois   = GB-secondes/mois × P_normalisé
                            (convertir P en €/GB-s si donné en €/GB-h)

Fourchette basse : C = borne haute estimée (ex. 80 %), T = p50
Fourchette haute : C = borne basse estimée (ex. 60 %), T = p95
```

> Tant que `V`, `T`, `M`, `P` ne sont pas fournis, **le coût reste TBD** : on ne
> peut pas comparer D5 entre CSP-α et CSP-β/γ de façon chiffrée. C'est un
> bloquant explicite pour la revue.

---

## 4. Questions sécurité CSP-β (revue sécu obligatoire)

À trancher en revue sécurité **avant** tout choix de CSP-β :

- **Périmètre `'unsafe-hashes'`** : quels handlers inline précis seraient
  autorisés ? (aujourd'hui : **aucun handler inline dans `apps/web/src`** —
  grep `on(click|load|submit|change|error|mouseover)=` → 0 hit ; le besoin
  viendrait uniquement du bootstrap Next, pas du code applicatif.)
- **Inventaire handlers** : confirmer en continu (lint/CI) qu'aucun
  `onclick`/`onsubmit`/`onload` n'apparaît dans le HTML servi (régression
  possible via `dangerouslySetInnerHTML`).
- **Stratégie de hash** : extraction automatique au build (script `csp-hash-check`)
  ou liste manuelle ? L'auto-extraction est obligatoire vu que le bootstrap Next
  change par release.
- **Rotation des hashes** : le bootstrap `self.__next_f.push` change de forme à
  chaque montée de version Next.js → procédure de re-génération + test au build
  (sinon CSP casse l'hydratation après un `pnpm up next`).
- **Impact surface XSS** : un handler injecté dont les octets matchent un hash
  autorisé s'exécuterait — quantifier le risque résiduel (OWASP CSP Cheat Sheet
  déconseille `'unsafe-hashes'` sauf nécessité).
- **Compatibilité SAST/DAST** : les scanners actuels du repo (cf. plugin
  Opsera DevSecOps) flaggent-ils `'unsafe-hashes'` ? Faut-il une exception
  documentée ?
- **Pen-test post-migration** : prévu ? Sur quel périmètre (fiches hôtels +
  pages SEO porteuses de JSON-LD) ?
- **Plan de rollback** : feature flag `CSP_MODE=nonce|hashes` + bascule instant
  si violation CSP observée en prod (report-only d'abord, 48 h preview).
- **Amendement `security-csp.mdc`** : la hard rule actuelle interdit
  `'unsafe-inline'` et impose le nonce ; autoriser `'unsafe-hashes'` exige une
  modification tracée de la rule (hors gel Vague F, via PR sécu dédiée).

---

## 5. Inventaire externalisation CSP-γ

Repris de l'inventaire G-1 (`docs/audits/2026-06-02-vague-g1-inline-inventory.md`
§1) + grep complémentaire ce jour :

| Surface inline                                         | Fichier / origine                                               | Effort externalisation      | Note                                                                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `<script type="application/ld+json">` (JSON-LD)        | `apps/web/src/components/seo/json-ld.tsx` L59-66                | **medium**                  | Externalisable via route dédiée / endpoint, mais perte de co-location + surcoût SEO/réseau (≈ 2219 fiches). |
| Bootstrap hydratation Next.js (`self.__next_f.push`)   | injecté par le framework (pas de fichier source repo)           | **impossible** (nativement) | Inline by-design, contenu variable par page → non hashable, non externalisable sans patch Next.             |
| Event handlers inline (`onclick`/`onsubmit`/`onload`…) | **aucun** (`apps/web/src`, grep ce jour → 0 hit)                | n/a                         | Rien à externaliser côté applicatif.                                                                        |
| `dangerouslySetInnerHTML` (hors JSON-LD)               | **aucun** (inventaire G-1 §1 : 1 seul hit applicatif = json-ld) | n/a                         | Rien d'autre.                                                                                               |
| styled-jsx / `<style jsx>` / `next/script` inline      | **aucun** (inventaire G-1 §1)                                   | n/a                         | `style-src` autorise déjà `'unsafe-inline'` (hors périmètre script).                                        |

**Verdict CSP-γ sur ce repo : NON sans patch Next maison.** L'externalisation du
JSON-LD est faisable (medium), mais le **bootstrap d'hydratation Next.js reste
un script inline by-design** dont le hash varie par page — exactement le mur
documenté en inventaire G-1 §2. CSP-γ n'est donc pas viable sur Next 16 sans
patcher le framework (dette infinie, déjà rejetée en ADR-0026 §Alternatives
rejected).

---

## 6. Impact sur les ADR existantes selon le verdict

| Verdict   | ADR-0007                                                             | ADR-0026                                                  | Vague F (MDC)                                                                             | Vague G-2                                                                                                    |
| --------- | -------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **CSP-α** | **Amender** : « ISR via cache CDN `s-maxage`, pas runtime statique » | **Rejected** (rendu figé en force-dynamic = γ d'ADR-0026) | **Vague F-bis** : requalifier `force-dynamic` de « transitoire » à « permanent justifié » | Non écrite → **clôture** de la Vague G                                                                       |
| **CSP-β** | Confirmée (ISR runtime atteint)                                      | **Accepted** (rendu = α PPR ou β d'ADR-0026)              | Maintenue (le « transitoire » se résout par le retour ISR)                                | **Écrite** : « migration modèle CSP + ISR/PPR + outillage hash-check »                                       |
| **CSP-γ** | Confirmée **si** faisable                                            | **Accepted** (rendu = α PPR) **conditionné**              | Maintenue                                                                                 | **Précédée d'un spike** de faisabilité (externalisation bootstrap) ; si échec → CSP-γ abandonnée, retour α/β |

---

## 7. Trajectoire post-décision (séquences à exécuter)

### Si verdict = CSP-α (nonce, statu quo)

1. ADR-0027 : `Proposed → Accepted` (option CSP-α).
2. ADR-0026 : `Proposed → Rejected` (rendu résolu = force-dynamic permanent).
3. **Amender ADR-0007** : ISR effectif via cache CDN `s-maxage` + contrainte « pas de nonce réémis sur les hits CDN ».
4. **Vague F-bis (MDC doc-only)** : requalifier `force-dynamic` de « transitoire » à « permanent justifié » dans `hotel-detail-page.mdc`, `nextjs-app-router.mdc`, `seo-geo.mdc`, `31-hotel-page-blueprint.mdc`.
5. Runbook : ajouter l'audit coût Fluid Compute mensuel (cf. §3 une fois chiffré).
6. Clôturer la Vague G (pas de G-2/G-3).

### Si verdict = CSP-β (unsafe-hashes)

1. **Revue sécu** (§4) tranchée et tracée AVANT tout.
2. ADR-0027 : `Proposed → Accepted` (option CSP-β).
3. ADR-0026 : `Proposed → Accepted` (rendu = α PPR ou β).
4. **Spike confirmatoire** (≈ 15 min, lecture seule + POC jetable) : Next 16 Cache Components × nouvelle CSP `'unsafe-hashes'`, vérifier hydratation + 0 violation.
5. ADR-0007 : confirmée (mention ISR runtime atteint).
6. **Amender `security-csp.mdc`** (PR sécu dédiée, hors gel Vague F) : autoriser `'unsafe-hashes'` + documenter le hash-check.
7. **Vague G-2 (plan doc-only)** : migration CSP + ISR/PPR + outillage `csp-hash-check` au build + flag `CSP_MODE`.

### Si verdict = CSP-γ (strict-dynamic no-inline)

1. **Spike faisabilité bloquant** : prouver l'externalisation/hash du bootstrap Next sans patch framework. Si échec (probable, cf. §5) → **revenir à α/β**.
2. Si succès uniquement : ADR-0027 `Accepted` (CSP-γ), ADR-0026 `Accepted` (α PPR), JSON-LD externalisé (valider la crawlabilité SEO), puis Vague G-2.

---

## 8. Annexes

### Documents internes

- Spike G-1bis : `docs/audits/2026-06-02-spike-cache-components-poc.md`
- Inventaire G-1 : `docs/audits/2026-06-02-vague-g1-inline-inventory.md`
- ADR-0027 (modèle CSP) : `docs/adr/0027-csp-model-evolution.md`
- ADR-0026 (stratégie de rendu) : `docs/adr/0026-csp-rendering-strategy.md`
- ADR-0013 (CSP × ISR debt) : `docs/adr/0013-isr-vs-dynamic-csp-nonce.md`
- ADR-0007 (ISR target) : `docs/adr/0007-isr-via-auth-client-island.md`
- Hard rule CSP : `.cursor/rules/security-csp.mdc`
- Code : `apps/web/src/lib/security/csp.ts`, `apps/web/src/proxy.ts`, `apps/web/src/components/seo/json-ld.tsx`
- Incidents : PR #56 (force-dynamic / `DYNAMIC_SERVER_USAGE`), PR #57 (CSP nonce on home)

### Références externes

- MDN — [CSP `script-src`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src) : `'strict-dynamic'`, `'unsafe-hashes'`, `'nonce-*'`
- Next.js 16 — [Cache Components / `use cache`](https://nextjs.org/docs/app/getting-started/cache-components) (contrainte `headers()` interdite dans `use cache`)
- Next.js — [Content Security Policy guide](https://nextjs.org/docs/app/guides/content-security-policy) (CSP forte via nonce ⇒ rendu dynamique)
- OWASP — [Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html) (déconseille `'unsafe-hashes'`)
