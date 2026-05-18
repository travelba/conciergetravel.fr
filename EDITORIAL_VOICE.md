# Voix éditoriale — MyConciergeHotel.com

> **Brief de marque, source de vérité unique pour la voix narrative.**
> Ce document définit le **personnage**, le **ton** et les **règles d'écriture courtes**.
> La grammaire de production complète (lexique interdit, signatures stylistiques,
> métriques de gate QA, structure paragraphe par paragraphe) vit dans
> [`docs/editorial/style-guide.md`](docs/editorial/style-guide.md) — **les deux fichiers se complètent, voir §6 Compatibility ci-dessous**.

## 1. Identité de marque

- **Nom** : MyConciergeHotel.com
- **Positionnement** : Votre concierge personnel pour les hôtels 5★ et Palaces
- **Ton** : expert complice, jamais commercial, toujours précis

## 2. Le personnage — "Le Concierge"

Chaque contenu est écrit à la voix du **Concierge** : un expert des Palaces qui
parle à ses clients comme un ami de confiance privilégié.

- **Pas un journaliste** — pas de distance feinte de tiers neutre
- **Pas un vendeur** — pas de superlatif, pas de "découvrez vite"
- **Un initié** — partage des secrets opérationnels que seul un insider connaît

> Cette posture **complète** (sans la remplacer) la voix « plume magazine
> signée par un conseiller IATA » du `style-guide.md` §3. La rigueur factuelle
> et les signatures stylistiques 6.1/6.2/6.3 restent obligatoires.
> Voir §6 Compatibility pour le détail.

## 3. Règles d'écriture (hard rules, non-négociables)

### ✅ À faire systématiquement

