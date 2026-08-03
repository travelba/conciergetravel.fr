# Cahier des charges — état consolidé & conformité

**Date** : 2026-08-03
**Objet** : reprendre le CDC. Ce document réconcilie le **CDC v3.0** (contrat,
hors dépôt) avec ce qui a été **décidé** (ADR, décisions PO) et **livré**
(commits, mesures) au 3 août 2026. Il remplace la lecture directe du CDC comme
point d'entrée d'une session : le CDC dit ce qui a été commandé, ce document dit
**où on en est et ce qui a été amendé**.

**Ce document ne modifie aucune décision.** Il constate. Toute nouvelle
divergence CDC ↔ réalité doit passer par un ADR (`docs/adr/`), pas par une
réécriture d'ici.

---

## 1. Hiérarchie des sources de vérité

Quand deux documents se contredisent, l'ordre ci-dessous tranche.

| Rang | Source                                                                             | Portée                                                         | Fraîcheur |
| ---- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------- |
| 1    | **`docs/adr/`**                                                                    | Toute décision structurante ; amende le CDC                    | vivant    |
| 2    | **CDC v3.0** (hors dépôt)                                                          | Contrat d'origine : périmètre, enveloppes, cibles              | figé      |
| 3    | [`runbooks/master-plan-multi-agent-2026-07.md`](runbooks/master-plan-multi-agent-2026-07.md) | **Plan d'exécution courant** (WS-A → WS-I)            | 2026-07-02 |
| 4    | [`runbooks/PROJET-MASTER-PLAN.md`](runbooks/PROJET-MASTER-PLAN.md)                 | Cap stratégique (L1 verrouillé, 4 gates, cadence de vague)     | 2026-06-17 |
| 5    | **`AGENTS.md`**                                                                    | Règles dures pour agents ; ses **chiffres** sont un instantané | voir §5   |
| 6    | `apps/web/src/lib/catalogue-stats.ts`                                              | Compteurs publics épinglés                                     | 2026-06-29 |
| 7    | **DB live** (Supabase `fsmfozxgujskluxakeoq`)                                      | Arbitre final sur tout comptage                                | temps réel |

> Les plans plus anciens (`roadmap-2026-06-v2.md`, `cap-editorial-close-2026-06.md`,
> `audits/plan-execution-post-audit-2026-07-02.md`, `audits/dataseo-action-plan-2026-06-29.md`)
> sont **superseded** et renvoient vers les rangs 3-4. Ne pas les exécuter tels quels.

---

## 2. Amendements au CDC v3.0 — ce qui n'est plus applicable tel quel

C'est la section à lire avant d'ouvrir le CDC. Chaque ligne est une commande du
contrat qui a été **délibérément** suspendue, recadrée ou remplacée.

| CDC §        | Ce que le contrat demande                                                  | État réel 2026-08                                                                | Instrument de l'amendement                                                              |
| ------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **§7**       | Tunnel de réservation Amadeus, 3 écrans mobile, paiement hébergé, idempotence | **Gelé.** Aucun booking public. CTA = demande concierge par email                | [ADR-0025](adr/0025-booking-integration-last-brick.md) + décision PO **D1a** (02/07) ; `AGENTS.md` §4ter |
| **§9** (comparateur) | Comparateur de prix sans affiliation (Makcorps)                    | **Gelé avec §7** — dépend de prix live                                           | même                                                                                     |
| **§8**       | Fidélité FREE + PREMIUM vendable                                           | FREE modélisée ; **PREMIUM non vendable**                                        | [ADR-0005](adr/0005-loyalty-premium-deferred.md), flag `LOYALTY_PREMIUM_BILLING_ENABLED` |
| **§9.2**     | Core Web Vitals contractuels sur HTML servi                                | **ISR rejeté sur preuve.** `force-dynamic` conservé site-wide ; le levier perf est le Data Cache partagé (`unstable_cache`), pas le cache CDN HTML | [ADR-0031](adr/0031-editorial-route-cacheability-post-jsonld-nonce-removal.md) (Option C+, 02/07), sous [ADR-0027](adr/0027-csp-model-evolution.md) |
| **§6**       | Surface éditoriale indexable                                               | **Coupe assumée** : destinations < 3 hôtels en `noindex`, `places.xml`/`rooms.xml` hors index sitemap, annuaire pays fins en `noindex` (`hubs.xml` 1857 → 632) | Décision PO **D3** (02/07) — livrée par WS-B / WS-B2. **Réversible** |
| **§2.2**     | ≥ 30 photos / 10 catégories par fiche                                      | **6 / 2 929 fiches (0,2 %)** au plancher. Recadré : top-100 marque seulement    | Plan maître juillet §5 WS-G + §8                                                        |
| **§2.4**     | `description_fr` 600-1000 mots « idéal »                                   | Traité comme **aspirationnel**, pas bloquant (1 outlier résiduel assumé)         | `AGENTS.md` §4bis ligne 4                                                                |
| **§10**      | Refonte / direction artistique                                             | **Aucune refonte.** Le template kit ne se généralise que sur preuve             | Décision PO **D2** (02/07) — comparatif kit vs standard **non livré** (WS-F)             |
| transverse   | Production de contenu net nouveau                                          | **Arrêtée**, sauf matrice lexicale `hotel-de-luxe-*` / `luxury-hotels-*`         | Plan maître juillet §0 et §8                                                             |

