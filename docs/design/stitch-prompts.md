# Stitch prompts — MyConciergeHotel.com

> ⚠️ **MISE À JOUR DA — Juin 2026 : la direction visuelle officielle est
> désormais « Sober Editorial Luxe » (palette crème/taupe).** Source de
> vérité = les tokens du code : `packages/ui/src/tokens.css`
> (`--color-off-white: #f6f1e7`, accent taupe `--color-gold: #8c7b5a`,
> typographie **EB Garamond × Outfit**). Cette DA remplace la direction
> « Palace Editorial Vintage » (cream ivoire / bordeaux / laiton / Noto
> Serif) décrite historiquement ci-dessous.
>
> Le **prompt système §1 (FR et EN)** a été réaligné sur la nouvelle DA.
> Les **prompts par page (§2.x)** conservent encore des références
> bordeaux/laiton/aquarelle : les lire en appliquant la table de
> correspondance ci-dessous jusqu'à leur réécriture complète.
>
> | Ancien (vintage) | Nouveau (crème/taupe) |
> | --- | --- |
> | Cream ivoire `#f5ebd4` (fond) | Crème `#f6f1e7` (fond) |
> | Bordeaux `#6b2331` (accent fort, boutons) | Taupe `#8c7b5a` / noir taupe `#3a352d` (boutons pleins) |
> | Laiton `#b88a4d` (filets, focus) | Taupe `#8c7b5a` (filets, focus, étoiles) |
> | Marbre `#ece5d9` (surfaces) | Crème-2 `#efe8da` / crème-3 `#e8e0d0` |
> | Noto Serif (titres) | EB Garamond (titres) |
> | Inter (corps) | Outfit (corps) |
> | Illustrations aquarelle Concierge | **Vraies photos de luxe** (pas d'illustration de remplissage) |
> | Charcoal `#1a1a1a` (texte) | Texte `#2b2722`, titres `#3a352d` |
>
> **Règle d'or inchangée** : SEO/GEO priment toujours sur le graphique.
> Pas de fond sombre, pas d'or jaune, un seul accent.


> Prompts prêts à coller dans **Stitch (Google Labs)** pour générer
> les maquettes graphiques des pages stratégiques de
> MyConciergeHotel.com.
>
> **Direction visuelle unique** : _Palace Editorial Vintage_ — un
> monde de cream paper, encre bordeaux, accents laiton, illustrations
> peintes Wes Anderson. Le site est la papèterie d'un palace
> retranscrite sur le web, pas un comparateur minimaliste.
>
> Bilingue (FR primary, EN ensuite). Chaque page-prompt s'utilise
> **après** avoir collé le prompt système §1 dans la même session
> Stitch.
>
> Références canoniques (à toujours montrer à Stitch ou à
> l'illustrateur) :
> [01 Palace Entrance](./references/concierge-illustration-style-01-palace-entrance.png)
> · [02 Brass Phone Reception](./references/concierge-illustration-style-02-reception-desk.png).

---

## 0. Mode d'emploi / How to use

### FR

1. **Coller d'abord le prompt système §1** dans une nouvelle session
   Stitch. Il fixe le monde de marque (palette, typo, composants,
   ambiance vintage éditoriale, place des illustrations).
2. **Coller ensuite le prompt page** (§2.1 à §2.15) de la page
   voulue.
3. **Itérer** par messages courts : _« épaissis les filets laiton »_,
   _« assombris le bordeaux du bouton »_.
4. **Pour isoler un composant**, utiliser les snippets §3.
5. **Pour produire les illustrations elles-mêmes** (en dehors de
   Stitch, via Midjourney ou un illustrateur), utiliser §4.
6. **Phase 6 booking gelée** — pas de widget réservation live, pas
   de prix Amadeus, pas d'`Offer` JSON-LD. CTA éditorial partout :
   « Réserver via le Concierge ».

**Ce que Stitch sait faire** : générer une UI mobile/web cohérente
avec une palette et une typo fournies, respecter une grille,
composer des cartes et formulaires, exporter Figma + code.
**Ce que Stitch ne sait PAS faire** : peindre les illustrations
Concierge (style aquarelle Wes Anderson). Toujours laisser une
**zone réservée labellée** dans la maquette, l'illustration sera
livrée séparément (§4).

### EN

1. **Paste system prompt §1 first** in a new Stitch session. It
   fixes the brand world (palette, typography, components, vintage
   editorial mood, illustration role).
2. **Then paste the page prompt** (§2.1 to §2.15).
3. **Iterate** with short follow-ups: _"thicken the brass lines"_,
   _"darken the burgundy button"_.
4. **To isolate a component**, use the §3 snippets.
5. **To produce the illustrations themselves** (outside Stitch, via
   Midjourney or an illustrator), use §4.
6. **Phase 6 booking frozen** — no live booking widget, no Amadeus
   prices, no `Offer` JSON-LD. Editorial CTA everywhere: "Book via
   the Concierge".

**Stitch can**: generate consistent mobile/web UI with a provided
palette and typography, respect a grid, compose cards and forms,
export Figma + code.
**Stitch cannot**: paint the Concierge illustrations (Wes Anderson
watercolour style). Always leave a **labelled reserved zone** in
the mock — the illustration is delivered separately (§4).

---

## 1. Prompt système maître (brand + design system)

À coller en **premier** message de chaque nouvelle session Stitch.

### Prompt — FR

```text
Tu conçois l'interface de MyConciergeHotel.com, une agence de
voyage en ligne accréditée IATA spécialisée dans les Palaces 5★
de France. La voix de marque s'appelle « Le Concierge » — un
expert complice qui parle à ses clients comme un ami de confiance.

DIRECTION VISUELLE UNIQUE — « Sober Editorial Luxe » (crème/taupe)

Imagine le carnet d'adresses confidentiel d'un Concierge de palace :
papier crème feutré, un unique accent taupe, vraies photos de luxe,
beaucoup de blanc tournant. Luxe discret, éditorial, intemporel —
l'opposé du tape-à-l'œil. Pas minimaliste Booking. Pas brutaliste tech.
Pas SAAS scandinave. Pas d'aquarelle ni d'illustration de remplissage :
la photographie de luxe porte l'émotion.

Références mentales : Aman brand book, Relais & Châteaux, Tablet Hotels,
Kinfolk, Cereal magazine, papèterie crème gravée.

PALETTE — chaude et feutrée, un seul accent (aucun or jaune, aucun fond
sombre)

- Crème #f6f1e7 — FOND DOMINANT de toute l'interface (couleur du papier).
- Crème-2 #efe8da — section alternée ; Crème-3 #e8e0d0 — footer, bandeaux.
- Blanc #ffffff — cartes.
- Texte #2b2722 — corps ; Texte-doux #6f675b — secondaire, légendes.
- Noir taupe #3a352d — titres, boutons pleins ; hover #4a4439.
- Taupe #8c7b5a — L'UNIQUE accent : eyebrow, liens, étoiles, filets,
  focus ring, bordures de cartes. Remplace l'or froid #c9a96e et le
  bordeaux/laiton vintage. Taupe clair #a89671 sur fond photo/sombre.
- Sage feuillage #8c9681 — tertiaire rare pour callouts calmes (FAQ).
- Statuts : success #2f7a3d, warning #b07d2e, danger #ba1a1a.
- Filets/bordures : rgba(140,123,90,.28). Surface inputs : #fffefb.
- Pas de gradient, pas de néon, pas de glassmorphism, pas de fond sombre.

TYPOGRAPHIE — éditoriale, intemporelle (jamais plus de deux polices)

- EB Garamond (serif) pour H1/H2/H3/H4, weight 400/500, italique
  autorisé et encouragé (citations, conseils Concierge, sous-titres).
  Jamais bold gras. letter-spacing -0.01em à -0.02em.
- Outfit (sans) pour le corps, nav, boutons, formulaires, chiffres
  (weight 300/400/500).
- H1 : clamp(2rem, 4vw + 1rem, 3rem), line-height 1.1
- H2 : clamp(1.5rem, 2vw + 1rem, 2rem), line-height 1.2
- H3 : clamp(1.25rem, 1.5vw + 0.5rem, 1.5rem)
- Body : 16px, line-height 1.5
- Eyebrow / label-caps : 12px, letter-spacing 0.34em, uppercase,
  COULEUR TAUPE par défaut (pas charcoal).
- Petites annotations : Outfit italique 13px texte-doux.

LAYOUT — éditorial respirant

- Container max 1440px, centré
- Padding horizontal : 20px mobile, 80px desktop
- Gutter de grille : 24px
- Espacement entre sections : 96px mobile, 120px desktop
- Largeur de prose : 68 caractères (max-prose)
- Largeur éditoriale large : 74rem (max-editorial)
- Breakpoints : 640 sm, 768 md, 1024 lg, 1280 xl, 1440 2xl

COMPOSANTS — chrome vintage subtil

- Border-radius : 4px par défaut (élégant pas arrondi), 12px chips,
  9999px avatars. PAS de coins très arrondis modernes.
- Cartes : fond marbre #ece5d9 OU cream #f5ebd4 (alterner), bordure
  laiton 1px #b88a4d, padding 24px desktop / 16px mobile, radius
  4px. Pas d'ombre dure — au plus shadow-sm cream très subtile.
  Optionnel : un petit ornement laiton ligne fine en coin haut-
  gauche (étoile 8px, vague, ou liseré) — discret comme un cachet
  de cire.
- Filets séparateurs : laiton 1px #b88a4d, optionnellement une
  petite étoile 6px centrée (style « ✶ ») pour séparer deux
  sections éditoriales fortes. À user avec parcimonie.
- Boutons :
  - Primary = fond bordeaux #6b2331, texte cream #f5ebd4, hauteur
    48px, padding-x 32px, radius 4px, label Inter 14px weight 500.
    Hover : assombrissement à #5a1c28.
  - Accent = fond laiton chaud #b88a4d, texte cream, réservé aux
    CTA finaux (Demander un devis, Payer).
  - Ghost = bordure laiton 1px, fond transparent (laisse passer le
    cream), texte charcoal. Hover : fond marbre #ece5d9.
  - Link-style = texte bordeaux #6b2331 souligné fin, hover charcoal
- Inputs : fond #fffaf0, bordure laiton 1px, label-caps laiton au-
  dessus. Focus ring : 2px solid bordeaux #6b2331, offset 2px
  (visible WCAG 2.2 AA, mais cohérent avec la palette).
- Touch target minimum 44×44px.
- Icônes : line-art fines 1.5px (Lucide), COULEUR LAITON par défaut
  (pas charcoal). Pas d'icône émoji.
- Pas de carrousel auto-play. Carrousels manuels uniquement avec
  flèches laiton.

ILLUSTRATIONS — c'est l'ADN visuel (voir §4 brief complet)

Les illustrations ne sont PAS un add-on. Elles sont l'expression
primaire de la marque, présentes sur :
- Hero de toute page conceptuelle (accueil, cluster Concierge,
  connexion, confirmation, états vides, 404)
- Avatar du Concierge dans chaque bloc « Réponse du Concierge » et
  « Conseil du Concierge »
- Empty states, page d'erreur, newsletter, sections institutionnelles

Style des illustrations = vintage peint à l'aquarelle, Wes Anderson
× Tomer Hanuka × René Gruau. Personnage récurrent « Le Concierge »
en redingote bordeaux, chapeau haut-de-forme, gants blancs. Voir
les 2 images de référence canoniques (rappelées plus bas).

IMPORTANT : Stitch NE PEUT PAS générer ce style d'illustration. Tu
représentes les illustrations par des ZONES RÉSERVÉES rectangulaires
labellées « ILLUSTRATION — [scène] » avec un fond marbre #ece5d9 et
un filet pointillé laiton 2px (pour visualiser l'emplacement et la
taille). L'illustration réelle sera produite séparément via
Midjourney v6 ou un illustrateur, en s'appuyant sur les 2
références canoniques.

PHOTOS RÉELLES — uniquement pour les hôtels

Les photos réelles ne sont utilisées QUE pour :
- Galeries de fiches hôtels (≥ 30 photos catégorisées)
- Cartes hôtels (image 4:3 du frontispice)
- Cartes destinations (photo de lieu)
- POIs dans les guides et itinéraires
- Cartes classement (photo de l'hôtel)

Présentation des photos : toujours dans une carte cream à bordure
laiton 1px (jamais flottantes sans chrome). Coins photo radius 4px.
Optionnel : petite étiquette laiton « ÉTAPE 03 » ou « SUITE
SIGNATURE » épinglée en coin haut-droit (cachet de cire stylisé).

INTERDITS — refuser systématiquement

- Pas de gradient, pas de glassmorphism, pas de néon, pas de blanc
  pur, pas de noir absolu en grande surface.
- Pas de copy commerciale agressive (« Réservez vite », « Plus que
  2 chambres », « X personnes regardent », « Meilleur prix
  garanti », « Offre flash »).
- Pas de superlatif vide (« incroyable », « magnifique »,
  « exceptionnel », « sublime », « magique »).
- Pas d'émoji dans les maquettes, jamais.
- Pas de bouton primary autre que bordeaux (interdit le bleu, le
  noir, le vert).
- Pas de carrousel auto-play. Pas de pop-up newsletter qui surgit
  spontanément.
- Pas de coins très arrondis (≥ 16px) sur boutons ou cartes — ça
  modernise trop, brise le monde vintage.
- Pas de drop shadow forte. Au plus un voile cream très subtil.

DEVISES & FORMATS

- Toujours TTC, toujours en euros (« à partir de 1 290 € TTC la
  nuit »).
- Dates en français : « 12 mars 2026 », jamais « 03/12 ».
- Numéros de chambre / suites en italique serif si nommés.

MOBILE-FIRST obligatoire : chaque écran pensé en 375px d'abord,
puis adapté en desktop. Pas de menu hamburger sur desktop.
```

### Prompt — EN

```text
You are designing the interface for MyConciergeHotel.com, an IATA-
accredited online travel agency specialising in 5-star Palaces in
France. The brand voice is called "The Concierge" — a knowing
expert who speaks to clients like a trusted friend.

SINGLE VISUAL DIRECTION — "Sober Editorial Luxe" (cream/taupe)

Imagine a palace Concierge's confidential address book: muted cream
paper, a single taupe accent, real luxury photography, generous white
space. Discreet, editorial, timeless luxury — the opposite of flashy.
Not Booking minimal. Not brutalist tech. Not Scandinavian SAAS. No
watercolour, no filler illustration: luxury photography carries the
emotion.

Mental references: Aman brand book, Relais & Châteaux, Tablet Hotels,
Kinfolk, Cereal magazine, engraved cream stationery.

PALETTE — warm and muted, a single accent (no yellow gold, no dark
background)

- Cream #f6f1e7 — DOMINANT FILL for the entire interface (paper colour).
- Cream-2 #efe8da — alternate section; Cream-3 #e8e0d0 — footer, bands.
- White #ffffff — cards.
- Text #2b2722 — body; soft text #6f675b — secondary, captions.
- Taupe-charcoal #3a352d — headings, full buttons; hover #4a4439.
- Taupe #8c7b5a — THE single accent: eyebrow, links, stars, rules,
  focus ring, card borders. Replaces the cold gold #c9a96e and the
  vintage burgundy/brass. Light taupe #a89671 on photo/dark fills.
- Sage foliage #8c9681 — rare tertiary for calm callouts (FAQ).
- Status: success #2f7a3d, warning #b07d2e, danger #ba1a1a.
- Rules/borders: rgba(140,123,90,.28). Input surface: #fffefb.
- No gradients, no neon, no glassmorphism, no dark background.

TYPOGRAPHY — editorial, timeless (never more than two typefaces)

- EB Garamond (serif) for H1/H2/H3/H4, weight 400/500, italic allowed
  and encouraged (quotes, Concierge tips, subtitles). Never bold.
  letter-spacing -0.01em to -0.02em.
- Outfit (sans) for body, nav, buttons, forms, numbers (weight
  300/400/500).
- H1: clamp(2rem, 4vw + 1rem, 3rem), line-height 1.1
- H2: clamp(1.5rem, 2vw + 1rem, 2rem), line-height 1.2
- H3: clamp(1.25rem, 1.5vw + 0.5rem, 1.5rem)
- Body: 16px, line-height 1.5
- Eyebrow / label-caps: 12px, letter-spacing 0.34em, uppercase, TAUPE
  COLOUR by default (not charcoal).
- Small notes: italic Outfit 13px soft text.

LAYOUT — editorial, breathing

- Container max 1440px, centred
- Horizontal padding: 20px mobile, 80px desktop
- Grid gutter: 24px
- Section gap: 96px mobile, 120px desktop
- Prose width: 68 characters (max-prose)
- Wide editorial width: 74rem (max-editorial)
- Breakpoints: 640 sm, 768 md, 1024 lg, 1280 xl, 1440 2xl

COMPONENTS — subtle vintage chrome

- Border-radius: 4px default (elegant not rounded), 12px chips,
  9999px avatars. NO modern very-rounded corners.
- Cards: marble fill #ece5d9 OR cream fill #f5ebd4 (alternate),
  brass 1px border #b88a4d, 24px desktop / 16px mobile padding,
  4px radius. No hard shadow — at most a very subtle cream
  shadow-sm. Optional: a small thin brass line ornament in the top-
  left corner (8px star, wave, or hairline) — discreet as a wax
  seal.
- Separator rules: 1px brass #b88a4d, optionally a 6px centred
  small star ("✶") to separate two strong editorial sections. Use
  sparingly.
- Buttons:
  - Primary = burgundy fill #6b2331, cream text #f5ebd4, 48px
    tall, 32px x-padding, 4px radius, 14px Inter weight 500 label.
    Hover: darken to #5a1c28.
  - Accent = warm brass fill #b88a4d, cream text, reserved for
    final CTAs (Request a quote, Pay).
  - Ghost = brass 1px border, transparent fill (cream shows
    through), charcoal text. Hover: marble fill #ece5d9.
  - Link-style = burgundy #6b2331 text, thin underline, hover
    charcoal.
- Inputs: #fffaf0 fill, brass 1px border, brass label-caps above.
  Focus ring: 2px solid burgundy #6b2331, 2px offset (WCAG 2.2 AA
  visible, but palette-consistent).
- Min touch target 44×44px.
- Icons: thin 1.5px line-art (Lucide), BRASS COLOUR by default
  (not charcoal). No emoji icons.
- No auto-play carousel. Manual carousels only with brass arrows.

ILLUSTRATIONS — they are the visual DNA (full §4 brief)

Illustrations are NOT an add-on. They are the primary expression
of the brand, present on:
- Hero of every conceptual page (home, Concierge cluster, login,
  confirmation, empty states, 404)
- Concierge avatar in every "Concierge answer" and "Concierge's
  tip" block
- Empty states, error page, newsletter, institutional sections

Illustration style = vintage watercolour, Wes Anderson × Tomer
Hanuka × René Gruau. Recurring character "The Concierge" in
burgundy livery, top hat, white gloves. See the 2 canonical
reference images (recalled below).

IMPORTANT: Stitch CANNOT generate this illustration style. You
represent illustrations with RESERVED LABELLED RECTANGULAR ZONES,
"ILLUSTRATION — [scene]" label, marble #ece5d9 fill, dotted brass
2px outline (to visualise position and size). The real
illustration will be produced separately via Midjourney v6 or an
illustrator, using the 2 canonical references.

REAL PHOTOS — hotels only

Real photos are used ONLY for:
- Hotel-fiche galleries (≥ 30 categorised photos)
- Hotel cards (4:3 image of the facade)
- Destination cards (place photo)
- POIs in guides and itineraries
- Ranking cards (hotel photo)

Photo presentation: always inside a cream card with a 1px brass
border (never floating chromeless). Photo corners 4px radius.
Optional: small brass tag "STEP 03" or "SIGNATURE SUITE" pinned to
the top-right corner (stylised wax seal).

FORBIDDEN — refuse systematically

- No gradient, no glassmorphism, no neon, no pure white, no
  absolute black large surface.
- No aggressive commercial copy ("Book now", "Only 2 rooms left",
  "X people viewing", "Best price guaranteed", "Flash sale").
- No empty superlative ("amazing", "stunning", "exceptional",
  "sublime", "magical").
- No emoji in mocks, ever.
- No primary button other than burgundy (no blue, no black, no
  green).
- No auto-play carousel. No spontaneous newsletter pop-up.
- No very rounded corners (≥ 16px) on buttons or cards — too
  modern, breaks the vintage world.
- No hard drop shadow. At most a very subtle cream veil.

CURRENCIES & FORMATS

- Always tax-included, always euros ("from €1,290 / night, taxes
  included").
- Dates in long form: "12 March 2026", never "03/12".
- Room/suite numbers in serif italic if named.

MOBILE-FIRST mandatory: every screen designed at 375px first, then
adapted desktop. No hamburger menu on desktop.
```

---

## 2. Prompts par page

### 2.1 Home `/`

#### Prompt — FR

```text
Conçois la page d'accueil de MyConciergeHotel.com — la papèterie
d'entrée du Palace.

Structure top-down :

1. Header sticky 72px. Fond cream #f5ebd4. Logo serif
   « MyConciergeHotel » charcoal à gauche (poids 400, letter-spacing
   -0.01em), avec un petit filet laiton 1px sous le logo qui
   souligne le nom (~120px). Nav centrale 5 entrées (Destinations,
   Classements, Guides, Itinéraires, Le Concierge) Inter 14px
   charcoal, espacement 32px, ligne hover bordeaux 1px sous l'item.
   À droite : icône loupe line-art LAITON (44×44 touch target) +
   icône compte LAITON (44×44). Au scroll > 16px, ajouter un fin
   filet laiton 1px en bas du header.

2. Hero éditorial pleine largeur, hauteur 78vh desktop / 92vh
   mobile. ZONE RÉSERVÉE ILLUSTRATION pleine largeur — scène 01
   « Palace Entrance » (Concierge présentant une voiturette rose
   vintage à un couple sur tapis rouge, cf.
   ./references/concierge-illustration-style-01-palace-entrance.png
   et §4). Pas d'overlay sombre — l'illustration cream-bordeaux se
   suffit. Encart titre centré au tiers inférieur, fond cream
   semi-opaque (#f5ebd4 à 88%), bordure laiton 1px, padding 32px,
   max-width 720px : label-caps laiton « UN CONCIERGE, PAS UN
   COMPARATEUR », H1 serif charcoal 3 lignes max « Votre concierge
   personnel pour les Palaces de France », sous-titre Inter italic
   charcoal 1 ligne « Sélection éditoriale. Sans affiliation
   déguisée. Conseil d'un initié. ».

3. Barre de recherche sous le hero, flottante, débordant légèrement
   sur le hero. Carte cream large, bordure laiton 1px, padding
   24px, ombre cream subtile. 4 champs en ligne (desktop) :
   destination autocomplete, dates range picker, voyageurs stepper,
   bouton primary BORDEAUX « Rechercher ». Mobile : empilé,
   bouton bordeaux pleine largeur en bas.

4. Bandeau confiance discret, hauteur 80px, fond marbre #ece5d9.
   5 logos en niveaux de gris à 60% opacity (IATA, Atout France,
   Michelin Guide, Relais & Châteaux, Leading Hotels) espacés
   régulièrement, séparés par de minuscules étoiles laiton « ✶ »
   8px.

5. Section « La sélection du Concierge ». Label-caps laiton « LA
   SÉLECTION DU CONCIERGE » centré, sous lui une fine étoile
   laiton 12px, sous elle H2 serif charcoal centré « 12 adresses
   qui valent le détour ce printemps ». Sous-texte Inter italic
   charcoal centré sur 1 ligne. Grille 4 cartes hôtel desktop / 2
   tablet / 1 mobile, carrousel manuel avec flèches laiton pour
   voir les 12. Chaque carte hôtel (voir snippet §3.3) : photo 4:3,
   cadre marbre + bordure laiton, étoiles + label PALACE laiton,
   nom serif, ville Inter italic, extrait factuel 2 lignes, ligne
   tarif « à partir de 1 290 € TTC », bouton ghost « Voir la
   fiche ».

6. Bloc AEO « La réponse du Concierge ». Fond marbre #ece5d9
   pleine largeur, padding vertical 80px. Conteneur max-editorial
   74rem centré. Carte cream à l'intérieur, bordure laiton 1px,
   padding 48px desktop. Top : avatar circulaire 56×56 du
   Concierge (ZONE RÉSERVÉE — scène 07 portrait crop, §4) +
   label-caps laiton « LA RÉPONSE DU CONCIERGE ». H3 serif italic
   charcoal = la question (« Quel Palace à Paris pour un premier
   voyage à deux ? »). Réponse Inter charcoal 60-80 mots. En bas :
   lien link-style bordeaux souligné « Voir notre classement
   complet → ».

7. Section « Nos destinations ». Label-caps laiton centré, étoile,
   H2 serif charcoal « Là où nous savons vous placer ». Grille 3
   colonnes desktop / 2 tablet / 1 mobile de 6 cartes destination.
   Carte = photo 5:4 (vraie photo lieu) dans cadre marbre + bordure
   laiton, nom serif XL en bas dans encart cream, « 32 Palaces
   sélectionnés » Inter italic.

8. Section « Nos classements signature ». Fond cream profond
   (alternance — pas de fond plus foncé, juste un padding vertical
   120px pour respirer). H2 serif charcoal centré « Nos classements
   de référence ». Liste verticale de 6 classements en cartes
   horizontales pleine largeur du conteneur. Chaque carte : photo
   16:9 à gauche (40%), à droite (60%) numéro de rang en serif XL
   laiton (« N°01 »), H3 serif charcoal, extrait Inter 2 lignes,
   lien link-style bordeaux « Lire le classement → ».

9. Section « Le Concierge en 3 promesses ». 3 colonnes desktop.
   Chaque colonne : petite ZONE RÉSERVÉE ILLUSTRATION carrée 240×240
   centrée (variantes de scène §4 — par ex. scène 04 « Incognito
   Visit » pour « Sans affiliation »), H3 serif charcoal centré
   sous l'illustration, paragraphe Inter 40 mots centré, max-width
   300px. Séparateurs verticaux laiton fins entre les 3 colonnes.

10. Section newsletter. Conteneur cream large, padding vertical
    80px. Petite ZONE RÉSERVÉE ILLUSTRATION SPOT 160×160 centrée
    (scène 11 « Newsletter Still Life » — enveloppe à cire + plume
    + carnet, §4). H2 serif charcoal centré « Recevez les
    recommandations du Concierge, une fois par mois ». Sous-texte
    Inter italic 1 ligne. Formulaire centré max-width 480px : champ
    email cream bordure laiton + bouton primary BORDEAUX
    « S'abonner ». Mention RGPD 12px italic charcoal opacity 65%.

11. Footer 4 colonnes sur fond walnut #6e4a2e (seul gros aplat
    sombre du site, en pied uniquement). Texte cream #f5ebd4,
    titres de colonnes en label-caps LAITON. Logo serif en cream
    en haut à gauche, signature « Agent IATA — Distinction Atout
    France 2026 » Inter italic cream opacity 80%. Sous la grille,
    fin filet laiton, puis bandeau bas : logos IATA + Atout France
    en cream à gauche, copyright cream centré, sélecteur langue
    FR/EN cream à droite.

Mobile : hero descend à 92vh, barre de recherche devient un seul
bouton bordeaux pleine largeur « Trouver mon hôtel » qui ouvre
une bottom sheet cream. Nav devient hamburger sous 1024px. Grilles
4 colonnes deviennent carrousels horizontaux swipeables.

Pas de prix qui changent. Pas d'offre flash. Tout reste éditorial.
```

#### Prompt — EN

```text
Design the homepage of MyConciergeHotel.com — the Palace's entrance
stationery.

Top-down structure:

1. 72px sticky header. Cream #f5ebd4 fill. Charcoal serif logo
   "MyConciergeHotel" left (weight 400, -0.01em letter-spacing),
   with a small 1px brass rule under the logo underlining the name
   (~120px). Centre nav 5 entries (Destinations, Rankings, Guides,
   Itineraries, The Concierge) in 14px charcoal Inter, 32px
   spacing, burgundy 1px hover rule under the item. Right: BRASS
   line-art search icon (44×44 touch target) + BRASS account icon
   (44×44). On scroll > 16px, add a thin brass 1px rule at the
   header bottom.

2. Full-width editorial hero, 78vh desktop / 92vh mobile. FULL-
   WIDTH ILLUSTRATION RESERVED ZONE — scene 01 "Palace Entrance"
   (Concierge handing a vintage pink golf cart to a couple on a
   red carpet, see
   ./references/concierge-illustration-style-01-palace-entrance.png
   and §4). No dark overlay — the cream-burgundy illustration
   stands on its own. Centred title card at the lower third, semi-
   opaque cream fill (#f5ebd4 at 88%), 1px brass border, 32px
   padding, 720px max-width: brass label-caps "A CONCIERGE, NOT A
   COMPARATOR", 3-line max charcoal serif H1 "Your personal
   concierge for the Palaces of France", 1-line italic Inter
   charcoal subtitle "Editorial selection. No hidden affiliation.
   Insider advice."

3. Search bar below the hero, floating, slightly overlapping the
   hero. Wide cream card, 1px brass border, 24px padding, subtle
   cream shadow. 4 inline fields (desktop): destination
   autocomplete, dates range picker, travellers stepper, BURGUNDY
   primary "Search" button. Mobile: stacked, full-width burgundy
   button at the bottom.

4. Discreet trust strip, 80px tall, marble #ece5d9 fill. 5
   grayscale logos at 60% opacity (IATA, Atout France, Michelin
   Guide, Relais & Châteaux, Leading Hotels), evenly spaced,
   separated by tiny 8px brass "✶" stars.

5. "The Concierge's Selection" section. Centred brass label-caps
   "THE CONCIERGE'S SELECTION", under it a thin 12px brass star,
   under it centred charcoal serif H2 "12 addresses worth the
   detour this spring". 1-line italic charcoal Inter subtext.
   Grid of 4 hotel cards desktop / 2 tablet / 1 mobile, manual
   carousel with brass arrows for the 12. Each hotel card (see
   snippet §3.3): 4:3 photo, marble frame + brass border, stars +
   brass PALACE label, serif name, italic Inter city, 2-line
   factual excerpt, rate row "from €1,290 / night, taxes
   included", ghost "View fiche" button.

6. AEO block "The Concierge's answer". Full-width marble #ece5d9
   fill, 80px vertical padding. Centred max-editorial 74rem
   container. Cream card inside, 1px brass border, 48px desktop
   padding. Top: 56×56 circular Concierge avatar (RESERVED ZONE —
   scene 07 portrait crop, §4) + brass label-caps "THE CONCIERGE'S
   ANSWER". Italic charcoal serif H3 = the question ("Which Palace
   in Paris for a first trip à deux?"). 60-80 word charcoal Inter
   answer. Bottom: burgundy underlined link-style "See our full
   ranking →".

7. "Our destinations" section. Centred brass label-caps, star,
   charcoal serif H2 "Where we know how to place you". 3-column
   desktop / 2 tablet / 1 mobile grid of 6 destination cards.
   Card = 5:4 photo (real place photo) in marble frame + brass
   border, XL serif name at the bottom in a cream tag, italic
   Inter "32 curated Palaces".

8. "Signature rankings" section. Deep cream fill (alternation —
   no darker fill, just 120px vertical padding to breathe).
   Centred charcoal serif H2 "Our reference rankings". Vertical
   list of 6 rankings as horizontal full-container-width cards.
   Each card: 16:9 photo left (40%), right (60%) XL brass serif
   rank number ("N°01"), charcoal serif H3, 2-line Inter excerpt,
   burgundy link-style "Read the ranking →".

9. "The Concierge in 3 promises" section. 3 desktop columns.
   Each column: small 240×240 square ILLUSTRATION RESERVED ZONE
   centred (scene §4 variants — e.g. scene 04 "Incognito Visit"
   for "No affiliation"), centred charcoal serif H3 under the
   illustration, centred 40-word Inter paragraph, 300px max-width.
   Thin brass vertical separators between the 3 columns.

10. Newsletter section. Wide cream container, 80px vertical
    padding. Small 160×160 SPOT ILLUSTRATION RESERVED ZONE centred
    (scene 11 "Newsletter Still Life" — wax envelope + pen +
    notebook, §4). Centred charcoal serif H2 "Receive the
    Concierge's recommendations, once a month". 1-line italic
    Inter subtext. Centred form, 480px max-width: cream email
    input with brass border + BURGUNDY primary "Subscribe" button.
    12px italic charcoal opacity 65% GDPR notice.

11. Walnut #6e4a2e fill 4-column footer (the only large dark
    surface on the site, at the foot only). Cream #f5ebd4 text,
    BRASS label-caps column titles. Cream serif logo top-left,
    italic cream opacity 80% "IATA Agent — Atout France 2026
    Distinction" signature. Below the grid, thin brass rule, then
    bottom strip: cream IATA + Atout France logos left, centred
    cream copyright, cream FR/EN switch right.

Mobile: hero drops to 92vh, search bar becomes a single full-
width burgundy "Find my hotel" button opening a cream bottom
sheet. Nav becomes hamburger below 1024px. 4-column grids become
swipeable horizontal carousels.

No changing prices. No flash offer. Everything stays editorial.
```

---

### 2.2 Fiche hôtel `/hotel/[slug]`

> Page la plus stratégique. Suit le contrat CDC §2 (15 blocs) + bloc
> 16 Conseil du Concierge. Voir
> [`.cursor/rules/hotel-detail-page.mdc`](../../.cursor/rules/hotel-detail-page.mdc).

#### Prompt — FR

```text
Conçois la fiche hôtel détaillée — la lettre du Concierge qui
présente l'hôtel. Doit battre Booking, Hotels.com, et le site
officiel de l'hôtel. 16 blocs dans l'ordre exact. Exemple : Le
Bristol Paris.

Fond de page : cream #f5ebd4 partout.

Sticky sous le header global : breadcrumb fin (Accueil ›
Destination › Paris › Le Bristol Paris) en label-caps LAITON 12px,
séparateurs « › » bordeaux.

BLOC 1 — Header identité. Pleine largeur, padding vertical 64px.
Layout 2 colonnes desktop. À gauche 60% : H1 serif charcoal « Le
Bristol Paris », sous-ligne ligne d'étoiles dorées + badge label-
caps cream sur fond bordeaux « PALACE — DISTINCTION ATOUT FRANCE
2026 », ville en Inter italic 16px charcoal opacity 75%. À droite
40% : carte cream bordure laiton, padding 24px, contenant la note
ronde 8.9/10 en serif XL charcoal, sous-titre Inter « 1 247 avis
vérifiés », et 3 sous-notes (Service 9.4, Emplacement 9.7, Confort
9.1) en grille 3 colonnes. Sous le H1, ligne d'actions : icône
cœur favori bordeaux, icône partage laiton, sélecteur langue
FR/EN, sélecteur devise EUR/USD. Filet laiton fin sous tout le
bloc.

BLOC 2 — Galerie média. Mosaïque 5 vraies photos hôtel visibles :
1 grande à gauche en 2/3 hauteur + 4 petites en grille 2×2 à
droite. Chaque photo dans cadre cream bordure laiton 1px, radius
4px, gap entre photos 8px. Petite étiquette laiton « SUITE BELLE
ÉTOILE » épinglée en coin haut-droit de la grande photo (cachet
stylisé). Bouton flottant en bas à droite, cream à bordure laiton :
« Voir les 47 photos » qui ouvre une lightbox plein écran clavier-
accessible (fond cream profond, photos centrées dans cadres laiton,
catégories en label-caps laiton à gauche).

BLOC 3 — Résumé factuel IA-ready. Bandeau cream traversant, max-
editorial 74rem centré, bordures haut/bas laiton 1px (lignes
hairline). Texte serif italic 18px charcoal 130-150 caractères,
ligne unique centrée : « Palace 5★ situé Faubourg Saint-Honoré, à
12 min à pied du Louvre, avec piscine sur le toit, spa La Prairie
et restaurant 3★ Michelin Epicure. ».

BLOC 4 — Description longue éditoriale. Max-prose 68ch, alignement
gauche. Voix Concierge. Sections H2 serif charcoal : « Notre
sélection », « Les chambres », « Gastronomie », « Spa & Bien-être »,
« Le quartier », « Idéal pour ». Sous chaque H2, une petite étoile
laiton 12px puis le texte. Pas de superlatif. Détails concrets.
Texte body Inter 16px line-height 1.65.

BLOC 5 — Types de chambres. H2 serif « Les chambres et suites ».
Grille 3 colonnes desktop de cartes chambre (voir snippet §3.3
variante chambre) : photo 4:3 dans cadre cream + bordure laiton,
nom de la chambre serif italic, surface en m², capacité, ligne
tarif « à partir de 1 290 € TTC », bouton ghost « Voir cette
chambre » → sous-page. 5-8 types visibles, le reste accessible via
bouton ghost « Voir toutes les chambres ».

BLOC 6 — Équipements & services. H2 « Équipements et services ».
Fond marbre #ece5d9 pleine largeur, padding vertical 80px. Grille
6 colonnes desktop / 3 tablet / 2 mobile d'icônes LAITON line-art
+ label Inter sous chaque (Piscine, Spa, Restaurant gastronomique,
Bar, Salle de sport, Wi-Fi haut débit, Service 24h, Conciergerie,
Voiturier, Animaux acceptés, Climatisation, Accès PMR). Bouton
ghost « Voir les 80 équipements » centré.

BLOC 7 — Localisation & accès. H2 « Localisation et accès ». Carte
interactive 16:9 monochrome cream + laiton (style hors-norme,
imite une carte papier de palace), cadre cream bordure laiton. À
droite : adresse, GPS, distances calculées à 5 POI proches (Louvre
1.2 km, Place Vendôme 600 m, etc.) en liste avec étoiles laiton
comme puces. Bloc instructions multimodales (taxi, métro
Miromesnil, Roissy en 35 min) en colonne.

BLOC 8 — Réservation via le Concierge. PAS de moteur live (Phase 6
gelée). Carte large cream à bordure BORDEAUX 2px (insistance
visuelle), padding 40px desktop. Avatar Concierge circulaire 64×64
à gauche (ZONE RÉSERVÉE scène 07, §4). À droite : H3 serif italic
« Réservez via le Concierge », paragraphe Inter 50 mots « Notre
équipe IATA prend en charge votre demande, négocie l'upgrade et
vous répond en moins de 24h », bouton primary BORDEAUX large
« Demander un devis ». Sous-texte 12px italic charcoal opacity 65%
« Aucune commission cachée. Pas de débit avant confirmation. ».

BLOC 9 — Politiques. H2 « Bon à savoir ». Tableau 2 colonnes (clé
+ valeur) sur fond cream avec filets laiton entre lignes. Liste
des informations check-in/check-out/animaux/fumeur/paiement/
annulation/taxe/Wi-Fi.

BLOC 10 — Avis. H2 « Les avis ». Note globale 8.9/10 en serif XL
charcoal à gauche dans un médaillon cream bordure laiton. À droite
distribution en barres LAITON (5★ 67%, 4★ 24%, 3★ 7%, 2★ 1%, 1★
1%). En dessous, 4 avis vérifiés en cartes cream bordure laiton :
source visible (Google, Tripadvisor, Booking, Amadeus), nom prénom
abrégé, date, note, texte 80-120 mots, réponse hôtelier en italic
sage avec barre gauche sage 2px. Bouton ghost « Voir les 1 247
avis ».

BLOC 11 — FAQ. H2 « Les questions du Concierge ». 5 questions
ouvertes par défaut (parking, petit-déj, Wi-Fi, animaux, distance
aéroport) avec question serif italic + réponse Inter 50-100 mots.
8 questions repliées en accordéon laiton fin. État ouvert : fond
légèrement sage très clair, bordure gauche sage 2px.

BLOC 12 — Guide local. H2 « Que faire autour ». Pas de duplication.
3 cartes horizontales (vraies photos POI) cadre cream bordure
laiton, lien link-style bordeaux vers /guide/paris.

BLOC 13 — Réassurance & autorité. Fond marbre #ece5d9 pleine
largeur, padding 80px. Logos labels verticaux LAITON sur cream
(Palace Atout France 2026, Forbes Travel Guide 5★ 2025, Relais &
Châteaux). Citation presse italique serif XL centrée « Le seul
Palace parisien à n'avoir jamais cessé d'être un Palace — Le
Figaro, 2025 », avec petites étoiles laiton de chaque côté. 3
garanties Concierge en colonnes en dessous (Sélection personnelle,
Sans affiliation, Conseil 24h/24).

BLOC 14 — MICE / Groupes. Fond cream profond. H2 « Séminaires,
mariages, groupes ». Brève description, formulaire compact cream
bordure laiton, bouton primary BORDEAUX « Demander un devis MICE ».

BLOC 15 — Footer fiche. NAP rappelé en colonne (adresse, téléphone,
email) avec icônes laiton, réseaux sociaux vérifiés (3 icônes
line-art laiton), grille 4 cartes « Hôtels similaires » pour
maillage interne (vraies photos hôtels).

BLOC 16 — LE CONSEIL DU CONCIERGE — obligatoire, le plus important.
Bloc visuellement distinct, max-editorial 74rem centré, fond cream
profond, bordure gauche BORDEAUX 4px, padding 48px desktop. Ligne
du haut : ZONE RÉSERVÉE AVATAR CONCIERGE circulaire 80×80 à gauche
(scène 07 « Concierge Tip » portrait crop, §4) + label-caps
LAITON « LE CONSEIL DU CONCIERGE » centré vertical + petite étoile
laiton 12px. H3 serif italic charcoal sur ligne suivante : thème
du conseil. Corps Inter 16px charcoal 60-90 mots commençant par
« Mon conseil : », contenant un secret opérationnel concret
(numéro de chambre, horaire, accès méconnu, table à demander).
Signature Inter italic 14px charcoal opacity 75% « — Le Concierge »
bas-droite.

Sticky mobile bottom uniquement : barre fine cream à bordure haute
laiton, prix « à partir de 1 290 € TTC » à gauche en italic, bouton
primary BORDEAUX « Demander » à droite.

Pas d'`Offer` JSON-LD avec priceValidUntil (Phase 6 gelée). Pas de
« X personnes consultent ». Pas d'avis fabriqués. Pas d'urgence.
```

#### Prompt — EN

```text
Design the detailed hotel page — the Concierge's letter presenting
the hotel. Must beat Booking, Hotels.com, and the hotel's own
site. 16 blocks in exact order. Example: Le Bristol Paris.

Page fill: cream #f5ebd4 everywhere.

Sticky under global header: thin breadcrumb (Home › Destination ›
Paris › Le Bristol Paris) in 12px BRASS label-caps, burgundy "›"
separators.

BLOCK 1 — Identity header. Full-width, 64px vertical padding. 2-
column desktop layout. Left 60%: charcoal serif H1 "Le Bristol
Paris", sub-line with gold star row + cream-on-burgundy label-
caps "PALACE — ATOUT FRANCE 2026 DISTINCTION", italic Inter
charcoal 75% opacity 16px city. Right 40%: cream brass-bordered
card, 24px padding, containing round 8.9/10 score in XL charcoal
serif, Inter subtitle "1,247 verified reviews", and 3 sub-scores
(Service 9.4, Location 9.7, Comfort 9.1) in a 3-column grid.
Under H1, action row: burgundy heart favourite, brass share icon,
FR/EN language switch, EUR/USD currency switch. Thin brass rule
under the block.

BLOCK 2 — Media gallery. 5-real-photo mosaic visible: 1 large
left at 2/3 height + 4 small in 2×2 grid right. Each photo in
cream frame brass 1px border, 4px radius, 8px gap between photos.
Small brass tag "BELLE ÉTOILE SUITE" pinned top-right of the large
photo (stylised seal). Floating bottom-right button, cream with
brass border: "See 47 photos" opens a keyboard-accessible
fullscreen lightbox (deep cream fill, photos centred in brass
frames, brass label-caps categories left).

BLOCK 3 — AI-ready factual summary. Cream strip crossing the
width, centred max-editorial 74rem, top/bottom 1px brass borders
(hairline rules). 18px charcoal italic serif text, 130-150 chars,
centred single line: "5-star Palace on Faubourg Saint-Honoré, 12
min walk from the Louvre, with rooftop pool, La Prairie spa and
3-star Michelin Epicure restaurant."

BLOCK 4 — Long editorial description. Max-prose 68ch, left-aligned.
Concierge voice. Charcoal serif H2 sections: "Our selection",
"The rooms", "Dining", "Spa & Wellness", "The neighbourhood",
"Ideal for". Under each H2, a small 12px brass star then the body.
No superlatives. Concrete details. 16px Inter body with 1.65
line-height.

BLOCK 5 — Room types. Serif H2 "Rooms and suites". 3-column
desktop grid of room cards (see snippet §3.3 room variant): 4:3
photo in cream frame + brass border, italic serif room name, m²
surface, capacity, rate row "from €1,290 / night tax-incl", ghost
button "View this room" → subpage. 5-8 visible types, the rest
via ghost button "See all rooms".

BLOCK 6 — Amenities & services. H2 "Amenities and services".
Marble #ece5d9 fill full-width, 80px vertical padding. 6-column
desktop / 3 tablet / 2 mobile grid of BRASS line-art icons +
Inter label under each (Pool, Spa, Fine-dining restaurant, Bar,
Gym, High-speed Wi-Fi, 24h service, Concierge, Valet, Pets
welcome, AC, Accessible). Centred ghost "See all 80 amenities"
button.

BLOCK 7 — Location & access. H2 "Location and access". 16:9
interactive map, cream + brass monochrome (off-spec style,
mimics a paper palace map), cream brass-bordered frame. Right:
address, GPS, distances computed to 5 nearby POIs (Louvre 1.2 km,
Place Vendôme 600 m, etc.) as a list with brass stars as bullets.
Multimodal access block in a column (taxi, Miromesnil métro,
Roissy in 35 min).

BLOCK 8 — Book via the Concierge. NO live engine (Phase 6
frozen). Wide cream card with BURGUNDY 2px border (visual stress),
40px desktop padding. 64×64 circular Concierge avatar left
(RESERVED ZONE scene 07, §4). Right: italic serif H3 "Book via
the Concierge", 50-word Inter body "Our IATA team handles your
request, negotiates the upgrade and replies within 24h", large
BURGUNDY primary button "Request a quote". 12px italic charcoal
65% opacity subtext "No hidden commission. No charge before
confirmation."

BLOCK 9 — Policies. H2 "Good to know". 2-column table (key + value)
on cream with brass rules between rows. Check-in/check-out/pets/
smoking/payment/cancellation/tax/Wi-Fi list.

BLOCK 10 — Reviews. H2 "Reviews". Overall 8.9/10 score in XL
charcoal serif left in a cream brass-bordered medallion. Right
BRASS distribution bars (5★ 67%, 4★ 24%, 3★ 7%, 2★ 1%, 1★ 1%).
Below, 4 verified reviews as cream brass-bordered cards: visible
source (Google, Tripadvisor, Booking, Amadeus), abbreviated name,
date, score, 80-120 word body, hotelier reply in italic sage with
sage 2px left rule. Ghost "See all 1,247 reviews" button.

BLOCK 11 — FAQ. H2 "Questions from the Concierge". 5 questions
open by default (parking, breakfast, Wi-Fi, pets, airport
distance) with italic serif question + 50-100 word Inter answer.
8 questions collapsed in a thin brass accordion. Open state:
slightly very-light sage fill, sage 2px left border.

BLOCK 12 — Local guide. H2 "What to do nearby". No duplication.
3 horizontal cards (real POI photos) cream brass-bordered frame,
burgundy link-style to /guide/paris.

BLOCK 13 — Trust & authority. Marble #ece5d9 fill full-width,
80px padding. BRASS vertical award logos on cream (Palace Atout
France 2026, Forbes Travel Guide 5★ 2025, Relais & Châteaux). XL
centred italic serif press quote "The only Paris Palace that has
never stopped being a Palace — Le Figaro, 2025", with small brass
stars on either side. 3 Concierge guarantees below in columns
(Personal selection, No affiliation, 24/7 advice).

BLOCK 14 — MICE / Groups. Deep cream fill. H2 "Seminars,
weddings, groups". Short description, compact cream brass-bordered
form, BURGUNDY primary button "Request a MICE quote".

BLOCK 15 — Fiche footer. NAP recap in a column (address, phone,
email) with brass icons, verified social links (3 brass line-art
icons), 4-card "Similar hotels" grid for internal mesh (real hotel
photos).

BLOCK 16 — THE CONCIERGE'S TIP — mandatory, the most important.
Visually distinct block, centred max-editorial 74rem, deep cream
fill, BURGUNDY 4px left border, 48px desktop padding. Top row:
80×80 CIRCULAR CONCIERGE AVATAR RESERVED ZONE left (scene 07
"Concierge Tip" portrait crop, §4) + vertically-centred BRASS
label-caps "THE CONCIERGE'S TIP" + small 12px brass star. Italic
charcoal serif H3 on next line: tip theme. 16px charcoal Inter
body, 60-90 words, starts with "My tip:", contains a concrete
operational secret (room number, timing, hidden access, table to
request). 14px italic Inter 75% opacity "— The Concierge"
signature bottom-right.

Sticky mobile bottom only: thin cream bar with top brass border,
italic "from €1,290 / night tax-incl" left, BURGUNDY primary
"Request" button right.

No `Offer` JSON-LD with priceValidUntil (Phase 6 frozen). No "X
people viewing". No fabricated reviews. No urgency.
```

---

### 2.3 Sous-page chambre `/hotel/[slug]/chambres/[roomSlug]`

#### Prompt — FR

```text
Conçois la sous-page d'une chambre individuelle. Exemple : Suite
Belle Étoile du Bristol Paris.

Fond cream #f5ebd4. Breadcrumb 5 niveaux en haut (label-caps
laiton, séparateurs bordeaux) : Accueil › Paris › Le Bristol Paris
› Chambres › Suite Belle Étoile.

1. Header chambre. Layout 2 colonnes desktop. À gauche 60% : H1
   serif charcoal italic « Suite Belle Étoile », sous-ligne label-
   caps cream-sur-bordeaux « SUITE SIGNATURE — 4ème étage » + 4
   étoiles dorées. À droite 40% : carte cream bordure laiton avec
   mini-image carrée 1:1 de l'hôtel parent, nom serif petit, lien
   link-style bordeaux « ← Retour à la fiche hôtel ».

2. Galerie 5+ vraies photos. Mosaïque 1 grande + 4 petites en
   cadres cream bordures laiton (50vh hauteur). Bouton flottant
   cream « Voir toutes les photos » → lightbox.

3. Bandeau métadonnées clés. Fond marbre #ece5d9 pleine largeur,
   padding 32px. Ligne unique en 5 colonnes desktop (stack mobile)
   d'icônes laiton + label charcoal sous chaque : surface
   « 95 m² », capacité « 2 adultes + 1 enfant », vue « panoramique
   sur les toits de Paris », literie « 1 lit king 200×200 », salle
   de bain « marbre Carrare, double vasque ». Séparateurs laiton
   fins verticaux entre les colonnes.

4. Description longue chambre. Max-prose 68ch, voix Concierge,
   minimum 200 mots, unique vs description hôtel parent. Sections
   serif H2 : « Ce qui rend cette suite particulière »,
   « L'expérience d'un séjour », « Détails pratiques ». Petite
   étoile laiton sous chaque H2.

5. Équipements chambre. H2 « Équipements ». Grille 4 colonnes
   desktop / 2 mobile d'icônes LAITON + label Inter (Wi-Fi,
   Nespresso, minibar, coffre, peignoir, chaussons, dressing,
   marbre Carrare, balcon, climatisation, smart TV, room service
   24h).

6. Bloc tarif & demande. Carte cream large à bordure BORDEAUX 2px,
   max-editorial centré, padding 40px. Avatar Concierge circulaire
   64×64 à gauche. À droite : H3 serif italic « À partir de 3 850 €
   TTC / nuit », sous-texte Inter italic charcoal opacity 75%
   « Tarif indicatif hors saison — devis personnalisé via le
   Concierge ». Bouton primary BORDEAUX large « Demander cette
   chambre via le Concierge ».

7. Carrousel manuel « Autres chambres de l'hôtel ». H2 serif. 4
   cartes chambre horizontales défilables avec flèches laiton,
   lien retour fiche.

8. Footer fiche compact identique au footer fiche hôtel.

Mobile : galerie devient un carrousel horizontal swipeable avec
flèches laiton, bandeau métadonnées passe en colonne, sticky
bottom « Demander » comme la fiche.

La canonical pointe vers elle-même, jamais vers l'hôtel parent. Le
H1 ne contient PAS le nom de l'hôtel (il est dans le breadcrumb).
```

#### Prompt — EN

```text
Design the individual room subpage. Example: Suite Belle Étoile at
Le Bristol Paris.

Cream #f5ebd4 fill. 5-level breadcrumb at the top (brass label-
caps, burgundy separators): Home › Paris › Le Bristol Paris ›
Rooms › Suite Belle Étoile.

1. Room header. 2-column desktop layout. Left 60%: italic
   charcoal serif H1 "Suite Belle Étoile", sub-line cream-on-
   burgundy label-caps "SIGNATURE SUITE — 4th floor" + 4 gold
   stars. Right 40%: cream brass-bordered card with parent-hotel
   1:1 mini-image, small serif name, burgundy link-style "← Back
   to hotel fiche".

2. 5+ real photo gallery. 1-large + 4-small mosaic in cream
   brass-bordered frames (50vh tall). Floating cream "See all
   photos" button → lightbox.

3. Key metadata strip. Marble #ece5d9 fill full-width, 32px
   padding. Single row in 5 desktop columns (mobile stack) of
   brass icons + charcoal label under each: surface "95 m²",
   capacity "2 adults + 1 child", view "panoramic Paris rooftops",
   bedding "1 king bed 200×200", bathroom "Carrara marble, double
   sink". Thin vertical brass separators between columns.

4. Long room description. Max-prose 68ch, Concierge voice, at
   least 200 words, unique vs parent fiche. Serif H2 sections:
   "What makes this suite particular", "The stay experience",
   "Practical details". Small brass star under each H2.

5. Room amenities. H2 "Amenities". 4-column desktop / 2 mobile
   grid of BRASS icons + Inter label (Wi-Fi, Nespresso, minibar,
   safe, robe, slippers, dressing, Carrara marble, balcony, AC,
   smart TV, 24h room service).

6. Rate & request block. Wide cream card with BURGUNDY 2px
   border, centred max-editorial, 40px padding. 64×64 circular
   Concierge avatar left. Right: italic serif H3 "From €3,850 /
   night tax-incl", italic Inter 75% charcoal subtext "Off-season
   indicative rate — custom quote via the Concierge". Large
   BURGUNDY primary button "Request this room via the Concierge".

7. Manual "Other rooms in this hotel" carousel. Serif H2. 4
   horizontal swipeable room cards with brass arrows, link back to
   the fiche.

8. Compact fiche footer identical to the hotel-fiche footer.

Mobile: gallery becomes swipeable horizontal carousel with brass
arrows, metadata strip stacks, sticky bottom "Request" like the
parent fiche.

Canonical points to itself, never to the parent hotel. The H1
does NOT contain the hotel name (it's in the breadcrumb).
```

---

### 2.4 Recherche `/recherche`

#### Prompt — FR

```text
Conçois la page de recherche catalogue (filtres catalogue
uniquement, pas d'appel Amadeus live).

Fond cream #f5ebd4 sur toute la page. Header global standard +
breadcrumb (Accueil › Recherche).

Layout desktop : 2 colonnes — gauche 280px fixe filtres, droite
fluide résultats. Mobile : filtres dans une bottom sheet cream
ouverte par un bouton « Filtres (5) » sticky en haut, fond
bordeaux texte cream.

Colonne gauche — Filtres. Conteneur cream à bordure laiton 1px,
padding 24px. Chaque groupe : label-caps LAITON + contrôles cream
bordure laiton :
- Destination : input avec suggestions, chips bordeaux pour les
  choix actifs
- Dates : range picker compact, format « 12 mars 2026 »
- Voyageurs : stepper adultes + stepper enfants
- Étoiles : 4 chips toggles (3★, 4★, 5★, Palace) — actif = fond
  bordeaux texte cream
- Marques : checkbox liste (Relais & Châteaux, Leading Hotels,
  Forbes 5★, Small Luxury, Maisons Pariente)
- Distinctions : checkbox liste (Atout France Palace, Michelin Key,
  Clef Verte)
- Équipements : checkbox liste (Piscine, Spa, Restaurant étoilé,
  Plage privée, Vue mer, Vue montagne, Centre historique, Animaux
  acceptés)
- Bouton link-style bordeaux discret « Réinitialiser » en bas.

Colonne droite — Résultats. En haut : compteur serif italic « 47
hôtels » à gauche, tri à droite (Pertinence, Note décroissante,
Prix croissant, Récemment ajoutés) — sélecteur cream bordure
laiton. Grille 2 colonnes desktop / 1 mobile de cartes hôtel
élargies :
- Photo 16:10 (vraie photo) à gauche sur 40% dans cadre cream
  bordure laiton
- Bloc droit 60% padding 24px : nom serif XL charcoal, ville Inter
  italic, étoiles + label-caps PALACE laiton si applicable, extrait
  factuel 2-3 lignes, ligne d'icônes équipements clés laiton (5
  max), ligne tarif « à partir de 1 290 € TTC », bouton ghost
  bordure laiton « Voir la fiche »

Pagination classique en bas (numéros + précédent/suivant en cream
bordure laiton). Pas d'infinite scroll.

État vide soigné : conteneur centré max-width 480px. ZONE RÉSERVÉE
ILLUSTRATION 4:3 (scène 09 « Empty State search » — Concierge
pensif derrière son bureau avec carnet ouvert, cf. §4) avec
encadrement cream bordure laiton. En dessous, grand H2 serif italic
charcoal « Aucun Palace ne correspond — pour le moment », sous-
texte Inter « Affinez vos critères ou demandez un conseil au
Concierge », bouton ghost « Modifier mes filtres » + bouton primary
BORDEAUX « Contacter le Concierge ». Pas d'icône triste, pas de
SVG flat.

Pas de badge promotionnel. Pas de prix barré. Pas de filtre
« Meilleur prix garanti ». Pas de tri par commission.
```

#### Prompt — EN

```text
Design the catalogue search page (catalogue-only filters, no live
Amadeus call).

Cream #f5ebd4 fill on the whole page. Standard global header +
breadcrumb (Home › Search).

Desktop layout: 2 columns — left 280px fixed filters, right
fluid results. Mobile: filters in a cream bottom sheet opened by
a sticky-top "Filters (5)" button, burgundy fill cream text.

Left column — Filters. Cream container with 1px brass border,
24px padding. Each group: BRASS label-caps + cream brass-bordered
controls:
- Destination: input with suggestions, burgundy chips for active
  picks
- Dates: compact range picker, "12 March 2026" format
- Travellers: adults stepper + children stepper
- Stars: 4 toggle chips (3★, 4★, 5★, Palace) — active = burgundy
  fill cream text
- Brands: checkbox list (Relais & Châteaux, Leading Hotels, Forbes
  5★, Small Luxury, Maisons Pariente)
- Distinctions: checkbox list (Atout France Palace, Michelin Key,
  Clef Verte)
- Amenities: checkbox list (Pool, Spa, Starred restaurant, Private
  beach, Sea view, Mountain view, Historic centre, Pets welcome)
- Discreet burgundy link-style "Reset" button at the bottom.

Right column — Results. Top: italic serif "47 hotels" counter
left, sort right (Relevance, Highest rating, Lowest price, Recently
added) — cream brass-bordered selector. 2-column desktop / 1-
mobile grid of widened hotel cards:
- 16:10 photo (real) left at 40% in cream brass-bordered frame
- Right 60% block, 24px padding: XL charcoal serif name, italic
  Inter city, stars + brass PALACE label-caps if applicable, 2-3
  line factual excerpt, key-amenity brass icon row (5 max), rate
  row "from €1,290 / night tax-incl", ghost brass-border "View
  fiche" button

Classical bottom pagination (cream brass-bordered numbers + prev/
next). No infinite scroll.

Refined empty state: centred container 480px max-width. 4:3
ILLUSTRATION RESERVED ZONE (scene 09 "Empty State search" —
pensive Concierge at his desk with open notebook, see §4) with
cream brass-bordered framing. Below, large italic charcoal serif
H2 "No Palace matches — yet", Inter subtext "Refine your criteria
or ask the Concierge", ghost button "Edit my filters" + BURGUNDY
primary button "Contact the Concierge". No sad icon, no flat SVG.

No promo badge. No struck-through price. No "best price guaranteed"
filter. No commission-based sort.
```

---

### 2.5 Classement `/classement/[slug]`

#### Prompt — FR

```text
Conçois la page d'un classement éditorial signature. Exemple :
« Top 10 Palaces parisiens 2026 ».

Fond cream #f5ebd4. Layout long-read avec sticky TOC à gauche
(desktop).

Header pleine largeur 65vh. ZONE RÉSERVÉE ILLUSTRATION pleine
largeur — scène atmosphérique de la ville (par ex. variante de
« Brass Phone Reception » ou nouvelle scène §4). Encart titre
centré au tiers inférieur, fond cream semi-opaque 90% bordure
laiton, padding 32px, max-width 760px : label-caps LAITON « LE
CLASSEMENT DU CONCIERGE », H1 serif charcoal XL « Les 10 meilleurs
Palaces parisiens — 2026 », sous-titre Inter italic charcoal 1
ligne. Méta-ligne discrète : auteur « Par Le Concierge », date
mise à jour « Mis à jour le 15 mars 2026 », temps de lecture « 12
min », « 8 sources EEAT ».

Sous le hero, sticky TOC à gauche (280px, position sticky top
100px, lg+) : fond cream bordure laiton, padding 24px, label-caps
LAITON « SOMMAIRE », 10 entrées numérotées avec ancre. Scroll-spy
actif : entrée courante en BORDEAUX avec bordure gauche bordeaux
2px.

Colonne contenu droite (max-editorial 74rem) :

1. Intro éditoriale 200-300 mots, max-prose, voix Concierge.
   Première lettre en serif italic XL bordeaux (drop cap 56px).
   Sans superlatif.

2. Bloc AEO « La réponse du Concierge » identique au snippet §3.4
   (avatar Concierge 48×48 + question + réponse + lien).

3. Liste numérotée des 10 hôtels. Séparateur entre chaque entrée :
   filet laiton avec étoile centrale 12px. Chaque entrée :
   - Numéro de rang en serif XL LAITON italic (« N°01 », « N°02 »…)
   - H2 serif italic charcoal avec nom de l'hôtel + lien bordeaux
     vers /hotel/[slug]
   - Vraie photo 16:9 pleine largeur sous le H2, cadre cream
     bordure laiton, étiquette « N°01 » épinglée coin haut-gauche
   - Métriques en ligne dans encart cream bordure laiton : note,
     prix indicatif TTC, distinction
   - Texte éditorial 200 mots voix Concierge
   - Mini-AEO 1 ligne italic « Pourquoi ce rang : … »
   - Lien link-style bordeaux ancré « Voir la fiche complète → »

4. Tableau comparatif. H2 « En un coup d'œil ». Tableau responsive
   cream bordures laiton (cards empilées en mobile) : Nom, Étoiles,
   Quartier, À partir de, Note, Distinction.

5. FAQ. H2 « Les questions du Concierge ». 6 Q/R en accordéon
   laiton fin, état ouvert sage très clair bordure gauche sage 2px.

6. Sources EEAT. H2 « Nos sources ». Liste à puces étoiles laiton
   avec liens externes bordeaux (Atout France 2026, Forbes Travel
   Guide, Le Figaro, Tablet Hotels). Date de dernière vérification.

7. Bloc « Le Conseil du Concierge » identique au snippet §3.5
   (avatar + bordure gauche bordeaux + 60-90 mots opérationnels).

8. Maillage interne en bas : 3 cartes vers d'autres classements
   pertinents (cadres cream bordure laiton).

Footer global standard.

Mobile : TOC devient un bouton bordeaux flottant rond « Sommaire »
qui ouvre une bottom sheet cream. Reste empile en colonne unique.

Pas de bouton « Réserver maintenant ». Le CTA partout est « Voir
la fiche » (vers /hotel/[slug]) qui contient le CTA Concierge.
```

#### Prompt — EN

```text
Design a signature editorial ranking page. Example: "Top 10 Paris
Palaces 2026".

Cream #f5ebd4 fill. Long-read layout with sticky TOC left
(desktop).

Full-width header 65vh. FULL-WIDTH ILLUSTRATION RESERVED ZONE —
atmospheric city scene (e.g. "Brass Phone Reception" variant or
new §4 scene). Centred title card at the lower third, semi-opaque
90% cream fill with brass border, 32px padding, 760px max-width:
BRASS label-caps "THE CONCIERGE'S RANKING", XL charcoal serif H1
"The 10 best Paris Palaces — 2026", italic charcoal Inter 1-line
subtitle. Discreet meta row: author "By The Concierge", "Updated
15 March 2026", "12 min" reading time, "8 EEAT sources".

Below the hero, sticky left TOC (280px, sticky top 100px, lg+):
cream brass-bordered fill, 24px padding, BRASS label-caps
"CONTENTS", 10 numbered anchor entries. Active scroll-spy: current
entry in BURGUNDY with burgundy 2px left border.

Right content (max-editorial 74rem):

1. 200-300 word editorial intro, max-prose, Concierge voice. First
   letter as XL italic burgundy serif (56px drop cap). No
   superlatives.

2. AEO block "The Concierge's answer" identical to snippet §3.4
   (48×48 Concierge avatar + question + answer + link).

3. Numbered list of the 10 hotels. Separator between each entry:
   brass rule with 12px central star. Each entry:
   - BRASS italic XL serif rank number ("N°01", "N°02"…)
   - Italic charcoal serif H2 with hotel name + burgundy link to
     /hotel/[slug]
   - Real 16:9 full-width photo under H2, cream brass-bordered
     frame, "N°01" tag pinned top-left
   - Inline metrics in cream brass-bordered tag: rating, indicative
     tax-incl price, distinction
   - 200-word editorial body, Concierge voice
   - 1-line italic mini-AEO "Why this rank: …"
   - Anchored burgundy link-style "See the full fiche →"

4. Comparison table. H2 "At a glance". Responsive cream brass-
   bordered table (stacked cards on mobile): Name, Stars,
   Neighbourhood, From, Rating, Distinction.

5. FAQ. H2 "Questions from the Concierge". 6 accordion Q/A, thin
   brass, open state very-light sage with 2px sage left border.

6. EEAT sources. H2 "Our sources". Brass-star bullet list with
   burgundy external links (Atout France 2026, Forbes Travel
   Guide, Le Figaro, Tablet Hotels). Last-verified date.

7. "Concierge's tip" block identical to snippet §3.5 (avatar +
   burgundy left border + 60-90 operational words).

8. Internal mesh at the bottom: 3 cards to other relevant rankings
   (cream brass-bordered frames).

Standard global footer.

Mobile: TOC becomes a round burgundy floating "Contents" button
opening a cream bottom sheet. Rest stacks into a single column.

No "Book now" button. The CTA everywhere is "See the fiche" (to
/hotel/[slug]) which contains the Concierge CTA.
```

---

### 2.6 Guide pays / ville `/guide/[citySlug]`

#### Prompt — FR

```text
Conçois la page d'un guide destination long-read. Exemple :
« Guide complet de Paris ». ≥ 3 500 mots.

Fond cream #f5ebd4. Sticky TOC à gauche desktop, callouts Concierge
interleaved.

Hero pleine largeur 70vh. ZONE RÉSERVÉE ILLUSTRATION pleine largeur
(scène emblématique de la ville en style Wes Anderson — par ex.
Tour Eiffel vue depuis un balcon haussmannien, ou pont des Arts
avec couple, §4 nouvelle scène à produire). Encart titre centré
au tiers inférieur, cream semi-opaque 90% bordure laiton, padding
32px : label-caps LAITON « LE GUIDE DU CONCIERGE », H1 serif
charcoal XL « Paris — Le guide du Concierge », sous-titre Inter
italic charcoal. Méta-ligne (auteur, mise à jour, 22 min de
lecture, 12 sources).

Sticky TOC desktop 280px gauche avec 9 sections numérotées et
scroll-spy bordeaux actif.

Contenu droite max-editorial 74rem :

1. Intro éditoriale 250-300 mots voix Concierge avec drop cap
   bordeaux. Angle unique (un fait méconnu ou une promesse
   précise).

2. Bloc AEO « La réponse du Concierge » (snippet §3.4).

3. Section « Quand y aller ». Texte 300 mots. Sous-bloc tableau
   mensuel 12 colonnes cream bordures laiton (météo, fréquentation,
   prix indicatifs, événements clés).

4. Section « Comment y aller ». Texte 200 mots. Sous-blocs en
   cartes cream bordure laiton : avion (3 aéroports + temps trajet
   centre), train (Eurostar, TGV), accès PMR.

5. Section « Les quartiers ». Intro 200 mots. Grille 2 colonnes
   desktop de 6 cartes quartier : vraie photo 4:3 cadre cream
   bordure laiton, nom serif italic, 80 mots d'extrait, label-caps
   LAITON « IDÉAL POUR » + un mot-clé.

6. Section « Nos hôtels recommandés ». Intro 150 mots. Liste de 5
   cartes hôtel élargies (variante §3.3) avec lien vers fiche.
   Lien link-style bordeaux « Voir les 32 Palaces de Paris → »
   vers /destination/paris.

7. Bloc « Le Conseil du Concierge » interleaved au milieu (snippet
   §3.5).

8. Section « Itinéraires suggérés ». 3 cartes itinéraire cream
   bordure laiton avec lien vers /itineraire/[slug].

9. Section « POIs incontournables ». 8 cartes POI cream bordure
   laiton (vraies photos POI) : image 1:1 cadre cream + bordure
   laiton, nom serif italic, distance moyenne, temps de visite.

10. Section « Glossaire local ». Bloc fond marbre #ece5d9, padding
    48px. H2 serif italic « Le vocabulaire du Concierge ». 8-10
    termes parisiens définis (Atout France, Palace, étoile
    Michelin, Relais & Châteaux, …) en liste avec étoiles laiton
    comme puces.

11. FAQ. H2 « Les questions du Concierge ». 8-10 Q/R accordéon
    laiton.

12. Sources EEAT en pied. Liste à puces étoiles laiton avec liens
    externes datés.

13. Maillage interne : 3 cartes guides voisins (Versailles,
    Fontainebleau, Reims).

Footer global.

Mobile : TOC en bottom sheet via bouton bordeaux flottant.
Sections empilées. Cartes en carrousels horizontaux avec flèches
laiton.
```

#### Prompt — EN

```text
Design a long-read destination guide page. Example: "Full guide
to Paris". ≥ 3,500 words.

Cream #f5ebd4 fill. Sticky left desktop TOC, interleaved Concierge
callouts.

Full-width hero 70vh. FULL-WIDTH ILLUSTRATION RESERVED ZONE
(emblematic Wes Anderson-style scene of the city — e.g. Eiffel
Tower from a Haussmann balcony, or Pont des Arts with a couple,
§4 new scene to produce). Centred title card at lower third, 90%
semi-opaque cream with brass border, 32px padding: BRASS label-
caps "THE CONCIERGE'S GUIDE", XL charcoal serif H1 "Paris — The
Concierge's guide", italic charcoal Inter subtitle. Meta row
(author, last update, 22 min reading, 12 sources).

Sticky desktop 280px left TOC with 9 numbered sections and active
burgundy scroll-spy.

Right content max-editorial 74rem:

1. 250-300 word editorial intro, Concierge voice, burgundy drop
   cap. Unique angle (little-known fact or precise promise).

2. AEO block "The Concierge's answer" (snippet §3.4).

3. "When to go" section. 300 word body. 12-column monthly cream
   brass-bordered table sub-block (weather, crowds, indicative
   prices, key events).

4. "How to get there" section. 200 word body. Sub-blocks as cream
   brass-bordered cards: air (3 airports + transfer time), rail
   (Eurostar, TGV), accessibility.

5. "Neighbourhoods" section. 200 word intro. 2-column desktop
   grid of 6 neighbourhood cards: real 4:3 photo cream brass-
   bordered frame, italic serif name, 80-word excerpt, BRASS
   label-caps "IDEAL FOR" + keyword.

6. "Our recommended hotels" section. 150-word intro. List of 5
   widened hotel cards (§3.3 variant) with /hotel/[slug] link.
   Burgundy link-style "See all 32 Paris Palaces →" to
   /destination/paris.

7. Interleaved "Concierge's tip" block in the middle (snippet
   §3.5).

8. "Suggested itineraries" section. 3 cream brass-bordered
   itinerary cards with /itineraire/[slug] link.

9. "Must-see POIs" section. 8 cream brass-bordered POI cards
   (real POI photos): 1:1 image cream brass-bordered frame,
   italic serif name, average distance, visit time.

10. "Local glossary" section. Marble #ece5d9 fill block, 48px
    padding. Italic serif H2 "The Concierge's vocabulary". 8-10
    Parisian terms defined (Atout France, Palace, Michelin star,
    Relais & Châteaux, …) as a list with brass-star bullets.

11. FAQ. H2 "Questions from the Concierge". 8-10 brass accordion
    Q/A.

12. EEAT sources at the foot. Brass-star bullet list with dated
    external links.

13. Internal mesh: 3 neighbour guide cards (Versailles,
    Fontainebleau, Reims).

Standard global footer.

Mobile: TOC in bottom sheet via floating burgundy button. Sections
stacked. Cards as horizontal carousels with brass arrows.
```

---

### 2.7 Itinéraire `/itineraire/[slug]`

#### Prompt — FR

```text
Conçois la page d'un itinéraire long-read avec timeline. Exemple :
« Week-end romantique à Paris — 3 jours ».

Fond cream #f5ebd4.

Hero pleine largeur 60vh. ZONE RÉSERVÉE ILLUSTRATION pleine
largeur (scène d'amour vintage façon « Palace Entrance » mais à
Paris, §4 nouvelle scène). Encart titre cream semi-opaque bordure
laiton centré : label-caps LAITON « L'ITINÉRAIRE DU CONCIERGE »,
H1 serif charcoal italic XL « Week-end romantique à Paris — 3
jours », sous-titre Inter italic 1 ligne « Pour un premier voyage
à deux ». Méta-ligne (3 jours, budget indicatif 2 500 € TTC /
personne, saisonnalité, auteur, date).

Sous le hero, bandeau récap horizontal sur 4 colonnes desktop
(stacké mobile), fond marbre #ece5d9 : icône laiton + label
charcoal : Durée, Budget TTC, Saisonnalité idéale, Hôtels
recommandés (2). Séparateurs verticaux laiton entre colonnes.

Bloc carte stylisée. ZONE RÉSERVÉE ILLUSTRATION 16:9 desktop / 4:3
mobile (cadre cream bordure laiton). Carte monochrome cream + laiton
peinte main avec 3 marqueurs numérotés bordeaux (un par jour) reliés
par une ligne pointillée laiton. Style « carte de palace » années
50.

Bloc AEO « La réponse du Concierge » (snippet §3.4).

Timeline verticale du jour 1 au jour 3. Chaque jour =

- Marqueur de jour à gauche : grand cercle laiton 64×64 avec
  numéro de jour en serif XL cream à l'intérieur. Filet laiton
  vertical entre les jours.
- À droite du marqueur : H2 serif italic « Jour 1 — Le Marais et
  le Louvre » + label-caps LAITON « JOUR 1 ».
- Sous le H2, sous-blocs séquentiels matin / déjeuner / après-midi
  / dîner / soir dans cartes cream bordure laiton, chacun avec :
  H3 serif italic, paragraphe Inter 80-120 mots, ligne d'infos
  pratiques avec étoiles laiton comme puces (POI nommé, adresse,
  distance à pied, prix indicatif TTC, lien vers fiche hôtel si
  applicable).
- Carte hôtel recommandé en bas du jour (vraie photo 4:3 + nom
  serif italic + prix + lien vers /hotel/[slug]).

Bloc « Le Conseil du Concierge » entre le jour 2 et le jour 3
(snippet §3.5).

Section « Budget détaillé ». Tableau 2 colonnes cream bordures
laiton : poste, montant TTC. Total en serif XL bordeaux en bas.
Mention « hors vols » italic.

Section « Variantes proposées ». 3 mini-cartes cream bordure laiton
côte à côte (desktop) / empilées (mobile) : « En famille avec
enfants », « Sans dîner gastronomique », « 4 jours au lieu de 3 ».

FAQ. 6 Q/R en accordéon laiton.

CTA final pleine largeur. Fond marbre #ece5d9, padding 80px. ZONE
RÉSERVÉE ILLUSTRATION SPOT 200×200 centrée (variante scène 03
« Concierge's Desk », §4). H2 serif italic centré « Faites-en
l'itinéraire sur-mesure ». Sous-texte Inter italic 1 ligne « Le
Concierge ajuste cet itinéraire à vos envies, vos dates et votre
budget — sans frais ». Bouton primary BORDEAUX large « Contacter
le Concierge ».

Maillage interne. 3 itinéraires voisins en cartes cream bordure
laiton en bas.

Footer global.

Mobile : carte stylisée devient swipeable, timeline reste
verticale, carrousels horizontaux pour les hôtels recommandés.
```

#### Prompt — EN

```text
Design a long-read itinerary page with timeline. Example:
"Romantic weekend in Paris — 3 days".

Cream #f5ebd4 fill.

Full-width hero 60vh. FULL-WIDTH ILLUSTRATION RESERVED ZONE
(vintage romantic scene "Palace Entrance" style but in Paris, new
§4 scene). Centred cream brass-bordered semi-opaque title card:
BRASS label-caps "THE CONCIERGE'S ITINERARY", italic XL charcoal
serif H1 "Romantic weekend in Paris — 3 days", italic Inter 1-line
subtitle "For a first trip à deux". Meta row (3 days, indicative
€2,500 / person tax-incl, seasonality, author, date).

Below the hero, 4-column desktop recap strip (stacked mobile),
marble #ece5d9 fill: brass icon + charcoal label: Duration, Tax-
incl budget, Best season, Recommended hotels (2). Vertical brass
separators between columns.

Stylised map block. 16:9 desktop / 4:3 mobile ILLUSTRATION
RESERVED ZONE (cream brass-bordered frame). Cream + brass hand-
painted monochrome map with 3 numbered burgundy markers (one per
day) linked by a brass dotted line. 1950s "palace map" style.

AEO block "The Concierge's answer" (snippet §3.4).

Day 1 to Day 3 vertical timeline. Each day =

- Day marker left: large 64×64 brass circle with XL cream serif
  day number inside. Vertical brass rule between days.
- Right of the marker: italic serif H2 "Day 1 — Le Marais and the
  Louvre" + BRASS label-caps "DAY 1".
- Under the H2, sequential morning / lunch / afternoon / dinner /
  evening sub-blocks as cream brass-bordered cards, each with:
  italic serif H3, 80-120 word Inter paragraph, practical info
  row with brass-star bullets (named POI, address, walking
  distance, indicative tax-incl price, hotel-fiche link if
  applicable).
- Recommended-hotel card at the day's bottom (real 4:3 photo +
  italic serif name + price + /hotel/[slug] link).

"Concierge's tip" block between Day 2 and Day 3 (snippet §3.5).

"Detailed budget" section. 2-column cream brass-bordered table:
item, tax-incl amount. XL burgundy serif total at the bottom.
Italic "Flights excluded" note.

"Proposed variants" section. 3 cream brass-bordered mini-cards
side-by-side (desktop) / stacked (mobile): "With kids", "Without
fine-dining dinner", "4 days instead of 3".

FAQ. 6 brass accordion Q/A.

Full-width final CTA. Marble #ece5d9 fill, 80px padding. 200×200
SPOT ILLUSTRATION RESERVED ZONE centred (scene 03 "Concierge's
Desk" variant, §4). Centred italic serif H2 "Make this itinerary
your own". Italic Inter 1-line subtext "The Concierge tailors
this itinerary to your wishes, dates and budget — free". Large
BURGUNDY primary button "Contact the Concierge".

Internal mesh. 3 neighbour itinerary cards (cream brass-bordered)
at the bottom.

Standard global footer.

Mobile: stylised map becomes swipeable, timeline stays vertical,
horizontal carousels for recommended hotels.
```

---

### 2.8 Destination `/destination/[citySlug]`

#### Prompt — FR

```text
Conçois la page hub d'une destination. Exemple : Paris. Différent
du guide §2.6 — c'est un hub maillé qui agrège hôtels, classements,
guides, itinéraires et POIs.

Fond cream #f5ebd4.

Hero pleine largeur 55vh. ZONE RÉSERVÉE ILLUSTRATION pleine largeur
(scène de la destination). Encart titre cream semi-opaque bordure
laiton centré : label-caps LAITON « DESTINATION », H1 serif charcoal
XL « Paris », sous-titre Inter italic « 32 Palaces sélectionnés par
le Concierge ».

Bandeau récap horizontal sur 4 colonnes, fond marbre #ece5d9 :
icône laiton + label : Nombre d'hôtels (32), Classements (5),
Guides (3), Itinéraires (4). Séparateurs verticaux laiton.

Intro éditoriale 200 mots max-prose voix Concierge avec drop cap
bordeaux.

Bloc AEO « La réponse du Concierge » (snippet §3.4).

Section « Nos hôtels à Paris ». H2 serif italic. Filtres rapides
en chips (Palaces uniquement, Avec piscine, Avec restaurant
étoilé, Avec vue sur la Seine) — actif = fond bordeaux texte cream.
Grille 3 colonnes desktop de 9 cartes hôtel (§3.3) + bouton ghost
laiton « Voir les 32 hôtels » → /recherche?city=paris.

Section « Nos classements parisiens ». 5 cartes classement
horizontales (vraie photo 16:9, cadre cream bordure laiton, titre
serif italic, extrait, lien link-style bordeaux).

Section « Nos guides Paris ». 3 cartes guide larges (vraie photo
21:9 cadre cream bordure laiton, H2 serif italic, extrait 80 mots,
lien bordeaux).

Section « Nos itinéraires Paris ». 4 cartes itinéraire cream
bordure laiton avec icône laiton durée (1j, week-end, 4j, 1
semaine).

Section « Que voir à Paris ». 8 cartes POI compactes (vraie photo
1:1, cadre cream bordure laiton, nom serif italic, temps de visite,
distance moyenne).

FAQ destination. 6 Q/R accordéon laiton (météo, sécurité, pourboires,
taxe de séjour, langue, devise).

Maillage interne : 3 destinations voisines (Versailles, Reims,
Fontainebleau) en cartes cream bordure laiton.

Footer global.

Mobile : tout empile, carrousels horizontaux pour hôtels et
classements.
```

#### Prompt — EN

```text
Design the destination hub page. Example: Paris. Different from
the §2.6 guide — this is a meshed hub aggregating hotels, rankings,
guides, itineraries and POIs.

Cream #f5ebd4 fill.

Full-width hero 55vh. FULL-WIDTH ILLUSTRATION RESERVED ZONE
(destination scene). Centred cream brass-bordered semi-opaque
title card: BRASS label-caps "DESTINATION", XL charcoal serif H1
"Paris", italic Inter subtitle "32 Palaces curated by the
Concierge".

4-column recap horizontal strip, marble #ece5d9 fill: brass icon
+ label: Number of hotels (32), Rankings (5), Guides (3),
Itineraries (4). Vertical brass separators.

200-word editorial intro, max-prose, Concierge voice, burgundy
drop cap.

AEO block "The Concierge's answer" (snippet §3.4).

"Our hotels in Paris" section. Italic serif H2. Quick chip filters
(Palaces only, With pool, With starred restaurant, With Seine
view) — active = burgundy fill cream text. 3-column desktop grid
of 9 hotel cards (§3.3) + brass ghost button "See all 32 hotels"
→ /search?city=paris.

"Our Paris rankings" section. 5 horizontal ranking cards (real
16:9 photo, cream brass-bordered frame, italic serif title,
excerpt, burgundy link-style).

"Our Paris guides" section. 3 wide guide cards (real 21:9 photo
cream brass-bordered frame, italic serif H2, 80-word excerpt,
burgundy link).

"Our Paris itineraries" section. 4 cream brass-bordered itinerary
cards with brass duration icon (1d, weekend, 4d, 1 week).

"What to see in Paris" section. 8 compact POI cards (real 1:1
photo, cream brass-bordered frame, italic serif name, visit time,
average distance).

Destination FAQ. 6 brass accordion Q/A (weather, safety, tipping,
city tax, language, currency).

Internal mesh: 3 neighbour destinations (Versailles, Reims,
Fontainebleau) in cream brass-bordered cards.

Standard global footer.

Mobile: everything stacks, horizontal carousels for hotels and
rankings.
```

---

### 2.9 Le Concierge `/le-concierge`

#### Prompt — FR

```text
Conçois la page institutionnelle racine du cluster « Le Concierge »
— la page « À propos » réécrite à la voix Concierge. Pas corporate,
pas pompeux, juste précis et humain. C'est la page la plus
illustrée du site.

Fond cream #f5ebd4.

Hero pleine largeur 75vh. Layout 2 colonnes desktop. À gauche 55% :
ZONE RÉSERVÉE ILLUSTRATION pleine hauteur ratio 4:5 (scène 03
« Concierge's Desk » — Concierge derrière son grand bureau acajou,
plan de Paris ouvert, lampe laiton allumée, cf. §4). À droite 45% :
fond cream, padding 80px, contenu vertical-centré : label-caps
LAITON « LE CONCIERGE », H1 serif charcoal XL (clamp 3rem à 5rem)
sur 3 lignes : « Nous ne sommes pas un comparateur. Nous sommes un
Concierge. ». Sous-titre Inter italic charcoal 18px sur 2 lignes :
« Sélection personnelle. Sans affiliation déguisée. Conseil d'un
initié. ». Petit cartouche cream à bordure laiton en bas « AGENT
IATA n° xxxxxxx ». Mobile : illustration en haut pleine largeur
4:3, contenu en dessous centré.

Section « Notre promesse ». 3 colonnes desktop / 1 mobile. Chaque
colonne : ZONE RÉSERVÉE ILLUSTRATION SPOT 240×240 centrée (scènes
§4 — scène 04 « Incognito Visit » pour « Une sélection », scène
05 « Editorial Deliberation » pour « Sans affiliation », scène
07 « Concierge Tip » pour « Conseil d'un initié »), H3 serif
italic centré sous l'illustration, paragraphe Inter 50 mots centré
max-width 300px. Séparateurs verticaux laiton entre colonnes.

Section « Notre méthode en 4 étapes ». Fond marbre #ece5d9 pleine
largeur, padding 96px vertical. Timeline horizontale desktop /
verticale mobile. 4 jalons numérotés en cercles laiton 64×64 avec
chiffre serif XL cream à l'intérieur, reliés par ligne pointillée
laiton. Sous chaque jalon : ZONE RÉSERVÉE ILLUSTRATION 4:3 320×240
(scènes §4 alternées : 03 Veille, 04 Visite, 05 Délibération, 06
Mise à jour), H3 serif italic, paragraphe 60 mots.

Section « L'équipe ». Pleine largeur cream. H2 serif italic
centré « L'équipe du Concierge ». 4 PORTRAITS ILLUSTRÉS 1:1 ZONES
RÉSERVÉES en grille 4 colonnes desktop / 2 mobile (variantes du
personnage Concierge — 2 hommes 2 femmes, diversité d'origines,
même bordeaux, postures différentes selon spécialité). Cadre cream
bordure laiton, label-caps LAITON « PARIS » / « CÔTE D'AZUR » /
« ÉDITORIAL » / « PARTENARIATS » en pied de chaque portrait. Nom
serif italic, rôle Inter 12px, mini-bio 30 mots. Pas de photo —
volontaire, voir §4.

Section « Nos accréditations ». Bandeau fond marbre #ece5d9,
padding 64px. Logos IATA, Atout France, FEVAD, ATR en laiton
gravé (style cachet), séparés par petites étoiles laiton. Lien
discret « Voir nos mentions légales ».

Section « Le cluster ». H2 serif italic « Allez plus loin ». Grille
3 colonnes desktop / 1 mobile de 9 cartes cream bordure laiton
vers les sous-pages : Méthode éditoriale, Presse & Partenaires,
MICE & Séminaires, Pour les hôteliers, Réserver, Newsletter,
Fidélité, Contact, FAQ. Chaque carte : petite icône laiton en
haut, titre serif italic, extrait 25 mots, flèche bordeaux « → ».

Bloc « Le Conseil du Concierge » avant le footer (snippet §3.5).

Footer global.

Mobile : illustration hero passe au-dessus pleine largeur 4:3,
contenu en dessous, équipe en carrousel horizontal, méthode en
timeline verticale.
```

#### Prompt — EN

```text
Design the institutional root page of "The Concierge" cluster —
the "About" page rewritten in the Concierge voice. Not corporate,
not pompous, just precise and human. This is the most-illustrated
page of the site.

Cream #f5ebd4 fill.

Full-width hero 75vh. 2-column desktop layout. Left 55%: FULL-
HEIGHT 4:5 ILLUSTRATION RESERVED ZONE (scene 03 "Concierge's Desk"
— Concierge behind his large mahogany desk, open Paris map, lit
brass lamp, see §4). Right 45%: cream fill, 80px padding,
vertically-centred content: BRASS label-caps "THE CONCIERGE", XL
charcoal serif H1 (clamp 3rem to 5rem) on 3 lines: "We are not a
comparator. We are a Concierge.". 18px italic charcoal Inter
subtitle on 2 lines: "Personal selection. No hidden affiliation.
Insider advice.". Small bottom cream brass-bordered tag "IATA
AGENT no. xxxxxxx". Mobile: illustration above full-width 4:3,
content below centred.

"Our promise" section. 3 desktop columns / 1 mobile. Each column:
240×240 SPOT ILLUSTRATION RESERVED ZONE centred (§4 scenes —
scene 04 "Incognito Visit" for "A selection", scene 05 "Editorial
Deliberation" for "No affiliation", scene 07 "Concierge Tip" for
"Insider advice"), italic centred serif H3 under the illustration,
centred 50-word Inter paragraph, 300px max-width. Vertical brass
separators between columns.

"Our 4-step method" section. Marble #ece5d9 fill full-width, 96px
vertical padding. Horizontal desktop / vertical mobile timeline.
4 numbered milestones as 64×64 brass circles with XL cream serif
number inside, linked by brass dotted line. Under each milestone:
320×240 4:3 ILLUSTRATION RESERVED ZONE (alternated §4 scenes:
03 Watch, 04 Visit, 05 Deliberation, 06 Update), italic serif H3,
60-word paragraph.

"The team" section. Full-width cream. Centred italic serif H2
"The Concierge's team". 4 ILLUSTRATED 1:1 PORTRAIT RESERVED ZONES
in a 4-column desktop / 2-mobile grid (Concierge character
variants — 2 men, 2 women, diverse origins, same burgundy,
postures vary by specialty). Cream brass-bordered frame, BRASS
label-caps "PARIS" / "RIVIERA" / "EDITORIAL" / "PARTNERSHIPS" at
each portrait's foot. Italic serif name, 12px Inter role, 30-word
mini-bio. No photo — intentional, see §4.

"Our accreditations" section. Marble #ece5d9 fill strip, 64px
padding. IATA, Atout France, FEVAD, ATR logos in engraved brass
(seal style), separated by small brass stars. Discreet "See our
legal notices" link.

"The cluster" section. Italic serif H2 "Go further". 3-column
desktop / 1-mobile grid of 9 cream brass-bordered cards to
subpages: Editorial method, Press & Partners, MICE & Seminars,
For hoteliers, Book, Newsletter, Loyalty, Contact, FAQ. Each
card: small brass top icon, italic serif title, 25-word excerpt,
burgundy "→" arrow.

"Concierge's tip" block before the footer (snippet §3.5).

Standard global footer.

Mobile: hero illustration moves above full-width 4:3, content
below, team in horizontal carousel, method in vertical timeline.
```

---

### 2.10 Méthode éditoriale `/le-concierge/methode-editoriale`

#### Prompt — FR

```text
Conçois la page « Méthode éditoriale » — notre page de confiance
EEAT principale. Austère, précise, incontestable. Pas de marketing.
Le ton est celui d'un rapport annuel d'un palace.

Fond cream #f5ebd4. Header global + breadcrumb (Accueil › Le
Concierge › Méthode éditoriale).

Header de page. Pas de hero illustration ici — la sobriété fait
partie du message. Fond cream profond, padding vertical 96px.
Label-caps LAITON « TRANSPARENCE ». H1 serif charcoal XL gauche
« Comment nous choisissons les Palaces que nous recommandons ».
Sous-titre Inter italic charcoal 1 ligne « Une méthode publique,
vérifiable, mise à jour ». Méta-ligne discrète : auteur, dernière
révision, signature « Le Concierge ». Sous le H1, filet laiton
fin avec étoile centrale 12px.

Layout 2 colonnes desktop : sticky TOC à gauche (sections : Nos
sources, Nos critères, Notre processus, Ce que nous refusons,
Conflits d'intérêt, Mises à jour). Contenu max-prose 68ch à droite.

Section 1 — Nos sources. H2 serif italic « Sur quoi nous nous
appuyons ». Texte 200 mots + grille 2 colonnes de 6 cartes cream
bordure laiton avec logos sobres : Atout France (millésime 2026),
Michelin Guide (étoiles + Keys), Relais & Châteaux, Leading Hotels
of the World, Forbes Travel Guide, Tablet Hotels.

Section 2 — Nos critères. H2 « 12 critères, dans cet ordre ». Liste
numérotée verticale, chaque critère en H3 serif italic + 30 mots
d'explication. Numéros de critères en serif XL LAITON italic
(« 01 », « 02 »…) à gauche de chaque H3.

Section 3 — Notre processus. H2 « 4 étapes, sans raccourci ». 4
sous-blocs numérotés avec illustration interleaved : alterner
gauche/droite (étape 1 illustration à droite, étape 2 illustration
à gauche, etc.) pour rythmer la lecture. Chaque sous-bloc =
numéro serif XL LAITON, H3 serif italic, paragraphe 80 mots, ZONE
RÉSERVÉE ILLUSTRATION 4:3 320×240 (scènes §4 — 03 Veille, 04
Visite, 05 Délibération, 06 Mise à jour).

Section 4 — Ce que nous refusons. Bloc fond marbre #ece5d9, padding
48px, bordure gauche BORDEAUX 4px. H2 serif italic « Ce que nous
refusons d'écrire ». Liste à puces étoiles laiton : pas
d'affiliation déguisée, pas de note fabriquée, pas d'indicateur
d'urgence factice, pas de superlatif vide, pas de partenariat
masqué.

Section 5 — Conflits d'intérêt. H2 « Notre transparence
financière ». Texte 150 mots expliquant le modèle.

Section 6 — Mises à jour. H2 « Comment nous restons à jour ». Texte
100 mots + petit tableau cream bordures laiton (Fiche hôtel :
trimestrielle, Classement : annuelle, Guide : annuelle, Itinéraire :
selon retours clients).

Bloc « Le Conseil du Concierge » version méthode : « Mon conseil :
vérifiez nos sources, contestez nos choix, écrivez-nous. » (snippet
§3.5).

Footer global.

Mobile : TOC en bottom sheet via bouton bordeaux flottant. Le
reste empile.
```

#### Prompt — EN

```text
Design the "Editorial method" page — our primary EEAT trust page.
Austere, precise, undisputable. No marketing. Tone of a palace's
annual report.

Cream #f5ebd4 fill. Global header + breadcrumb (Home › The
Concierge › Editorial method).

Page header. No hero illustration here — soberness is part of the
message. Deep cream fill, 96px vertical padding. BRASS label-caps
"TRANSPARENCY". Left XL charcoal serif H1 "How we choose the
Palaces we recommend". Italic charcoal Inter 1-line subtitle "A
public, verifiable, updated method". Discreet meta row: author,
last revision, "The Concierge" signature. Under the H1, thin brass
rule with 12px central star.

2-column desktop layout: left sticky TOC (sections: Our sources,
Our criteria, Our process, What we refuse, Conflicts of interest,
Updates). Right max-prose 68ch content.

Section 1 — Our sources. Italic serif H2 "What we rely on". 200
word body + 2-column grid of 6 cream brass-bordered cards with
sober logos: Atout France (2026 vintage), Michelin Guide (stars +
Keys), Relais & Châteaux, Leading Hotels of the World, Forbes
Travel Guide, Tablet Hotels.

Section 2 — Our criteria. H2 "12 criteria, in this order".
Vertical numbered list, each criterion as italic serif H3 + 30
word explanation. Criterion numbers as XL BRASS italic serif
("01", "02"…) left of each H3.

Section 3 — Our process. H2 "4 steps, no shortcuts". 4 numbered
sub-blocks with interleaved illustration: alternate left/right
(step 1 illustration right, step 2 illustration left, etc.) to
rhythm the reading. Each sub-block = XL BRASS serif number,
italic serif H3, 80 word paragraph, 320×240 4:3 ILLUSTRATION
RESERVED ZONE (§4 scenes — 03 Watch, 04 Visit, 05 Deliberation,
06 Update).

Section 4 — What we refuse. Marble #ece5d9 fill block, 48px
padding, BURGUNDY 4px left border. Italic serif H2 "What we
refuse to write". Brass-star bullet list: no hidden affiliation,
no fabricated rating, no fake urgency indicator, no empty
superlative, no masked partnership.

Section 5 — Conflicts of interest. H2 "Our financial
transparency". 150 word body explaining the model.

Section 6 — Updates. H2 "How we stay up-to-date". 100 word body
+ small cream brass-bordered table (Hotel fiche: quarterly,
Ranking: annual, Guide: annual, Itinerary: per client feedback).

Method-version "Concierge's tip" block: "My tip: check our
sources, challenge our choices, write to us." (snippet §3.5).

Standard global footer.

Mobile: TOC in bottom sheet via burgundy floating button. The
rest stacks.
```

---

### 2.11 Connexion `/compte/connexion`

#### Prompt — FR

```text
Conçois la page de connexion compte. Formulaire centré, expérience
rassurante, illustration dominante.

Fond cream #f5ebd4. Header global minimal (logo serif charcoal
centré seul, pas de nav, pas de fond). Pas de breadcrumb.

Layout 2 colonnes desktop, 1 mobile :
- Colonne gauche 50% : pleine hauteur 100vh. ZONE RÉSERVÉE
  ILLUSTRATION verticale 3:4 pleine hauteur (scène 02 « Brass
  Phone Reception » — Concierge au téléphone laiton à la réception
  avec cliente élégante au comptoir marbre, cf.
  ./references/concierge-illustration-style-02-reception-desk.png
  et §4). PAS de photo. En surimpression bas-gauche sur la zone
  basse (sans masquer les visages), citation italique serif 12
  mots cream sur fond charcoal flou semi-transparent 70% :
  « La discrétion est le premier des services. — Le Concierge ».
- Colonne droite 50% : fond cream profond, formulaire centré
  verticalement, max-width 420px, padding 80px.

Contenu colonne droite :
- Label-caps LAITON « VOTRE ESPACE » en haut
- H1 serif italic charcoal « Bon retour » (pas « Connectez-vous »)
- Sous-titre Inter italic charcoal opacity 75% 14px « Retrouvez
  vos favoris et vos recommandations »
- Filet laiton fin avec étoile centrale 12px en séparation
- Formulaire :
  - Input email (label-caps LAITON au-dessus, fond #fffaf0,
    bordure laiton 1px, focus ring bordeaux 2px)
  - Input password (icône œil laiton pour show/hide)
  - Lien link-style bordeaux discret droite « Mot de passe
    oublié ? »
- Bouton primary BORDEAUX pleine largeur « Se connecter »
- Séparateur fin laiton avec « ou » centré en label-caps
- 2 boutons OAuth pleine largeur ghost (bordure laiton, fond
  transparent) : Google, Apple. Icône line-art LAITON à gauche,
  texte charcoal centré.
- Lien sous formulaire centré « Pas encore client ? » + lien
  bordeaux « Créer un compte »

Trust signals discrets en pied de colonne droite, 3 mini-blocs
en ligne, icône laiton + label charcoal 12px : cadenas « Connexion
sécurisée », bouclier « Données chiffrées », plaque IATA « Agent
IATA ».

Mention RGPD 12px italic charcoal opacity 65% en tout bas.

Mobile : colonne gauche disparaît, formulaire prend toute la
largeur, illustration en haut rétrécie en 16:9 avec citation en
overlay.

Pas de pop-up. Pas de captcha visible (Turnstile invisible). Pas
d'erreur agressive rouge plein — utiliser un fond rose poudré
#f4c6c1 très clair avec icône warning laiton et texte précis.
```

#### Prompt — EN

```text
Design the account login page. Centred form, reassuring experience,
dominant illustration.

Cream #f5ebd4 fill. Minimal global header (centred-only charcoal
serif logo, no nav, no background). No breadcrumb.

2-column desktop layout, 1-mobile:
- Left 50%: 100vh full height. FULL-HEIGHT VERTICAL 3:4
  ILLUSTRATION RESERVED ZONE (scene 02 "Brass Phone Reception" —
  Concierge on brass phone at reception with elegant client at
  marble counter, see
  ./references/concierge-illustration-style-02-reception-desk.png
  and §4). NO photo. Overlaid bottom-left on the lower area
  (without covering faces), 12-word italic serif quote, cream on
  blurry semi-transparent charcoal 70%: "Discretion is the first
  of services. — The Concierge".
- Right 50%: deep cream fill, vertically-centred form, 420px max-
  width, 80px padding.

Right column content:
- BRASS label-caps "YOUR SPACE" at top
- Italic charcoal serif H1 "Welcome back" (not "Sign in")
- 14px italic charcoal Inter 75% opacity subtitle "Find your
  favourites and your recommendations"
- Thin brass rule with 12px central star as separator
- Form:
  - Email input (BRASS label-caps above, #fffaf0 fill, brass 1px
    border, burgundy 2px focus ring)
  - Password input (brass eye icon for show/hide)
  - Discreet right-aligned burgundy link-style "Forgot password?"
- Full-width BURGUNDY primary button "Sign in"
- Thin brass separator with centred "or" in label-caps
- 2 full-width ghost OAuth buttons (brass border, transparent
  fill): Google, Apple. BRASS line-art icon left, charcoal centred
  text.
- Centred link below form "Not a client yet?" + burgundy link
  "Create an account"

Discreet trust signals at the right-column foot, 3 inline mini-
blocks, brass icon + 12px charcoal label: padlock "Secure
connection", shield "Encrypted data", IATA plate "IATA agent".

12px italic charcoal 65% opacity GDPR notice at the very bottom.

Mobile: left column disappears, form takes full width, shrunk 16:9
top illustration with overlay quote.

No pop-up. No visible captcha (invisible Turnstile). No aggressive
full-red error — use a very-light powder pink #f4c6c1 fill with a
brass warning icon and precise text.
```

---

### 2.12 Réservation — Démarrage `/reservation/start`

> Shell visuel uniquement. Phase 6 booking gelée, voir
> [`AGENTS.md`](../../AGENTS.md) §4ter.

#### Prompt — FR

```text
Conçois la première étape du tunnel de réservation. Vue d'ensemble
avant paiement.

Fond cream #f5ebd4. Header simplifié (logo serif charcoal centré +
sélecteur langue cream bordure laiton droite, pas de nav). Stepper
horizontal au-dessus de la page : étape 1/4 « Récap », 2/4
« Voyageur », 3/4 « Paiement », 4/4 « Confirmation ». Cercles
laiton 32×32 numérotés cream, ligne pointillée laiton entre eux.
Étape 1 active = cercle BORDEAUX.

Layout 2 colonnes desktop, 1 mobile :
- Colonne gauche 60% : formulaire principal
- Colonne droite 40% : carte récap sticky

Colonne gauche, sections en cartes cream bordure laiton :

1. Bloc d'intro. H1 serif italic « Vérifions votre choix ». Texte
   Inter 2 lignes « Nous gardons cette offre 10 minutes le temps
   de finaliser. ». Petite étoile laiton sous le H1.

2. Carte « Votre séjour ». Vraie photo hôtel 16:9 cadre cream
   bordure laiton + à droite : nom serif italic, ville Inter italic,
   étoiles, dates, chambre, voyageurs. Liens link-style bordeaux
   « Changer les dates », « Changer la chambre ».

3. Section « Voyageur principal ». H2 serif italic. Formulaire en
   grille 2 colonnes desktop : civilité (radios cream bordure
   laiton), prénom, nom, email, téléphone (préfixe pays), date de
   naissance, nationalité. Tous les inputs cream bordure laiton.

4. Section « Demandes spéciales ». H2 serif italic. Textarea cream
   limité à 500 caractères avec compteur. Suggestions en chips
   cream bordure laiton cliquables (lit king, allergie alimentaire,
   étage élevé, anniversaire, anniversaire de mariage, retard
   d'arrivée). Actif = fond bordeaux texte cream.

5. Section « Conditions ». 2 cases à cocher cream bordure laiton :
   CGV, politique de confidentialité.

6. Bouton primary BORDEAUX pleine largeur « Continuer vers le
   paiement ». Sous le bouton, mention italic charcoal opacity 65%
   12px « Pas de débit à cette étape. ».

Colonne droite, carte récap sticky cream bordure laiton, padding
24px, top sticky 100px :
- Label-caps LAITON « VOTRE RÉSERVATION » en haut avec petite
  étoile
- Mini-image hôtel 1:1 cadre cream bordure laiton
- Nom hôtel serif italic + ville Inter italic
- Dates : « 12 — 15 mars 2026 (3 nuits) »
- Chambre : « Suite Belle Étoile »
- Voyageurs : « 2 adultes »
- Filet laiton fin
- Détail tarif :
  - « 3 nuits × 1 290 € » Inter
  - « Taxe de séjour incluse » italic
- Total en serif XL BORDEAUX « 3 870 € TTC »
- Mention italic 12px « Annulation gratuite jusqu'au 9 mars 2026 »
- Mention italic 12px « Aucune commission cachée — agent IATA »

Mobile : carte récap en haut, formulaire en bas. Stepper compact
en haut.

Pas d'urgence. Pas de cross-sell agressif à cette étape (assurance,
transferts arrivent à la confirmation si applicable).
```

#### Prompt — EN

```text
Design the first booking-funnel step. Overview before payment.

Cream #f5ebd4 fill. Simplified header (centred charcoal serif
logo + cream brass-bordered language switch right, no nav).
Horizontal stepper above the page: step 1/4 "Recap", 2/4
"Traveller", 3/4 "Payment", 4/4 "Confirmation". 32×32 brass
numbered cream circles, brass dotted line between them. Active
step 1 = BURGUNDY circle.

2-column desktop layout, 1-mobile:
- Left 60%: main form
- Right 40%: sticky recap card

Left column, sections as cream brass-bordered cards:

1. Intro block. Italic serif H1 "Let's check your choice". 2-line
   Inter body "We hold this offer for 10 minutes while you
   finalise.". Small brass star under H1.

2. "Your stay" card. Real 16:9 hotel photo, cream brass-bordered
   frame + right: italic serif name, italic Inter city, stars,
   dates, room, travellers. Burgundy link-style "Change dates",
   "Change room".

3. "Primary traveller" section. Italic serif H2. 2-column desktop
   grid form: title (cream brass-bordered radios), first name,
   last name, email, phone (country prefix), date of birth,
   nationality. All inputs cream brass-bordered.

4. "Special requests" section. Italic serif H2. Cream textarea
   limited to 500 chars with counter. Cream brass-bordered
   clickable chip suggestions (king bed, food allergy, high floor,
   birthday, wedding anniversary, late arrival). Active = burgundy
   fill cream text.

5. "Terms" section. 2 cream brass-bordered checkboxes: T&C, privacy
   policy.

6. Full-width BURGUNDY primary button "Continue to payment". 12px
   italic charcoal 65% subtext under the button "No charge at this
   step.".

Right column, sticky cream brass-bordered recap card, 24px padding,
sticky top 100px:
- BRASS label-caps "YOUR RESERVATION" at top with small star
- Mini 1:1 hotel image, cream brass-bordered frame
- Italic serif hotel name + italic Inter city
- Dates: "12 — 15 March 2026 (3 nights)"
- Room: "Belle Étoile Suite"
- Travellers: "2 adults"
- Thin brass rule
- Rate detail:
  - "3 nights × €1,290" Inter
  - "City tax included" italic
- XL BURGUNDY serif total "€3,870 tax-incl"
- Italic 12px "Free cancellation until 9 March 2026"
- Italic 12px "No hidden commission — IATA agent"

Mobile: recap card on top, form below. Compact top stepper.

No urgency. No aggressive cross-sell at this step (insurance,
transfers come at confirmation if applicable).
```

---

### 2.13 Réservation — Paiement `/reservation/payment`

#### Prompt — FR

```text
Conçois l'étape paiement du tunnel. Shell visuel — l'iframe
Amadeus Payments est représentée par une ZONE RÉSERVÉE.

Fond cream #f5ebd4. Header simplifié + stepper, étape 3/4 active
(cercle BORDEAUX).

Layout 2 colonnes desktop comme §2.12.

Colonne gauche 60%, cartes cream bordure laiton :

1. H1 serif italic « Réglez votre séjour en toute sécurité ».
   Petite étoile laiton.

2. Carte « Voyageur ». Récap concis (nom, email, téléphone). Lien
   link-style bordeaux « Modifier ».

3. Section « Mode de paiement ». H2 serif italic. 3 onglets cream
   bordure laiton (actif = fond bordeaux texte cream) : « Carte
   bancaire », « Apple Pay », « Google Pay ». Sous les onglets,
   ZONE RÉSERVÉE Amadeus iframe : rectangle cream bordure laiton
   pointillée 2px, hauteur 320px, label centré italique « ZONE
   SÉCURISÉE — Formulaire Amadeus Payments (PCI DSS, 3DS2) ».
   Reste fonctionnellement vide dans la maquette.

4. Section « Garanties ». 4 mini-blocs en ligne en cartes cream
   bordure laiton avec icône LAITON line-art : « Paiement chiffré
   SSL », « Conforme 3D Secure 2 », « PCI DSS niveau 1 », « Aucune
   donnée stockée chez nous ».

5. Section « Conditions finales ». Check cream bordure laiton
   « J'accepte les conditions d'annulation ».

6. Bouton accent LAITON CHAUD pleine largeur (réservé aux CTA
   finaux comme payer) « Confirmer et payer 3 870 € TTC ». Sous le
   bouton, mention italic charcoal opacity 65% 12px « Vous serez
   débité au moment de la confirmation. ».

Colonne droite : carte récap identique à §2.12 mais verrouillée
(liens « Changer » disparaissent). En haut, étiquette laiton
épinglée « OFFRE GARDÉE — expire dans 07:42 » (compteur descendant
statique dans la maquette).

Mobile : récap en haut, paiement en bas. Stepper compact.

Important : la zone iframe est explicitement labellée « ZONE
RÉSERVÉE AMADEUS PAYMENTS » pour empêcher Stitch de générer un
faux formulaire CB (PCI scope-out non négociable).
```

#### Prompt — EN

```text
Design the payment funnel step. Visual shell — the Amadeus Payments
iframe is represented by a RESERVED ZONE.

Cream #f5ebd4 fill. Simplified header + stepper, step 3/4 active
(BURGUNDY circle).

2-column desktop layout, same as §2.12.

Left column 60%, cream brass-bordered cards:

1. Italic serif H1 "Pay for your stay securely". Small brass
   star.

2. "Traveller" card. Concise recap (name, email, phone). Burgundy
   link-style "Edit".

3. "Payment method" section. Italic serif H2. 3 cream brass-
   bordered tabs (active = burgundy fill cream text): "Card",
   "Apple Pay", "Google Pay". Under the tabs, Amadeus iframe
   RESERVED ZONE: cream rectangle, dotted 2px brass border, 320px
   tall, italic centred label "SECURE ZONE — Amadeus Payments form
   (PCI DSS, 3DS2)". Functionally empty in the mock.

4. "Guarantees" section. 4 inline mini-blocks as cream brass-
   bordered cards with BRASS line-art icon: "SSL-encrypted
   payment", "3D Secure 2 compliant", "PCI DSS level 1", "No data
   stored on our side".

5. "Final terms" section. Cream brass-bordered checkbox "I accept
   the cancellation conditions".

6. Full-width WARM BRASS accent button (reserved for final CTAs
   like pay) "Confirm and pay €3,870 tax-incl". 12px italic
   charcoal 65% subtext under the button "You will be charged on
   confirmation.".

Right column: recap card identical to §2.12 but locked ("Change"
links removed). At the top, pinned brass tag "OFFER HELD —
expires in 07:42" (static descending counter in the mock).

Mobile: recap on top, payment below. Compact stepper.

Important: the iframe zone is explicitly labelled "RESERVED
AMADEUS PAYMENTS ZONE" to prevent Stitch from generating a fake
CC form (PCI scope-out is non-negotiable).
```

---

### 2.14 Réservation — Confirmation `/reservation/confirmation/[ref]`

#### Prompt — FR

```text
Conçois la page de confirmation post-paiement. Calme, claire,
rassurante. Pas d'euphorie publicitaire. Le Concierge a pris la
main.

Fond cream #f5ebd4. Header simplifié + stepper. Étape 4/4 active
(cercle BORDEAUX). Toutes les autres étapes en cercles cream
bordure laiton avec coche LAITON.

Pleine largeur, max-editorial 74rem centré, padding vertical 80px.

1. En haut, ZONE RÉSERVÉE ILLUSTRATION centrée max-width 560px
   ratio 4:3 (scène 08 « Reservation Confirmation » — Concierge
   avec plateau argenté portant enveloppe scellée, légère révérence,
   cf. §4). Cadre cream bordure laiton. PAS de coche émoji, PAS de
   confettis, PAS d'animation. La scène incarne « c'est fait, je
   m'en occupe ».

2. Label-caps LAITON centré sous l'illustration « C'EST CONFIRMÉ »
   avec petites étoiles laiton de chaque côté.

3. H1 serif italic charcoal XL centré « Bon séjour, Madame Lefebvre. »
   (utilise le nom du voyageur en variable). Pas « Félicitations ! »,
   pas « Bravo ! ».

4. Sous-titre Inter italic 16px charcoal centré « Référence de
   votre réservation : » suivi de la ref serif XL bordeaux
   « BST-2026-03847 ». Bouton ghost discret « Copier la
   référence » à côté.

5. Bloc « Récap de votre séjour ». Carte centrée cream bordure
   laiton, padding 32px. Mini-image hôtel + nom serif italic +
   ville + dates + chambre + voyageurs + total payé TTC en serif
   XL BORDEAUX. Tableau ligne par ligne avec filets laiton.

6. Bloc « Prochaines étapes ». H2 serif italic centré. Timeline
   horizontale 3 jalons (cercles laiton numérotés cream) reliés
   par ligne pointillée laiton :
   - « Aujourd'hui : email de confirmation »
   - « J-3 : email de pré-arrivée du Concierge avec
     recommandations »
   - « Après le séjour : email post-stay pour partager vos
     impressions »

7. Bloc « Préparez votre séjour ». 3 cartes horizontales cream
   bordure laiton :
   - « Ajouter à mon calendrier » (boutons ghost Google / Apple /
     Outlook line-art laiton)
   - « Consulter le guide de Paris » (lien bordeaux /guide/paris)
   - « Itinéraires recommandés » (lien bordeaux /itineraire/[slug])

8. Bloc CTA Concierge final. Fond marbre #ece5d9, padding 48px.
   ZONE RÉSERVÉE ILLUSTRATION SPOT 200×200 centrée (variante scène
   03, §4). H2 serif italic « Une demande particulière ? ». Texte
   Inter 50 mots. Bouton primary BORDEAUX « Contacter le
   Concierge ».

9. Bloc « Partager » discret en bas. Icônes line-art LAITON :
   email, WhatsApp, copier le lien. Pas de Facebook/Twitter
   bruyants. Pas de share viral.

Footer global standard.

Mobile : tout empile naturellement, timeline reste verticale,
illustration hero en 4:3 plus petite.

Pas d'auto-redirect. Pas de pop-up newsletter qui surgit. Pas
d'upsell agressif. Le ton = lettre manuscrite du Concierge.
```

#### Prompt — EN

```text
Design the post-payment confirmation page. Calm, clear,
reassuring. No promotional euphoria. The Concierge has taken over.

Cream #f5ebd4 fill. Simplified header + stepper. Step 4/4 active
(BURGUNDY circle). All other steps as cream brass-bordered
circles with BRASS tick.

Full width, centred max-editorial 74rem, 80px vertical padding.

1. Top: 4:3 ILLUSTRATION RESERVED ZONE centred, 560px max-width
   (scene 08 "Reservation Confirmation" — Concierge with silver
   tray bearing a sealed envelope, slight bow, see §4). Cream
   brass-bordered frame. NO emoji tick, NO confetti, NO animation.
   Scene embodies "it is done, I am taking care of it".

2. Centred BRASS label-caps under the illustration "CONFIRMED"
   with small brass stars on either side.

3. Centred XL italic charcoal serif H1 "Enjoy your stay, Ms
   Lefebvre." (use the traveller's name as a variable). Not
   "Congratulations!", not "Bravo!".

4. Centred 16px italic Inter charcoal subtitle "Reservation
   reference:" followed by XL burgundy serif ref "BST-2026-03847".
   Discreet ghost "Copy reference" button next to it.

5. "Stay recap" block. Centred cream brass-bordered card, 32px
   padding. Mini hotel image + italic serif name + city + dates +
   room + travellers + XL BURGUNDY serif total tax-incl. Row-by-
   row table with brass rules.

6. "Next steps" block. Centred italic serif H2. Horizontal 3-
   milestone timeline (brass numbered cream circles) linked by
   brass dotted line:
   - "Today: confirmation email"
   - "D-3: Concierge pre-arrival email with recommendations"
   - "After the stay: post-stay email to share your impressions"

7. "Prepare your stay" block. 3 horizontal cream brass-bordered
   cards:
   - "Add to calendar" (ghost brass line-art Google / Apple /
     Outlook buttons)
   - "Read the Paris guide" (burgundy link /guide/paris)
   - "Recommended itineraries" (burgundy link /itineraire/[slug])

8. Final Concierge CTA block. Marble #ece5d9 fill, 48px padding.
   200×200 SPOT ILLUSTRATION RESERVED ZONE centred (scene 03
   variant, §4). Italic serif H2 "A special request?". 50-word
   Inter body. BURGUNDY primary button "Contact the Concierge".

9. Discreet bottom "Share" block. BRASS line-art icons: email,
   WhatsApp, copy link. No loud Facebook/Twitter. No viral share.

Standard global footer.

Mobile: everything stacks naturally, timeline stays vertical,
smaller 4:3 hero illustration.

No auto-redirect. No spontaneous newsletter pop-up. No aggressive
upsell. Tone = handwritten letter from the Concierge.
```

---

### 2.15 Page legal générique

> Template unique pour `/mentions-legales`, `/cgv`,
> `/confidentialite`, `/cookies`. Adapter titre et contenu.

#### Prompt — FR

```text
Conçois le template de page légale. Sobre, lisible, scannable.
Couvre 4 routes : /mentions-legales, /cgv, /confidentialite,
/cookies. Le ton = papier officiel de palace, pas avocat austère.

Fond cream #f5ebd4. Header global standard + breadcrumb (Accueil ›
Mentions légales).

Header de page. Pas de hero illustration. Fond cream profond,
padding vertical 80px. Label-caps LAITON « MENTIONS LÉGALES ». H1
serif italic charcoal XL gauche. Méta-ligne discrète Inter italic
14px charcoal opacity 75% « Mis à jour le 15 mars 2026 ». Filet
laiton fin avec étoile centrale sous le H1.

Layout 2 colonnes desktop, 1 mobile :
- Gauche 280px : sticky TOC label-caps LAITON « SOMMAIRE » + 8-12
  entrées numérotées avec ancre. Conteneur cream bordure laiton.
  Scroll-spy actif en BORDEAUX. lg+ uniquement.
- Droite : contenu prose max-prose 68ch.

Contenu :
- H2 serif italic numérotés (1. Éditeur, 2. Hébergeur, 3.
  Propriété intellectuelle, 4. Données personnelles, 5. Cookies,
  6. Responsabilité, 7. Loi applicable…). Numéros en serif XL
  LAITON italic à gauche de chaque H2.
- Paragraphes courts, listes à puces avec étoiles laiton comme
  puces.
- Tableaux simples cream bordures laiton si nécessaire (ex : liste
  cookies — nom, finalité, durée).
- Liens externes soulignés bordeaux.

Bloc contact en bas du contenu. Fond marbre #ece5d9, padding 24px,
max-prose, bordure gauche BORDEAUX 4px. Avatar Concierge 48×48 à
gauche. H3 serif italic « Une question sur ces conditions ? ». 1
ligne de texte + bouton ghost laiton « Nous contacter ».

Footer global standard.

Mobile : TOC en bottom sheet via bouton bordeaux flottant
« Sommaire » bas-droite. Le reste empile.

Pas de pop-up cookie permanent (le banner cookie est ailleurs).
Pas de fond noir intimidant. La page doit donner envie d'être lue.
```

#### Prompt — EN

```text
Design the legal page template. Sober, readable, scannable. Covers
4 routes: /mentions-legales, /cgv, /confidentialite, /cookies.
Tone = palace's official paper, not austere lawyer.

Cream #f5ebd4 fill. Standard global header + breadcrumb (Home ›
Legal notices).

Page header. No hero illustration. Deep cream fill, 80px vertical
padding. BRASS label-caps "LEGAL NOTICES". Left XL italic charcoal
serif H1. Discreet 14px italic charcoal 75% opacity Inter meta
row "Updated 15 March 2026". Thin brass rule with central star
under the H1.

2-column desktop layout, 1-mobile:
- Left 280px: sticky TOC BRASS label-caps "CONTENTS" + 8-12
  numbered anchor entries. Cream brass-bordered container. Active
  BURGUNDY scroll-spy. lg+ only.
- Right: max-prose 68ch prose content.

Content:
- Numbered italic serif H2 (1. Publisher, 2. Host, 3. Intellectual
  property, 4. Personal data, 5. Cookies, 6. Liability, 7.
  Applicable law…). XL BRASS italic serif numbers left of each H2.
- Short paragraphs, brass-star bullet lists.
- Simple cream brass-bordered tables if needed (e.g. cookie list
  — name, purpose, duration).
- Burgundy-underlined external links.

Contact block at the content foot. Marble #ece5d9 fill, 24px
padding, max-prose, BURGUNDY 4px left border. 48×48 Concierge
avatar left. Italic serif H3 "A question about these terms?". 1
line of body + brass ghost button "Contact us".

Standard global footer.

Mobile: TOC in bottom sheet via bottom-right floating burgundy
"Contents" button. Rest stacks.

No persistent cookie pop-up (cookie banner lives elsewhere). No
intimidating black fill. The page should feel inviting to read.
```

---

## 3. Snippets composants réutilisables

> À injecter dans Stitch quand on isole un composant après le prompt
> système §1.

### 3.1 Header sticky

#### Snippet — FR

```text
Conçois un header sticky pour MyConciergeHotel.com. Hauteur 72px,
fond CREAM #f5ebd4 (pas transparent même au top — on est dans le
monde papier vintage). Logo serif « MyConciergeHotel » charcoal à
gauche (poids 400, letter-spacing -0.01em), petit filet laiton
1px de 120px sous le logo qui souligne le nom. Nav centrale 5
entrées (Destinations, Classements, Guides, Itinéraires, Le
Concierge) Inter 14px charcoal, espacement 32px, ligne hover
BORDEAUX 1px sous l'item. À droite : icône loupe LAITON line-art
(44×44 touch target) + icône compte LAITON (44×44). Au scroll >
16px, ajouter fin filet laiton 1px en bas du header. Mobile (<
1024px) : hamburger LAITON à gauche, logo centré, icône compte
LAITON à droite.

Pas de panier. Pas de bouton « Réserver ». Pas de bandeau promo.
```

#### Snippet — EN

```text
Design a sticky header for MyConciergeHotel.com. 72px tall, CREAM
#f5ebd4 fill (not transparent even at top — we live in the vintage
paper world). Charcoal serif "MyConciergeHotel" logo left (weight
400, -0.01em letter-spacing), 120px small brass 1px rule under the
logo underlining the name. Centre nav 5 entries (Destinations,
Rankings, Guides, Itineraries, The Concierge) in 14px charcoal
Inter, 32px spacing, BURGUNDY 1px hover rule under the item.
Right: BRASS line-art search icon (44×44 touch target) + BRASS
account icon (44×44). On scroll > 16px, add thin brass 1px rule
at header bottom. Mobile (< 1024px): BRASS hamburger left, centred
logo, BRASS account icon right.

No cart. No "Book" button. No promo strip.
```

### 3.2 Footer 4 colonnes

#### Snippet — FR

```text
Conçois un footer 4 colonnes pour MyConciergeHotel.com. Fond
WALNUT #6e4a2e (seul gros aplat sombre du site, en pied
uniquement). Texte cream #f5ebd4. Padding vertical 96px desktop /
64px mobile. Container max 1440px centré.

En haut, ligne avec logo serif cream à gauche, signature italic
cream opacity 80% à droite « Agent IATA — Distinction Atout
France 2026 ».

4 colonnes desktop équilibrées :
1. « LE CONCIERGE » (label-caps LAITON titre) — links Inter 14px
   cream : Qui sommes-nous, Méthode éditoriale, Presse &
   Partenaires, MICE & Séminaires, Pour les hôteliers
2. « DESTINATIONS » — Paris, Côte d'Azur, Provence, Alpes,
   Bourgogne, Bretagne
3. « INSPIRATIONS » — Classements, Guides, Itinéraires, Newsletter
4. « COMPTE & LÉGAL » — Mon compte, CGV, Confidentialité, Cookies,
   Mentions légales

Liens hover : underline laiton.

Sous les 4 colonnes, séparateur fin laiton avec étoile centrale.
Bandeau bas inline : logos IATA + Atout France en cream à gauche
(niveaux de cream uniquement), copyright cream « © 2026
MyConciergeHotel » centré, sélecteur langue FR/EN cream link-style
avec chevron à droite.

Mobile : 4 colonnes deviennent accordéons empilés (label-caps
LAITON + chevron LAITON).
```

#### Snippet — EN

```text
Design a 4-column footer for MyConciergeHotel.com. WALNUT #6e4a2e
fill (the only large dark surface on the site, foot only). Cream
#f5ebd4 text. 96px desktop / 64px mobile vertical padding. Centred
container max 1440px.

Top row with cream serif logo left, italic cream 80% opacity
signature right "IATA Agent — Atout France 2026 Distinction".

4 balanced desktop columns:
1. "THE CONCIERGE" (BRASS label-caps title) — 14px cream Inter
   links: About us, Editorial method, Press & Partners, MICE &
   Seminars, For hoteliers
2. "DESTINATIONS" — Paris, Riviera, Provence, Alps, Burgundy,
   Brittany
3. "INSPIRATIONS" — Rankings, Guides, Itineraries, Newsletter
4. "ACCOUNT & LEGAL" — My account, T&C, Privacy, Cookies, Legal
   notices

Link hover: brass underline.

Below the 4 columns, thin brass separator with central star. Inline
bottom strip: cream IATA + Atout France logos left (cream-only),
centred cream "© 2026 MyConciergeHotel" copyright, cream FR/EN
link-style switch with chevron right.

Mobile: 4 columns become stacked accordions (BRASS label-caps +
BRASS chevron).
```

### 3.3 Carte hôtel

#### Snippet — FR

```text
Conçois une carte hôtel réutilisable. Format vertical par défaut.
Largeur 360px, fond CREAM #f5ebd4, bordure LAITON 1px #b88a4d,
radius 4px. Pas d'ombre dure — au plus voile cream très subtil
au hover.

Structure top-down :
- Vraie photo hôtel 4:3 en haut. Cadre cream avec marge 8px tout
  autour de la photo (le cream se voit autour de la photo, comme
  un passe-partout). Coin haut-droit : icône cœur favori LAITON
  line-art 28×28 sur petit fond cream rond.
- Padding 20px contenu :
  - Étoiles dorées + badge label-caps cream-sur-BORDEAUX
    « PALACE » si applicable, espacés 8px (sur 1 ligne)
  - Nom hôtel serif italic charcoal 20px weight 400 (2 lignes max,
    ellipsis)
  - Ville Inter italic 14px charcoal opacity 70%
  - Filet laiton fin 1px
  - Mini-extrait factuel Inter 14px charcoal 2 lignes max,
    ellipsis
  - Filet laiton fin 1px
  - Ligne tarif : « à partir de » Inter italic 12px charcoal
    opacity 70% + « 1 290 € TTC » serif italic 18px BORDEAUX +
    « / nuit » Inter italic 12px charcoal opacity 70%
  - Bouton ghost pleine largeur bordure laiton 1px « Voir la
    fiche » (44px hauteur, hover fond marbre #ece5d9)

Variante horizontale (pour /recherche, /destination, /guide) :
photo 16:10 à gauche sur 40%, contenu à droite sur 60% en padding
24px.

Variante chambre (pour fiche hôtel bloc 5) : identique à la
verticale, mais le nom est en italic, et il y a une métadonnée
m²+capacité entre le nom et l'extrait.
```

#### Snippet — EN

```text
Design a reusable hotel card. Vertical format by default. 360px
wide, CREAM #f5ebd4 fill, 1px BRASS #b88a4d border, 4px radius.
No hard shadow — at most a very subtle cream hover veil.

Top-down structure:
- Real 4:3 hotel photo at top. Cream frame with 8px margin around
  the photo (cream visible around the photo, like a mat). Top-
  right corner: 28×28 BRASS line-art favourite heart icon on a
  small round cream fill.
- 20px content padding:
  - Gold stars + cream-on-BURGUNDY label-caps "PALACE" badge if
    applicable, 8px spacing (1 line)
  - 20px italic charcoal serif hotel name weight 400 (max 2 lines,
    ellipsis)
  - 14px italic Inter charcoal 70% city
  - Thin 1px brass rule
  - 14px Inter charcoal factual mini-excerpt, max 2 lines, ellipsis
  - Thin 1px brass rule
  - Rate row: 12px italic Inter charcoal 70% "from" + 18px italic
    BURGUNDY serif "€1,290 tax-incl" + 12px italic Inter charcoal
    70% "/ night"
  - Full-width ghost button, 1px brass border, "View fiche" (44px
    tall, marble #ece5d9 hover fill)

Horizontal variant (for /search, /destination, /guide): 16:10
photo left at 40%, content right at 60% with 24px padding.

Room variant (for hotel-fiche block 5): identical to the vertical,
but the name is italic, and there is a m²+capacity metadata row
between the name and the excerpt.
```

### 3.4 Bloc AEO « Réponse du Concierge »

#### Snippet — FR

```text
Conçois un bloc « Réponse du Concierge » réutilisable (pattern
AEO pour LLMs et Google AI Overviews). Largeur max-editorial
74rem, fond CREAM #f5ebd4, bordure LAITON 1px, padding 48px (32px
mobile), radius 4px. Le bloc peut aussi être posé sur fond marbre
#ece5d9 dans une section pleine largeur.

Structure :
- Ligne du haut : ZONE RÉSERVÉE AVATAR CONCIERGE circulaire
  48×48 à gauche (scène 07 « Concierge Tip » portrait crop, §4) +
  label-caps LAITON 12px tracking 0.12em « LA RÉPONSE DU
  CONCIERGE » centré vertical avec petite étoile laiton 8px à
  gauche du label.
- H3 serif italic 24px charcoal weight 400 = la question (1-2
  lignes).
- Réponse Inter 16px charcoal line-height 1.65, 60-80 mots (5-7
  lignes en desktop).
- En bas, lien link-style BORDEAUX souligné avec flèche « → » :
  « Voir notre classement complet ». Pas de bouton.

Pas d'ombre. Pas d'icône bruyante. Le bloc doit donner l'impression
d'être posé sur une console marbre, pas vendu.
```

#### Snippet — EN

```text
Design a reusable "Concierge answer" block (AEO pattern for LLMs
and Google AI Overviews). Max-editorial 74rem wide, CREAM #f5ebd4
fill, 1px BRASS border, 48px padding (32px mobile), 4px radius.
The block can also sit on marble #ece5d9 fill inside a full-width
section.

Structure:
- Top row: 48×48 CIRCULAR CONCIERGE AVATAR RESERVED ZONE left
  (scene 07 "Concierge Tip" portrait crop, §4) + 12px BRASS
  label-caps "THE CONCIERGE'S ANSWER", 0.12em tracking,
  vertically centred with a small 8px brass star left of the
  label.
- 24px italic charcoal serif H3 weight 400 = the question (1-2
  lines).
- 16px charcoal Inter answer, 1.65 line-height, 60-80 words (5-7
  lines desktop).
- Bottom: BURGUNDY underlined link-style with "→" arrow: "See our
  full ranking". No button.

No shadow. No noisy icon. The block must feel placed on a marble
console, not sold.
```

### 3.5 Callout « Le Conseil du Concierge »

#### Snippet — FR

```text
Conçois le bloc canonique « Le Conseil du Concierge » (obligatoire
sur toute fiche hôtel et présent sur les long-reads).

Largeur max-editorial 74rem, fond CREAM #f5ebd4 (PAS sage cette
fois — on garde sage pour les FAQ ouvertes seulement), bordure
gauche BORDEAUX 4px solide #6b2331, bordure droite/haut/bas LAITON
1px #b88a4d, padding 48px (24px mobile), radius 4px (coin haut-
gauche aigu à cause de la bordure gauche).

Structure :
- Ligne du haut sur 3 éléments : ZONE RÉSERVÉE AVATAR CONCIERGE
  circulaire 80×80 à gauche (scène 07 « Concierge Tip » portrait
  cropped, §4) + label-caps LAITON 12px tracking 0.12em « LE
  CONSEIL DU CONCIERGE » centré vertical + petite étoile laiton
  12px à droite.
- H3 serif italic 22px charcoal weight 400, 1 ligne, donne le
  thème du conseil (« Pour une vue inoubliable », « Pour éviter
  le brunch du dimanche »).
- Corps Inter 16px charcoal line-height 1.65, 60-90 mots,
  commence par « Mon conseil : », contient un secret opérationnel
  concret (numéro de chambre, horaire, accès méconnu, table à
  demander).
- Signature Inter italic 14px charcoal opacity 75% « — Le
  Concierge » bas-droite.

Pas de bouton. Pas d'ombre. Le bloc doit ressembler à une note
manuscrite glissée à l'oreille, pas à une publicité.
```

#### Snippet — EN

```text
Design the canonical "Concierge's tip" block (mandatory on every
hotel fiche and present on long-reads).

Max-editorial 74rem wide, CREAM #f5ebd4 fill (NOT sage this time
— sage is kept for open FAQs only), solid BURGUNDY 4px left border
#6b2331, right/top/bottom 1px BRASS border #b88a4d, 48px padding
(24px mobile), 4px radius (sharp top-left corner because of the
left border).

Structure:
- Top row, 3 elements: 80×80 CIRCULAR CONCIERGE AVATAR RESERVED
  ZONE left (scene 07 "Concierge Tip" portrait cropped, §4) +
  12px BRASS label-caps "THE CONCIERGE'S TIP", 0.12em tracking,
  vertically centred + small 12px brass star right.
- 22px italic charcoal serif H3 weight 400, 1 line, sets the tip
  theme ("For an unforgettable view", "To avoid Sunday brunch").
- 16px charcoal Inter body, 1.65 line-height, 60-90 words, starts
  with "My tip:", contains a concrete operational secret (room
  number, timing, hidden access, table to request).
- 14px italic Inter 75% opacity "— The Concierge" signature
  bottom-right.

No button. No shadow. The block must feel like a handwritten note
whispered in the ear, not an advertisement.
```

### 3.6 Sticky TOC long-read

#### Snippet — FR

```text
Conçois une TOC sticky pour long-reads (classements, guides,
méthode, legal).

Desktop (lg+ uniquement) : colonne fixe largeur 280px, position
sticky top 100px, hauteur max calc(100vh - 120px), overflow-y
discret. Conteneur CREAM #f5ebd4 bordure LAITON 1px, padding 24px,
radius 4px.

Structure :
- Label-caps LAITON 12px tracking 0.12em « SOMMAIRE » avec petite
  étoile laiton 8px à gauche du label.
- Filet laiton fin de séparation.
- Liste verticale max 8-10 entrées. Chaque entrée : Inter 14px
  charcoal, padding vertical 12px (touch target 44px), bordure
  gauche 2px transparente.
- Scroll-spy actif : entrée courante en BORDEAUX weight 600 avec
  bordure gauche BORDEAUX 2px.
- Hover : fond marbre #ece5d9 subtil.

Mobile / tablet : invisible par défaut. Bouton flottant rond fond
BORDEAUX texte cream, icône liste line-art cream, 56px, fixed
bottom-right 24px, label « Sommaire ». Au clic, ouvre une bottom
sheet cream pleine largeur avec la même liste.
```

#### Snippet — EN

```text
Design a sticky TOC for long-reads (rankings, guides, method,
legal).

Desktop (lg+ only): fixed 280px column, sticky top 100px, max
height calc(100vh - 120px), discreet overflow-y. CREAM #f5ebd4
container with 1px BRASS border, 24px padding, 4px radius.

Structure:
- 12px BRASS label-caps "CONTENTS", 0.12em tracking, with 8px
  small brass star left of the label.
- Thin brass separator rule.
- Vertical list, max 8-10 entries. Each entry: 14px charcoal
  Inter, 12px vertical padding (44px touch target), 2px
  transparent left border.
- Active scroll-spy: current entry in BURGUNDY weight 600 with
  BURGUNDY 2px left border.
- Hover: subtle marble #ece5d9 fill.

Mobile / tablet: hidden by default. Round floating button,
BURGUNDY fill, cream text, line-art cream list icon, 56px, fixed
bottom-right 24px, "Contents" label. On click, opens a full-width
cream bottom sheet with the same list.
```

### 3.7 Breadcrumb sobre

#### Snippet — FR

```text
Conçois un fil d'ariane sobre. Hauteur 32px, padding vertical 8px,
Inter 12px label-caps tracking 0.12em uppercase.

Items en LAITON #b88a4d opacity 100%, sauf le dernier (page
courante) en charcoal weight 600 opacity 100% sans lien.
Séparateurs « › » BORDEAUX weight 400 avec marge horizontale 8px.
Maximum 5 niveaux. Au-delà, tronquer le milieu avec « … » et
garder les 2 premiers + 2 derniers.

Mobile : si dépasse, ne garder que le dernier parent + page
courante (ex : « Le Bristol Paris › Suite Belle Étoile »), avec
icône chevron LAITON gauche « ← » comme retour.
```

#### Snippet — EN

```text
Design a sober breadcrumb. 32px tall, 8px vertical padding, 12px
Inter label-caps, 0.12em tracking, uppercase.

Items in BRASS #b88a4d 100% opacity, except the last one (current
page) in charcoal weight 600 100% opacity without link. BURGUNDY
"›" separators weight 400 with 8px horizontal margin. Max 5
levels. Beyond, truncate the middle with "…" keeping the first 2
and last 2.

Mobile: if exceeded, keep only the last parent + current page
(e.g. "Le Bristol Paris › Belle Étoile Suite"), with a left BRASS
"←" chevron icon as back.
```

---

## 4. Direction illustrations — style « Concierge »

> Brief visuel pour le pilier illustration de la marque.
> **Source de vérité images** : les 2 illustrations de référence
> validées par le PO vivent dans
> [`docs/design/references/`](./references/) — toute nouvelle
> illustration doit converger vers leur style.

### 4.1 Pourquoi des illustrations (rappel)

Trois raisons stratégiques :

1. **Différenciation** vs Booking / Hotels.com / Expedia, qui ne
   font que de la photo agrégée. Une direction illustration porte
   la voix « Concierge » mieux qu'une banque d'images stock.
2. **Cohérence narrative** : le personnage du Concierge devient un
   visage récurrent qui incarne la promesse de la marque sans
   jamais apparaître dans une « photo de people » embarrassante.
3. **Liberté légale & éditoriale** : pas de droits photo à
   négocier pour les surfaces non-hôtelières (cluster Concierge,
   login, confirmation, états vides). Pas de risque hotlink
   Pinterest (cf. `.cursor/skills/photo-pipeline/SKILL.md`
   §legal hygiene).

### 4.2 Style visuel à adopter

- **Technique** : illustration peinte numériquement, texture
  aquarelle + crayon de couleur, ligne fine descriptive, ombres
  douces, grain léger. Sensation « planche d'album illustré » —
  pas « infographie », pas « flat design », pas « 3D ».
- **Références culturelles** : Wes Anderson (composition,
  symétrie, palette) × Tomer Hanuka (texture, dramaturgie) ×
  illustration mode années 50-60 (René Gruau, Bernard
  Villemot). Touche d'Edward Hopper pour la lumière de fin
  d'après-midi.
- **Composition** : cinématographique, format large 16:9 ou 21:9
  par défaut, profondeur de champ marquée, premier plan / arrière-
  plan travaillés. Évite le plan flat frontal sans perspective.
- **Lumière** : douce, dorée, fin d'après-midi, lumière chaude
  venant d'une fenêtre hors champ. Pas de néon, pas de lumière
  dure.
- **Personnages** : silhouettes élégantes, attitudes posées et
  précises (un geste, un regard, jamais « en mouvement
  explosif »). Diversité réelle dans les clients représentés
  (âges, origines, genres). Jamais caricatural. Visages travaillés
  avec retenue, pas d'expression exagérée.
- **Décor** : architecture palace française (haussmannien, marbre,
  laiton, miroirs ornés, plafonds peints, lustres, lampes
  laiton), ou Riviera élégante, ou Provence raffinée. Jamais
  d'intérieur contemporain anonyme.
- **Aucun texte dans l'illustration** sauf plaques de bronze
  gravées « MyConciergeHotel », étiquettes de bagages, ou enseigne
  palace fictive cohérente. Aucun logo de marque tiers visible.

### 4.3 Palette illustration = palette UI (la même)

Avec la refonte vintage, **la palette illustration et la palette
UI sont désormais identiques**. Ce qui se trouve à l'écran
prolonge ce qui se trouve dans l'illustration et inversement.

| Couleur            | Hex       | Usage                                                                          |
| ------------------ | --------- | ------------------------------------------------------------------------------ |
| Crème ivoire       | `#f5ebd4` | Fond UI dominant + fonds de scène illustrées, murs intérieurs lumineux, papier |
| Bordeaux Concierge | `#6b2331` | CTA primary UI + uniforme Concierge, tapis rouge, accents narratifs forts      |
| Laiton chaud       | `#b88a4d` | Filets, bordures, accents UI + dorures architecturales, accessoires laiton     |
| Marbre veiné       | `#ece5d9` | Surfaces secondaires UI + comptoirs réception, sols, façades pierre            |
| Charcoal           | `#1a1a1a` | Texte principal UI + ombres profondes illustration                             |
| Rose poudré        | `#f4c6c1` | Accents doux UI rare + voiturette de l'hôtel, accessoires                      |
| Sage feuillage     | `#8c9681` | Callouts calmes UI (FAQ ouverte) + plantes (topiaires, palmiers)               |
| Noyer              | `#6e4a2e` | Footer UI + boiseries, mobilier, parquets sombres                              |

### 4.4 Le personnage « Le Concierge » — bible

- **Genre / âge** : jeune adulte (28-35 ans), neutre (peut être
  homme ou femme selon scène — les deux existent). La version
  masculine est canonique sur les 2 références.
- **Tenue** : redingote bordeaux double-boutonnage à boutons
  laiton, cravate ou pochette noire fine, gants blancs immaculés,
  pantalon charcoal, chaussures oxford noires polies, chapeau
  haut-de-forme noir.
- **Posture** : droite, mains gantées souvent jointes ou tendues
  vers un objet (téléphone, carnet, clé). Tête légèrement inclinée
  vers l'interlocuteur — attitude d'écoute.
- **Expression** : sourire discret, jamais dents apparentes. Yeux
  attentifs, posés. Jamais surpris, jamais hilare.
- **Variante féminine** : redingote ajustée même bordeaux, cheveux
  attachés en chignon discret, sans chapeau OU avec petit chapeau
  cloche, mêmes gants blancs.

### 4.5 Quand utiliser l'illustration vs la photo réelle

Règle générale : **photo réelle = surface où l'utilisateur évalue
un produit** (un hôtel, une chambre, un POI). **Illustration =
surface où l'utilisateur rencontre la marque** (concept, narratif,
institutional, états transitionnels, héros conceptuels).

| Surface                                                                  | Photo réelle   | Illustration                                 |
| ------------------------------------------------------------------------ | -------------- | -------------------------------------------- |
| Hero `/` (accueil)                                                       | —              | ✅ scène large pleine largeur                |
| Hero classement / guide / itinéraire / destination                       | —              | ✅ scène large pleine largeur                |
| Carte hôtel                                                              | ✅ photo 4:3   | —                                            |
| Galerie fiche hôtel                                                      | ✅ ≥ 30 photos | —                                            |
| Cartes chambres / classements / destinations / POIs / hôtels recommandés | ✅ photos      | —                                            |
| Carte stylisée itinéraire                                                | —              | ✅ carte illustrée monochrome cream + laiton |
| Bloc « Le Conseil du Concierge »                                         | —              | ✅ avatar circulaire 64-80px                 |
| Bloc AEO « Réponse du Concierge »                                        | —              | ✅ avatar circulaire 48-56px                 |
| Bloc CTA « Réserver via le Concierge » (fiche hôtel + chambre)           | —              | ✅ avatar circulaire 64px                    |
| Page `/le-concierge` (hero + équipe + scènes méthode + promesses)        | —              | ✅ 6-8 illustrations                         |
| Page `/le-concierge/methode-editoriale` (interleaved entre étapes)       | —              | ✅ 4 illustrations                           |
| Page `/le-concierge/contact` / `/faq`                                    | —              | ✅ 1 illustration en-tête                    |
| Page `/compte/connexion` (col. gauche)                                   | —              | ✅ verticale 3:4                             |
| Page `/compte/inscription`                                               | —              | ✅ verticale 3:4                             |
| Tunnel `/reservation/start` (CTA Concierge)                              | thumb hôtel    | avatar Concierge                             |
| Tunnel `/reservation/payment`                                            | thumb hôtel    | —                                            |
| Page `/reservation/confirmation`                                         | thumb hôtel    | ✅ hero 4:3 + spot 200×200                   |
| Empty state `/recherche`                                                 | —              | ✅ 4:3                                       |
| Empty state `/compte/favoris`                                            | —              | ✅ 4:3                                       |
| Page 404                                                                 | —              | ✅ 4:3                                       |
| Page 500                                                                 | —              | ✅ 4:3                                       |
| Section newsletter (toutes pages)                                        | —              | ✅ spot 160-200px                            |
| Page legal contact block                                                 | —              | ✅ avatar 48px                               |

### 4.6 Prompt générique pour AI illustrator

À utiliser dans Midjourney v6+, DALL-E 3, ou comme brief humain.
En anglais (Midjourney comprend mieux EN). Remplacer
`[INSERT SPECIFIC SCENE]` par la scène voulue (voir pool §4.7).

```text
Editorial illustration in a refined vintage hand-painted style,
soft watercolor and colored pencil texture, fine descriptive line
work, sensibility of Wes Anderson cinematography crossed with
Tomer Hanuka editorial illustration and 1950s French fashion
illustration (René Gruau). Scene set in a French Belle Époque
Palace hotel.

[INSERT SPECIFIC SCENE]

The recurring character "Le Concierge" appears whenever a person
is needed: young adult (28-35), neat burgundy double-breasted
uniform with brass buttons, black top hat, immaculate white
gloves, polished oxford shoes, calm attentive expression, slight
respectful head tilt. Never caricature, never exaggerated
emotion.

Palette: ivory cream #f5ebd4 dominant, Concierge burgundy
#6b2331 accents, powder pink #f4c6c1 highlights, warm brass
#b88a4d for fixtures and accessories, veined marble #ece5d9 for
surfaces, walnut wood #6e4a2e for furniture, sage foliage
#8c9681 for plants. Warm, golden late-afternoon light coming
from an off-frame window. Shallow depth of field. Cinematic
16:9 composition with worked foreground and background. No text
visible, no third-party brand logos.

--style raw --ar 16:9 --v 6 --s 250
```

Variantes ratio :

- Hero desktop large → `--ar 21:9`
- Hero mobile vertical → `--ar 4:5`
- Avatar circulaire → `--ar 1:1` + précision « close-up portrait
  cropped at the chest »

### 4.7 Pool de scènes — v1 (12 illustrations master)

Production initiale à commander. Chaque scène doit être livrée en
4 ratios (16:9 desktop, 21:9 ultra-wide hero, 4:5 mobile, 1:1
avatar).

1. **Palace Entrance** — Concierge présentant une voiturette rose
   vintage à un couple sur le tapis rouge (matche référence 01).
2. **Brass Phone Reception** — Concierge au téléphone laiton à la
   réception, cliente élégante au comptoir marbre (matche
   référence 02).
3. **Concierge's Desk** — Concierge derrière un grand bureau
   acajou, carnet de notes ouvert, lampe laiton allumée, plan de
   Paris déplié, stylo plume en main.
4. **Incognito Visit** — Concierge en costume civil sombre (sans
   chapeau, sans uniforme), prenant discrètement des notes dans
   le coin d'un hall de palace avec carnet en cuir.
5. **Editorial Deliberation** — Concierge et une consoeur autour
   d'une table marbre bistro comparant des fiches papier épinglées
   à des pinces, stylos plume à la main.
6. **Quarterly Update Wall** — Concierge vu de dos, face à un mur
   de fiches hôtel épinglées reliées par du fil rouge comme un
   tableau d'enquête, dans un back-office boisé.
7. **Concierge Tip** — portrait rapproché de profil, doigt ganté
   posé sur la lèvre dans un geste de « secret partagé », colonne
   de marbre floutée derrière.
8. **Reservation Confirmation** — Concierge tenant un plateau
   argenté avec une enveloppe scellée à la cire, légère
   révérence, hall marbre en arrière-plan.
9. **Empty State (search)** — Concierge assis à son bureau, grand
   carnet de cuir ouvert, expression pensive, lampe laiton
   diffusant une lumière chaude.
10. **404 / Lost** — Concierge perplexe avec carte de ville
    dépliée à l'envers, tête inclinée, devant une façade de
    palace au crépuscule.
11. **Newsletter Still Life** — pas de personnage : enveloppe
    cream scellée à la cire, stylo plume, carnet en cuir, clé
    laiton, brin de lavande, sur surface marbre (composition
    plongée).
12. **Premium Loyalty Welcome** — Concierge accueillant un client
    habitué avec reconnaissance discrète, brève rencontre des
    yeux et petit sourire, dans le hall marbre d'un palace de la
    Riviera.

### 4.8 Process de production recommandé

1. **Sprint 1** — produire les **3 scènes prioritaires** : 01
   Palace Entrance, 02 Brass Phone, 07 Concierge Tip (avatar).
   Elles couvrent le hero d'accueil, la page connexion, et
   l'avatar réutilisé dans tous les blocs AEO / Conseil.
2. **Sprint 2** — produire les 9 scènes restantes du pool §4.7.
3. **Validation** : chaque illustration validée contre les 2
   références (01, 02) sur cohérence du personnage, palette,
   lumière, niveau de détail architectural.
4. **Format livraison** : PNG 24 bits, sans transparence pour
   héros, avec transparence pour avatars et stills. 3×retina
   (ex. hero 21:9 → 3840×1645 minimum).
5. **Stockage** : upload Cloudinary dans `brand/concierge/` avec
   Structured Metadata `asset_type: brand_illustration`,
   `concierge_scene: <slug>` (cf.
   `.cursor/skills/photo-pipeline/SKILL.md`).
6. **Alt text** : descriptif factuel ET cohérent avec la voix
   Concierge — ex. « Le Concierge présente la voiturette de
   l'hôtel à un couple sur le tapis rouge de l'entrée. ».

### 4.9 Anti-patterns à refuser

- ❌ Photographie réelle avec filtre vintage simulant
  l'illustration.
- ❌ Vector flat style (Notion-like, Figma illustrations) — brise
  la promesse marque.
- ❌ Personnages 3D Pixar — trop tech bro.
- ❌ Le Concierge avec une expression exagérée (clin d'œil appuyé,
  pouce levé) — brise la dignité du personnage.
- ❌ Logos tiers visibles dans l'illustration (Louis Vuitton,
  Rolex, etc.) — risque légal.