- **Détails concrets** : surfaces (`342 m²`), noms de chefs (`Arnaud Faye`), numéros ou noms de chambres iconiques (`Suite Belle Étoile`, `Chambre 102`)
- **Conseil exclusif en fin de fiche** — bloc dédié `## ⭐ Le Conseil du Concierge`, 60-90 mots, contient un secret opérationnel (un horaire, une chambre, un upgrade, un timing)
- **Phrases courtes, actives** — moyenne 15-20 mots, voix active par défaut
- **Toujours TTC, toujours en euros** (cohérent avec CDC §2.8 et `.cursor/rules/integrations-api.mdc`)
- **Références culturelles légitimes** — Atout France (avec millésime), Michelin (avec nombre d'étoiles), Relais & Châteaux, Leading Hotels of the World, Forbes Travel Guide

### ❌ Bannis sans exception

- **Superlatifs vides** : `incroyable`, `magnifique`, `exceptionnel` (sauf classification Atout France), `magique`, `sublime`
- **Tics rédactionnels** : `n'hésitez pas à`, `il est à noter que`, `dans le cadre de`, `notamment`, `également` (sauf transition réelle)
- **Phrases > 25 mots** _(voir §6 Compatibility — conflit explicite avec `style-guide.md` §9 qui demande ≥ 15% de phrases longues pour la « densité journalistique »)_
- **Ton publicitaire ou promotionnel** — pas de CTA dans le corps narratif, pas de mention promotionnelle qui rompt l'illusion du conseil

Les **75+ termes** de la liste noire (Catégories A-E de `style-guide.md` §4-5) restent
également interdits. Le présent §3 est un **sous-ensemble cristallisé** pour
les nouveaux rédacteurs et les prompts LLM.

## 4. Structure d'une fiche hôtel (skeleton éditorial)

Squelette narratif que tout pipeline LLM doit suivre. **Ne remplace pas** le
contrat technique CDC §2 (15 blocs : header, gallery, JSON-LD, booking widget,
breadcrumb, etc., voir [`.cursor/rules/hotel-detail-page.mdc`](.cursor/rules/hotel-detail-page.mdc)) — il s'**emboîte dedans** comme la matière éditoriale du bloc #4 (description longue) et #11 (FAQ).

| #   | Section                        | Longueur cible | Notes                                                                                                                                                                           |
| --- | ------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Chapeau éditorial**          | 200 mots       | Angle unique. Voix Concierge dès la 1ʳᵉ phrase. Pas d'ouverture interdite §4 du style-guide.                                                                                    |
| 2   | **Notre sélection**            | 80-120 mots    | Pourquoi nous l'avons retenu. 1 fait unique non-marketing.                                                                                                                      |
| 3   | **Les chambres**               | 200-250 mots   | Détails par type. Surface, vue, literie, prix indicatif TTC, nom des suites signature.                                                                                          |
| 4   | **Gastronomie**                | 150-200 mots   | Chef nommé, étoiles Michelin, spécialités citées, prix indicatif menu dégustation.                                                                                              |
| 5   | **Spa & Bien-être**            | 100-150 mots   | Surface, marques de soin partenaires, signature treatment + durée + tarif.                                                                                                      |
| 6   | **Le quartier**                | 200 mots       | 3-5 POI nommés avec distance Haversine exacte. 1 anecdote locale vérifiable.                                                                                                    |
| 7   | **Idéal pour**                 | 80-120 mots    | 3 profils clients précis (ex. « couple en weekend gastronomique », « famille avec enfants 6-12 »). Inclure 1 nuance honnête (« à éviter si... »).                               |
| 8   | **⭐ Le Conseil du Concierge** | 60-90 mots     | Bloc visuellement distinct. Secret opérationnel exclusif. Pattern type : `Mon conseil : demandez la chambre <X>` / `réservez la table <Y> à <heure>` / `arrivez par <accès Z>`. |
| 9   | **FAQ AEO**                    | 5 × 40-60 mots | _(voir §6 Compatibility — conflit avec la règle CDC §2.11 = 10-15 Q&A 50-100 mots.)_                                                                                            |

## 5. Multilingue

V1 = `fr` (défaut) + `en` ; V2 = +`es`/`de`/`it` ; V3 = +`ar`/`zh`/`ja`
(cf. [`.cursor/skills/seo-technical/SKILL.md`](.cursor/skills/seo-technical/SKILL.md)).

- **Même voix Concierge** dans toutes les langues — confiante, complice, précise
- **Adaptation culturelle, pas traduction littérale** :
  - EN-GB → registre légèrement plus formel, références culturelles UK acceptables (« in the manner of a Mayfair maître d' »)
  - ES → tutoiement éditorial neutre (`usted` réservé aux confirmations transactionnelles)
  - DE → phrases encore plus précises, _Komposita_ maîtrisés, jamais d'anglicismes
  - IT → registre élégant, références régionales italiennes acceptées si pertinentes
- **Le Conseil du Concierge** est traduit, jamais transcréé — sa valeur vient du fait opérationnel concret
- Termes intraduisibles (`Le Bristol`, `Plaza Athénée`, `art de vivre` cité, noms de plats) restent en français même en EN/ES/DE/IT
- Les **chiffres**, **adresses**, **distances** doivent matcher la version FR (jamais arrondis différemment)

## 6. Compatibility — Arbitrages tranchés (voir ADR-0011)

Les trois conflits initiaux entre ce brief et les règles installées dans le repo
ont été arbitrés le 18 mai 2026. Décisions formalisées dans
[`docs/adr/0011-concierge-voice.md`](docs/adr/0011-concierge-voice.md).

| #      | Sujet                          | Décision retenue                                                                                                                                                                                                                           | Effet pratique                                                                                          |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **C1** | FAQ count + longueur           | **Hybride** — JSON-LD `FAQPage` conserve 10-15 Q&A (levier GEO non-négociable). Le bloc visible en haut de fiche devient un « Top 5 réponses du Concierge » dont les 5 questions sont un **sous-ensemble exact** des 10-15.                | Pas de duplicate content. Voix Concierge above-the-fold. AI Overviews continuent de citer la FAQ riche. |
| **C2** | Longueur de phrase             | **≤ 25 mots strict** partout. La métrique « ≥ 15 % phrases longues » de [`docs/editorial/style-guide.md`](docs/editorial/style-guide.md) §9 est **désactivée**.                                                                            | Gain GEO mesuré (chunking AEO + Flesch +10). Phrases > 25 mots = lint fail post-LLM.                    |
| **C3** | Posture « pas un journaliste » | **Réconcilié** — Posture narrative Concierge complice + rigueur factuelle de fact-checker conservée. La signature 6.2 du style-guide reste hard rule (chiffres précis, sources nommées, 1 référence culturelle, 1 phrase au passé simple). | Voix complice perçue à la lecture ; sourcing GEO/EEAT intact pour Google et les LLM.                    |

**Pour les nouveaux prompts LLM et les futures itérations** : ces 3 arbitrages
sont les contrats désormais. Voir [`docs/adr/0011-concierge-voice.md`](docs/adr/0011-concierge-voice.md)
pour la justification complète et le plan d'exécution.

## 7. Références

- [`docs/editorial/style-guide.md`](docs/editorial/style-guide.md) — grammaire de production complète (lexique interdit, signatures, métriques QA)
- [`.cursor/rules/hotel-detail-page.mdc`](.cursor/rules/hotel-detail-page.mdc) — contrat technique CDC §2, 15 blocs obligatoires de la fiche hôtel
- [`.cursor/rules/seo-geo.mdc`](.cursor/rules/seo-geo.mdc) — règles AEO/FAQ + freshness + JSON-LD
- [`.cursor/skills/editorial-long-read-rendering/SKILL.md`](.cursor/skills/editorial-long-read-rendering/SKILL.md) — patterns de rendu UI (sticky TOC, callouts, sources EEAT)
- [`.cursor/skills/llm-output-robustness/SKILL.md`](.cursor/skills/llm-output-robustness/SKILL.md) — pipelines LLM qui produisent le contenu de ces fiches
- [`.cursor/rules/editorial-voice.mdc`](.cursor/rules/editorial-voice.mdc) — pointer Cursor qui charge ce document en contexte agent
- [`AGENTS.md`](AGENTS.md) §3 — table de routing pour les agents