**Ligne d'arrivée en vigueur** : **L1** = site éditorial + GEO + capture de lead,
bout en bout. **L2** (paiement réel, WhatsApp vivant, multilingue V2, mobile) =
briques finales *après* L1. Verrouillé le 17 juin
([`PROJET-MASTER-PLAN.md`](runbooks/PROJET-MASTER-PLAN.md) §2,
audit [`audit-contenu-vers-produit-2026-06.md`](runbooks/audit-contenu-vers-produit-2026-06.md)).

---

## 3. Décisions PO du 2026-07-02 — statut d'exécution

| #      | Décision                                                    | Statut au 2026-08-03                                                                          |
| ------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **D1a** | Gel réel du transactionnel, CTA universel = demande concierge | ⚠️ **Partiel** — décision actée, mais le CTA universel (WS-F tâche 1) n'est pas livré        |
| **D1b** | Pilote booking Travelport 50-100 hôtels, semaines 7-12       | ⏸ **Non ouvert** — conditionné au go/no-go de fin S4, lui-même non tenu                       |
| **D2**  | Template kit vs standard tranché **sur preuve**              | ⏸ **En attente** — le comparatif 5 vs 5 fiches (WS-F tâche 6) n'existe pas → aucun rollout kit |
| **D3**  | Coupe de la surface indexable                                | ✅ **Livrée** — WS-B (`472da69`) + WS-B2 annuaire (`6bd384f`)                                  |
| **D4**  | Outreach humain reporté                                      | ✅ Tenue. Pack prêt-à-tirer livré (WS-A, `56d478f`). ⚠️ **Point de re-décision fin S4 échu**   |
| **D5**  | 5-6 agents simultanés, merge ordonné B → E → F → reste       | ✅ Mécanique respectée sur les WS lancés                                                       |

> ⚠️ **Deux jalons de gouvernance sont échus et non tenus** : le re-audit global
> de fin de semaine 4 (qui conditionne D1b **et** la réouverture de D4) et le
> rapport KPI hebdomadaire, dont **la seule itération est la baseline W27**. Ce
> sont des décisions PO, pas des tâches d'agent — voir §7.

---

## 4. État par workstream (plan maître juillet §5)

| WS  | Objet                                | Statut       | Preuve / reste                                                                                              |
| --- | ------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------ |
| A   | Autorité & offsite (réduit par D4)   | ✅ livré     | `56d478f` — page badge partenaire, press data pack, kit outreach. Envoi = PO, gelé                          |
| B   | Crawl & indexation                   | ✅ livré     | `472da69` + `6bd384f` (annuaire, `hubs.xml` 1857 → 632)                                                     |
| C   | P0 DataSEO (claims/meta/FAQ)         | ✅ outillage | `c6be861` + `808e853` (plancher FAQ, guard twins Palace, scanner catalogue). **Le passage catalogue complet reste à faire** |
| D   | Parité EN + matrice lexicale         | ❌ non lancé | **Bloqué en amont** : la métrique « intros EN réelles » est contradictoire — voir §6                        |
| E   | Performance & rendu                  | ⚠️ partiel   | `c3103c6` — ADR-0031 tranché (ISR **rejeté**), Data Cache + fix CPU EnrichedText (destination 21 s → 3,2 s). Reste : `/hotels` 10,4 Mo, budget JS, `loading.tsx`/`error.tsx` |
| F   | Front finition & CTA universel       | ❌ non lancé | Porte D1a **et** D2. Plus gros écart ouvert                                                                 |
| G   | Photos top-100                       | ❌ non lancé | Alerte KPI n°2 (0,2 % au plancher CDC §2.2)                                                                 |
| H   | Pilote transactionnel                | ⏸ conditionné | Prérequis non réunis (D1b non ouvert, WS-E et WS-F non soldés)                                             |
| I   | Mesure & reporting                   | ⚠️ baseline seule | `b4e2f2a` — [`kpi-weekly-2026-W27.md`](audits/kpi-weekly-2026-W27.md). **Aucune itération depuis** ⇒ toute tendance est aveugle |

---

## 5. Chiffres de référence — ce qui est périmé, ce qui fait foi

Le rapport W27 §8 a établi que **les baselines contenu d'`AGENTS.md` sont
périmées**. Corrigées dans ce commit ; à ne plus citer depuis les anciennes valeurs.

