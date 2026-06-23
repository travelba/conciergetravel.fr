# Gate 4 — Challenge image & présentation (rubrique)

> Outil de R0 pour le master plan §6, Gate 4. Grille de notation appliquée
> sur le **rendu** de chaque type d'objet produit. Gate 2 prouve que ça
> s'affiche et que c'est découvrable ; **Gate 4 prouve que c'est digne d'une
> marque de luxe**. On challenge le rendu, on ne le constate pas.
>
> Standard : « La sélection du Concierge » — premium, sobre, éditorial.
> Réfs : [`EDITORIAL_VOICE.md`](../../EDITORIAL_VOICE.md), skills
> `luxury-motion-effects`, `responsive-ui-architecture`, `accessibility`.

## Comment l'appliquer

1. Capturer le rendu (screenshot desktop + mobile, fr + en) via le harness
   visuel de Gate 2.
2. Noter chaque axe ci-dessous **/5**.
3. Seuil de passage : **moyenne ≥ 4 ET aucun axe < 3**.
4. Tout axe < 3 = **issue design** → corriger le **composant** (refonte une
   fois pour toutes), pas l'instance. L'issue repart dans la boucle de montée
   en compétence (master plan §7).

## Grille (notée /5 par axe)

| Axe                          | Question                                                                             | 1 (échec)                                               | 5 (cible luxe)                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------- |
| **Données / tableaux**       | Classements, comparatifs, fiches techniques : présentation premium ou tableau brut ? | Dump tabulaire HTML illisible, non responsive           | Composant dédié, hiérarchie claire, lecture fluide desktop + mobile   |
| **Hiérarchie visuelle**      | L'œil est-il guidé (titres, rythme, espacements) ?                                   | Mur de texte, aucune respiration                        | Rythme éditorial, niveaux de titre nets, blancs maîtrisés             |
| **Art direction photo**      | Ratios cohérents, qualité, cadrage, pas d'étirement ?                                | Photo pixelisée / déformée / mal cadrée                 | Ratios homogènes, cadrage soigné, qualité haute, `next/image` correct |
| **Typographie & espacement** | Échelle typo et marges respectées ?                                                  | Tailles incohérentes, densité étouffante                | Échelle typo cohérente, interlignes et marges premium                 |
| **Cohérence catalogue**      | Même langage visuel d'un objet à l'autre ?                                           | Dérive de style entre fiches / vagues                   | Identité visuelle constante sur tout le catalogue                     |
| **Mobile**                   | Le rendu mobile est-il aussi soigné que desktop ?                                    | Tableau qui déborde, CTA coupé, tap targets trop petits | Parité desktop, lisible, tap targets ≥ 44 px                          |
| **Accessibilité visuelle**   | Contraste, focus visible, ordre de lecture ?                                         | Contraste insuffisant, focus invisible                  | WCAG AA respecté, focus net, ordre logique                            |

## Règles dures spécifiques

- **Classements / comparatifs** ne sont **jamais** rendus comme un tableau
  Markdown ou un `<table>` brut sans style : composant premium dédié
  (ex. `<RankingTable>` / cartes classées) avec rang, visuel, justification.
- **Hero & galeries** : ratios fixes (anti-CLS), `priority` sur le hero,
  Cloudinary `f_auto,q_auto`.
- Une issue récurrente sur un axe → **cas de régression** (snapshot visuel ou
  assertion DOM) ajouté pour qu'elle ne revienne pas (master plan §7).

## Rapport de vague

Pour chaque type d'objet d'une vague, joindre : les captures, la note par axe,
la moyenne, et la liste des issues design (avec le composant ciblé pour la
refonte). Aucun « livré » sans ce rapport (master plan §6, règle dure).
