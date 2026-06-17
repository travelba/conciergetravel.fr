# Cap — « Fermer le site éditorial à 100 % » (2026-06)

- Statut : **actif**
- Démarré : 2026-06-17
- Décision PO : Cap A (audit global 2026-06-17). Le contenu est l'actif mûr ;
  ce qui « fait pas fini » coûte peu à corriger ; le booking est ré-ouvert hors
  cap et aspire l'énergie. On ferme le site éditorial avant tout le reste.

## Règle anti-dispersion (à tenir jusqu'à clôture du Lot 5)

> **Aucun nouveau commit `feat(booking)` ni extension du template kit au-delà
> des 8 slugs pilotes, jusqu'à ce que les Lots 0 → 5 soient fermés.**

Gel confirmé par construction (flags `false` par défaut) :

- `MULTI_SUPPLIER_RATESHOPPING_ENABLED` = off (`packages/config/src/env.ts`)
- `TRAVELPORT_SANDBOX_ENABLED` = off
- `MCH_HOTEL_KIT_CATALOGUE_ROLLOUT` = off (kit reste sur les 8 pilotes)

Voir `AGENTS.md §4ter` (booking = dernière brique, Phase 6) et ADR-0025/0026.

## Critère de « fini » universel

Chaque lot se termine par un walk utilisateur fr + en, desktop + mobile
(règle `.cursor/rules/user-acceptance-before-commit.mdc`).

## Lots

| Lot   | Objet                                                                                                                                              | Statut        |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **0** | Geler la dispersion + hygiène (gel flags, nettoyage dépôt, compteurs live)                                                                         | ✅ 2026-06-17 |
| **1** | Fuites de finition visibles (mentions légales draft, `/a-propos` absent, FAQ home non rendue, ancre `#hotels`, footer catégorie, label « Guides ») | ⏳            |
| **2** | Fermer les portes de contact (`/le-concierge/contact` stub, `/api/agent/contact` dry-run, formulaires newsletter + MICE désactivés)                | ⏳            |
| **3** | Discoverabilité & cohérence nav (routes orphelines, header↔footer↔mobile↔home-kit)                                                                 | ⏳            |
| **4** | Qualité contenu résiduelle (0 fuite scaffolding ADR-0029, doublons guides `scope=country` ADR-0015, bandes CDC)                                    | ⏳            |
| **5** | Livraison & indexation (sitemap, GSC, llms.txt, hreflang, release Sentry)                                                                          | ⏳            |

## Journal

### Lot 0 — 2026-06-17 (commit `ce1d822`)

- Compteurs catalogue rafraîchis depuis la DB live (Supabase MCP
  `plugin-supabase-supabase`, project `fsmfozxgujskluxakeoq`) :
  2221 hôtels publiés / 127 pays / 479 R&C / 224 SLH / 127 W50B /
  39 Palaces Atout France / 633 classements / 82 guides / 23 itinéraires.
- `catalogue-stats.ts` + 12 chaînes i18n en dur (fr+en) synchronisées.
- Dépôt nettoyé (~110 fichiers scratch supprimés) + `.gitignore` durci.
- **Constat reporté au Lot 4** : les 17 guides en draft sont des doublons
  `scope=country` volontairement non publiés (`italie`+`guide-italie`, etc.) —
  cohorte différée ADR-0015 (dédup slugs + passe EN), pas une régression.
- Walk : home FR + EN rendues, DOM serveur porte bien `2 221` / `479`.
  (Capture navigateur non prise : Chrome absent pour le MCP Playwright.)