- ❌ Illustration générée par Stitch directement — Stitch ne sait
  pas produire ce style proprement. Toujours zone réservée +
  brief externe.
- ❌ Mélanger photo réelle et illustration dans le même bloc
  visuel (ex : carte hôtel avec un médaillon illustré du Concierge
  dessus) — briser les deux registres.

---

## 5. Références croisées

Ce document s'aligne sur la source de vérité du repo. Pour chaque
zone de doute, consulter :

- Voix éditoriale Concierge : [`EDITORIAL_VOICE.md`](../../EDITORIAL_VOICE.md) §1-6 + ADR-0011.
- Direction illustrations + références images : [`docs/design/references/`](./references/).
- Pipeline photo hôtel (Cloudinary, Structured Metadata, hygiène légale) : [`.cursor/skills/photo-pipeline/SKILL.md`](../../.cursor/skills/photo-pipeline/SKILL.md).
- Tokens DS actuels du code (à refondre dans un second temps si direction validée) : [`packages/ui/src/tokens.css`](../../packages/ui/src/tokens.css).
- Contrat fiche hôtel 15 blocs + Conseil du Concierge : [`.cursor/rules/hotel-detail-page.mdc`](../../.cursor/rules/hotel-detail-page.mdc).
- Patterns long-read (sticky TOC, scroll-spy, callouts) : [`.cursor/skills/editorial-long-read-rendering/SKILL.md`](../../.cursor/skills/editorial-long-read-rendering/SKILL.md).
- Architecture responsive et composants : [`.cursor/skills/responsive-ui-architecture/SKILL.md`](../../.cursor/skills/responsive-ui-architecture/SKILL.md).
- Accessibilité WCAG 2.2 AA (touch target, focus, contrastes) : [`.cursor/skills/accessibility/SKILL.md`](../../.cursor/skills/accessibility/SKILL.md).
- Règles SEO/GEO (AEO, JSON-LD, anti-cannibalisation) : [`.cursor/rules/seo-geo.mdc`](../../.cursor/rules/seo-geo.mdc).
- Phasage produit (booking Phase 6 frozen) : [`AGENTS.md`](../../AGENTS.md) §4ter.

### Pages non couvertes par ce document

Les ~37 routes restantes (compte/inscription, /favoris, /classements/
[axe]/[valeur], /marques, /categorie/[slug], sous-pages Concierge
restantes, etc.) dérivent toutes des 15 templates ci-dessus et des
snippets §3. Si Stitch doit produire l'une de ces pages, partir du
template le plus proche en famille et adapter le contenu via un
message de suivi.

### Note sur la cohérence avec le code prod

Le code de production (`packages/ui/src/tokens.css`) utilise
encore l'ancienne palette « Sober Luxury » (off-white #fafaf8 + or
froid #c9a96e). **C'est attendu** : la direction vintage de ce
document concerne les maquettes Stitch. Une fois les maquettes
validées par le PO, une nouvelle ADR décidera de la migration des
tokens prod (renommage `--color-bg` de #fafaf8 vers #f5ebd4,
remplacement de `--color-accent-gold` par `#b88a4d`, ajout de
`--color-burgundy` etc.). Le pivot impacterait les ~50 pages déjà
codées — d'où la prudence.
