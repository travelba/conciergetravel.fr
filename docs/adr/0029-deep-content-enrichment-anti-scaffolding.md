# ADR-0029 — Enrichissement profond des fiches & invariant anti-scaffolding

- Status: Accepted
- Date: 2026-06-04
- Deciders: agent (arbitrage délégué par le PO — décisions D-1→D-6 validées le 2026-06-04)
- Supersedes: —
- Superseded by: —
- Related: runbook d'exécution `docs/editorial/deep-content-enrichment-plan.md`, skill `content-enrichment-pipeline`, passe de de-scaffolding (`scripts/editorial-pilot/src/hotels/descaffold-sections.ts`), golden template `les-airelles-gordes`.

> Cette ADR fige la **décision** (stratégie + invariants). Le **comment exécuter** (phases,
> commandes, vagues, coûts) vit dans le runbook lié, qui peut évoluer sans nouvelle ADR.

## Context

~81 % des fiches publiées ont laissé fuiter en production le **méta-commentaire de brief** (`« le
brief ne documente pas… »`, `AUTO_DRAFT`, niveaux de confiance, Q-IDs Wikidata). Régression EEAT /
SEO / GEO directe : moteurs et LLM ingèrent ce bruit.

Cause racine — le générateur `enrich-hotel-content.ts` :

1. reçoit une **matière pauvre** (brief legacy souvent plein de sentinelles `AUTO_DRAFT`, faits
   jamais allés chercher) ;
2. **narre les trous** au lieu de dégrader en silence (la sentinelle, signal interne au sens de la
   Rule 2 du skill, traverse jusqu'à la prose publiée).

Le pipeline multi-sources idéal (DATAtourisme → Wikidata → Wikipedia → Tavily → `llmExtract` →
brief → génération qui omet sur sentinelle) **existe déjà en briques** mais n'était pas branché sur
le générateur de sections.

## Decision drivers

- **D1** — Zéro fuite de scaffolding en production, de façon **garantie par construction**, pas par
  nettoyage a posteriori.
- **D2** — Qualité EEAT : tout fait publié doit être **sourcé** (provenance auditable), jamais
  brodé pour combler un vide.
- **D3** — Coût maîtrisé : ne pas re-générer ce qui est déjà bon ; cibler le résidu.
- **D4** — Idempotence + réversibilité (re-runs sûrs, slots vides honnêtes récupérables).
- **D5** — Réutiliser les briques existantes (orchestration > greenfield).

## Considered options

### Option α — Nettoyage seul (de-scaffolding généralisé)

Nettoyer la prose existante partout, y compris les sections vides de faits.

- **Pros** : bon marché, rapide.
- **Cons** : sur une section **génuinement vide de faits**, nettoyer ne laisse qu'un vide brodé ou
  un slot vide non comblé. Ne crée aucune valeur factuelle. Contraire à D2.

### Option β — Re-génération globale de tout le catalogue depuis briefs legacy

Relancer `enrich-hotel-content.ts --all --force`.

- **Pros** : simple.
- **Cons** : reproduit la fuite (même matière pauvre, même prompt bavard), écrase le bon contenu,
  coût massif. Contraire à D1/D2/D3.

### Option γ — Deux vitesses + générateur durci sur sources réelles (retenue)

1. **De-scaffolding** (correctif chirurgical, déjà en cours) pour la prose qui porte des **faits
   réels mélangés** à du méta.
2. **Enrichissement profond** pour le **résidu** (sections vides de faits) : briefs **réels**
   (multi-sources, Tavily en profondeur) + générateur **durci** :
   - prompt interdisant explicitement tout marqueur de scaffolding ; sur sentinelle → **omission**
     silencieuse, jamais narration ;
   - **gate anti-fuite partagé** (`LEAK_MARKERS`, extrait du de-scaffolding) à chaque écriture →
     rejet + retry, sinon skip (slot vide gardé) ;
   - **gate EEAT** : régénération d'une section seulement si `anchor_facts ≥ 2` (faits sourcés),
     après une **vraie recherche Tavily multi-requêtes** ; sinon slot vide honnête.
   - **granularité par-section** : préserve les sections déjà riches/nettoyées (pas de wipe global).

- **Pros** : zéro fuite par construction (D1), faits sourcés only (D2), ciblé/économe (D3),
  idempotent + réversible (D4), branché sur les briques existantes (D5).
- **Cons** : plus de pièces mobiles (orchestration multi-sources) ; coût Tavily/flagship sur le
  résidu — borné par cache + segmentation en vagues + gate EEAT.

## Decision

**Option γ retenue.** Le **générateur durci sur sources réelles** devient le **chemin canonique**
de production des `long_description_sections` ; l'ancien générateur « brief-legacy + dégradation
bavarde » est déprécié pour les nouvelles régénérations.

Invariants gravés :

- **I1 (anti-fuite)** — aucune écriture de section ne franchit le gate si un marqueur
  `LEAK_MARKERS` survit.
- **I2 (EEAT)** — aucune section régénérée sans `≥ 2` faits sourcés ; sinon slot vide conservé.
- **I3 (Tavily profond)** — un slot n'est déclaré « sans matière » qu'après une recherche
  multi-requêtes (Search advanced + Extract + fallback éditorial tiers), pas après une seule passe.
- **I4 (par-section)** — préservation du contenu existant valide ; jamais de wipe global aveugle.
- **I5 (idempotence)** — cache disque + runlog ; re-run sans `--force` ne ré-écrit pas une fiche OK.

## Consequences

- La fuite est traitée à la source pour le résidu (né propre), et chirurgicalement ailleurs.
- Coût concentré sur ~500 fiches résiduelles, pas sur les ~2200.
- Le détecteur `LEAK_MARKERS` devient un **module partagé** (de-scaffolding ⇄ générateur).
- Les sections sans matière restent **vides et honnêtes** plutôt que brodées — assumé.
- Réversibilité : un slot vide peut être re-tenté à toute évolution de sources/budget.

## Application plan (deliverable)

Exécution détaillée dans `docs/editorial/deep-content-enrichment-plan.md` :

1. Extraire `LEAK_MARKERS` dans un module partagé.
2. Brancher le générateur durci sur `brief-builder` (Tavily profond) + gates I1/I2/I3.
3. Pilote 12 fiches (chiffrage réel tokens + crédits Tavily) — **GO PO requis** (1er poste de
   dépense).
4. Vagues : Palaces FR → 5★ FR → international, idempotentes, runlog.
5. Re-audit CDC + marche utilisateur avant « live » par vague.

## References

- Runbook : `docs/editorial/deep-content-enrichment-plan.md`
- Skill : `.cursor/skills/content-enrichment-pipeline/SKILL.md`
- Briques : `scripts/editorial-pilot/src/enrichment/{brief-builder,datatourisme,wikidata,wikipedia,tavily-client,llm-extract,dining-extractor,wellness-extractor,capacity-extractor,services-extractor}.ts`
- Générateur : `scripts/editorial-pilot/src/enrichment/enrich-hotel-content.ts`
- Gate source : `scripts/editorial-pilot/src/hotels/descaffold-sections.ts` (`LEAK_MARKERS`)
