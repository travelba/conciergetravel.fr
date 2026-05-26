# Références visuelles — direction « Palace Editorial Vintage »

Ce dossier contient les **références canoniques** validées pour la
direction visuelle de MyConciergeHotel.com. Toute nouvelle
illustration ET toute maquette UI doit converger vers ce monde.

Brief complet : [`../stitch-prompts.md`](../stitch-prompts.md)
(prompt système §1 + section illustrations §4).

## Fichiers

| Fichier                                               | Scène                                                                                                     | Usage primaire                                                             |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `concierge-illustration-style-01-palace-entrance.png` | Palace Entrance — Concierge présente une voiturette rose vintage à un couple sur tapis rouge              | Hero page d'accueil `/`, page `/compte/inscription`, scène 01 du pool §4.7 |
| `concierge-illustration-style-02-reception-desk.png`  | Brass Phone Reception — Concierge au téléphone laiton à la réception, cliente élégante au comptoir marbre | Page `/compte/connexion` (colonne gauche), scène 02 du pool §4.7           |

## Direction à reproduire

### Palette (UI ET illustration — la même)

- Cream ivoire `#f5ebd4` — fond dominant
- Charcoal `#1a1a1a` — texte principal
- Bordeaux Concierge `#6b2331` — CTA primary fort
- Laiton chaud `#b88a4d` — accents fins (bordures, filets, focus)
- Marbre veiné `#ece5d9` — surfaces secondaires
- Rose poudré `#f4c6c1` — accent doux rare
- Sage feuillage `#8c9681` — callouts calmes
- Noyer `#6e4a2e` — footer uniquement

### Style illustration

- Peint à l'aquarelle + crayon de couleur
- Wes Anderson × Tomer Hanuka × René Gruau (mode années 50-60)
- Lumière dorée fin d'après-midi
- Composition cinématographique 16:9 ou 21:9
- Personnage récurrent « Le Concierge » : redingote bordeaux,
  chapeau haut-de-forme, gants blancs, jamais caricatural
- Décor : palace haussmannien, Riviera, Provence
- Aucun texte, aucun logo tiers visible

### Style UI

- Cream paper backgrounds, jamais blanc pur
- Boutons primary bordeaux, accents laiton fins partout
- Cartes cream à bordure laiton 1px
- Typo Noto Serif éditoriale + Inter sobre
- Pas de coins très arrondis, pas d'ombre forte, pas de gradient

## Anti-patterns à refuser

Voir [`../stitch-prompts.md`](../stitch-prompts.md) §4.9 +
§1 (prompt système, section « INTERDITS »).

## Process de production

Voir [`../stitch-prompts.md`](../stitch-prompts.md) §4.8.

## Cohérence code prod

Le code production (`packages/ui/src/tokens.css`) utilise encore
l'ancienne palette « Sober Luxury » (off-white + or froid). C'est
attendu — la direction vintage de ce dossier concerne les
maquettes Stitch. Migration du code à décider après validation
des maquettes (voir note en fin de
[`../stitch-prompts.md`](../stitch-prompts.md) §5).