| Grandeur                    | Valeur périmée souvent citée | **Valeur de référence**       | Source                                     |
| --------------------------- | ---------------------------- | ------------------------------ | ------------------------------------------ |
| Hôtels publiés              | 2 219 / 2 221                | **2 929** (2 985 lignes)      | DB live 02/07 · `catalogue-stats.ts`       |
| Pays                        | 127                          | **128**                        | `catalogue-stats.ts`                       |
| Classements publiés         | 549 / 816                    | **863** (876 lignes)          | DB live 02/07                              |
| Guides éditoriaux           | 82 / 99                      | à re-compter                   | —                                          |
| Fiches ≥ 10 photos          | —                            | 2 739 / 2 929 (93,5 %)         | DB live 02/07                              |
| Fiches ≥ 30 photos (CDC)    | —                            | **6 / 2 929 (0,2 %)**          | DB live 02/07                              |
| Mots-clés classés FR        | —                            | **1** (ETV 0,672)              | DataForSEO Labs 02/07                      |
| Idem yonder.fr              | —                            | 14 727 (ETV ~418 k)            | idem — écart d'ordre 1 : ≈ 1:14 700        |
| Panier 12 requêtes top 20   | —                            | **0/12** FR, 0/3 EN            | SERP live 02/07                            |
| TTFB fiche                  | 3-4,5 s                      | **0,80-1,07 s**, `x-vercel-cache: MISS` 20/20 | curl prod 02/07             |

> Les baselines **SEO/autorité** de juillet sont confirmées ; ce sont les
> baselines **contenu** qui avaient dérivé. Contre-mesure durable : ne jamais
> citer un compteur sans sa source et sa date, et re-compter en DB au moindre doute.

---

## 6. Le blocage à lever en premier — métrique EN contradictoire

Avant toute (re)génération EN, il faut trancher une contradiction documentée
mais **jamais résolue** (rapport W27 §4 + §7-1) :

- `rankings-enriched-content-audit-2026-06-29.md` : **68/863** intros EN « réelles » (8 %).
- Proxy `length(intro_en) > 200` en DB live 02/07 : **863/863** (100 %).

Deux hypothèses, exclusives :

1. backfill du 23-29/06 non tracé dans les audits → la parité EN **est** faite ;
2. le critère « réelle » de l'audit est **qualitatif** (EN natif vs calque FR) et
   le seuil de longueur le surestime → la parité EN **n'est pas** faite.

**Coût de se tromper** : régénérer 795 intros correctes (dépense LLM + risque de
régression sur du contenu publié), ou croire une parité inexistante et laisser
le corpus EN en calque. **Action** : audit qualitatif sur échantillon 30 têtes
(EN natif ? leak ? terminologie ?) **avant** la moindre écriture dans
`editorial_rankings`. C'est le premier pas de WS-D, et il est en lecture seule.

---

## 7. Reste à faire — ordonné

**Agent, sans décision PO :**

1. **WS-D étape 0** — audit qualitatif EN (§6). Lecture seule, débloque tout WS-D.
2. **WS-F** — CTA universel (D1a est actée : plus aucun bouton `disabled`),
   compteurs à source unique, cohérence FAQ ↔ restaurants, photos dans la recherche.
   Plus gros écart ouvert et 100 % actionnable.
3. **WS-G** — photos top-100 marque (alerte KPI n°2).
4. **WS-E résiduel** — `/hotels` 10,4 Mo → < 500 Ko, budget JS, `loading.tsx`/`error.tsx`.
   ⚠️ Ne **pas** rouvrir l'ISR : tranché par ADR-0031.
5. **WS-C passage catalogue** — l'outillage P0 existe ; le sweep complet reste à passer.
6. **WS-I** — reprendre la cadence hebdo (W28+), sinon aucune tendance n'est mesurable.

**PO, non délégable :**

- Export GSC frais daté (sans lui, « pages avec impressions » ne se pilote pas).
- **Re-audit global de fin S4** — échu. Il conditionne D1b (pilote booking) et la
  réouverture de D4 (outreach). Tant qu'il n'est pas fait, le goulot n°1
  (autorité, ratio 1:14 700) ne bouge pas et WS-H reste fermé.
- Données mentions légales (Atout France IM, garantie financière, RC pro) —
  bloquant `noindex` depuis le 17 juin ([`PROJET-MASTER-PLAN.md`](runbooks/PROJET-MASTER-PLAN.md) §14).

**Ne pas rouvrir sans ADR** : ISR/cache HTML (ADR-0031), booking hors pilote D1b
(ADR-0025), rollout du kit sans le comparatif D2, production de contenu net
nouveau hors matrice lexicale.

---

## 8. Voir aussi

- [`00-conception-et-phasage.md`](00-conception-et-phasage.md) — cartographie phase → documentation.
- [`runbooks/master-plan-multi-agent-2026-07.md`](runbooks/master-plan-multi-agent-2026-07.md) — briefs WS prêts à coller.
- [`audits/kpi-weekly-2026-W27.md`](audits/kpi-weekly-2026-W27.md) — dernière mesure en date.
- [`adr/`](adr/) — les amendements font foi.
