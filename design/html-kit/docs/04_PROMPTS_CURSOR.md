# Prompts Cursor AI — MyConciergeHotel

Cursor code directement les pages. Objectif : un code **nativement optimisé SEO/GEO**, fidèle à la DA, réutilisant `tokens.css` et la bibliothèque de composants.

## Mode d'emploi

1. Place `da-kit/tokens/tokens.css` et `da-kit/composants/02_BIBLIOTHEQUE_COMPOSANTS.md` dans le repo (ex. `/docs`).
2. Crée un fichier **`.cursorrules`** à la racine avec le bloc « Règles projet » ci-dessous → Cursor l'applique à chaque génération.
3. Pour chaque page, colle le **prompt de page** correspondant dans le chat Cursor (Cmd-K / Composer).
4. Rappel : **SEO/GEO > graphique**. Aucun titre « créatif » ne doit faire perdre un mot-clé.

---

## Fichier `.cursorrules` (à coller à la racine du repo)

```
# MyConciergeHotel — Project rules for Cursor

## Mission
Luxury 5-star hotel OTA + concierge comparator (FR). Editorial style. SEO & GEO ALWAYS take priority over visual/theme choices.

## Non-negotiable design tokens (import /docs/tokens.css, never hardcode hex)
- Backgrounds: cream #F6F1E7 / #EFE8DA / #E8E0D0. NEVER dark backgrounds.
- Cards: white #FFFFFF, hairline border rgba(140,123,90,.28).
- Text: #2B2722 / #6F675B; headings #3A352D.
- Single accent: taupe #8C7B5A (#A89671 on photos). NO yellow/gold.
- Fonts: EB Garamond (serif → headings, quotes, prices) + Outfit (sans → body, UI, eyebrows). Two families MAX.
- Imagery: real luxury photos only. No watercolor/illustrations. Only illustrated element = concierge in BORDEAUX coat.

## SEO/GEO rules (MANDATORY on every page)
- Semantic HTML: header/nav/main/section/article/footer. No div-soup.
- Exactly ONE <h1> per page, containing the primary keyword. Strict Hn order.
- <title> 50-60 chars, <meta description> 150-160 chars, unique per page.
- canonical + Open Graph + Twitter Card in <head>.
- JSON-LD per page type: Home=TravelAgency+WebSite; Ranking=ItemList+BreadcrumbList(+FAQPage); Guide=TouristDestination+Article+BreadcrumbList(+FAQPage); Hotel=Hotel+Offer+AggregateRating/Review+BreadcrumbList; FAQ=FAQPage.
- GEO: open each page/section with a direct factual sentence using <strong> + keyword. Include citable facts (exact addresses, "label Palace Atout France", World's 50 Best ranks, Michelin stars, indicative prices). Add FAQ sections on key pages.
- Images: loading="lazy", decoding="async", explicit width/height, descriptive alt (brand + place + subject).
- robots.txt must allow GPTBot, PerplexityBot, ClaudeBot, Google-Extended. Keep sitemap.xml updated.
- Core Web Vitals: critical CSS inline, JS defer, fonts preconnect/preload. Target LCP<2.5s, CLS<0.1.

## Editorial voice (concierge, FR, formal "vous")
- Voice lives in eyebrows / chapôs / descriptions / captions — NEVER replaces the keyword in an Hn.
- Winks (subtle, 1-2 per section): "Le carnet du Concierge", "Le conseil du Concierge", "Notre carnet le murmure…", "Entre nous…". No tutoiement.

## Components
Reuse classes from /docs/02_BIBLIOTHEQUE_COMPOSANTS.md (.header, .hero, .hcard, .crank, .guide-hero, .gq, .gtile, .concierge-feature, .price-compare, .faq-item, .btn-*, .footer). Keep French class names.
```

---

## Prompt — Page Classement

```
Crée la page /classements/meilleurs-palaces-paris (HTML sémantique + JSON-LD), en respectant .cursorrules et les composants existants.

SEO/GEO :
- <title> : "Les 10 meilleurs palaces de Paris (2026) | MyConciergeHotel"
- meta description : sélection des meilleurs palaces 5 étoiles de Paris, classés par le Concierge, avec adresses, distinctions et tarifs indicatifs.
- H1 : "Les 10 meilleurs palaces de Paris" (mot-clé fort, ne pas remplacer par une formule créative).
- Eyebrow (voix concierge) : "Le carnet du Concierge · Paris".
- Chapô GEO : 1re phrase en <strong> répondant directement ("Les meilleurs palaces de Paris sont Le Meurice, Le Bristol et le Plaza Athénée…").
- Schema : ItemList (chaque hôtel : name, address, url) + BreadcrumbList + FAQPage.

Structure :
- Breadcrumb Accueil › Classements › Paris.
- En-tête éditorial (.rk-page-head) : eyebrow, H1, .rk-lede, .rk-meta (date, temps de lecture, "Sélection du Concierge").
- <ol> de cartes .crank (numéro, photo 4:3, étoiles + label Palace, H2 = nom hôtel, .loc avec adresse exacte, <p> en voix concierge avec un fait citable Michelin/World's 50 Best, score, bouton .btn-ligne "Voir la fiche").
  Hôtels : Le Meurice (228 rue de Rivoli, 1er), Le Bristol (112 rue du Faubourg Saint-Honoré, 8e, 17e World's 50 Best 2025), Plaza Athénée (25 av Montaigne, 8e), Four Seasons George V (31 av George-V, 8e), Le Crillon (10 pl de la Concorde, 8e, 23e World's 50 Best), Cheval Blanc Paris (8 quai du Louvre, 1er, 21e World's 50 Best).
- Section FAQ (.faq-item) : "Combien y a-t-il de palaces à Paris ?", "Quelle différence entre 5 étoiles et Palace ?", "Quel est le meilleur palace de Paris ?".
- Bandeau .concierge-feature + footer (réutiliser).
Vérifie le rendu desktop ET mobile.
```

---

## Prompt — Guide de ville

```
Crée la page /guides/paris (HTML sémantique + JSON-LD), selon .cursorrules.

SEO/GEO :
- <title> : "Guide de Paris : où séjourner, dîner et flâner | MyConciergeHotel"
- H1 : "Paris" dans le guide-hero (mot-clé ville).
- Eyebrow : "Le guide du Concierge". Sous-titre : "Où séjourner, dîner et flâner — selon le Concierge".
- Chapô GEO en <strong> avec faits (arrondissements, quartiers de luxe).
- Schema : TouristDestination + Article (datePublished/dateModified) + BreadcrumbList + FAQPage.

Structure :
- Breadcrumb, guide-hero (photo Paris voilée), intro .g-lede.
- H2 "Où séjourner à Paris : nos hôtels 5 étoiles" → .grid-4 de .hcard.
- H2 "Quartiers d'exception" → .g-quartiers (4 .gq) : Le Marais (4e), Saint-Germain-des-Prés (6e), Le Triangle d'Or (8e — av Montaigne), Montmartre. H3 = quartier + arrondissement (mot-clé), <p> voix concierge.
- H2 "À ne pas manquer" + H2 "La table : où dîner à Paris" → .g-tiles (.gtile photo 16:9 + texte).
- FAQ : "Quel quartier choisir pour un séjour de luxe à Paris ?", "Où dormir près des Champs-Élysées ?".
- Bandeau concierge + footer.
Desktop + mobile.
```

---

## Prompt — Fiche hôtel

```
Crée la page /hotels/[slug] (template fiche hôtel), selon .cursorrules.

SEO/GEO :
- <title> : "{Nom hôtel}, palace 5 étoiles à {ville} | MyConciergeHotel"
- H1 = nom complet de l'hôtel.
- Chapô GEO en <strong> (adresse exacte, label Palace, distinctions).
- Schema : Hotel/LodgingBusiness (name, address, starRating, amenityFeature) + Offer (price, priceCurrency) + AggregateRating + Review + BreadcrumbList + FAQPage.

Structure (réutiliser .htl-*):
- Breadcrumb, galerie (1 grande + 4 petites), en-tête (étoiles + Palace, H1, .htl-loc, .htl-rating), atouts express.
- Corps 2 colonnes : gauche sections éditoriales (La maison, Les chambres avec .room-card, La table, équipements .amen-grid, localisation, avis .review, FAQ) ; droite carte résa sticky .resa-card.
- Bloc .price-compare (comparateur sans affiliation, ligne MyConciergeHotel en avant).
- Footer.
Desktop + mobile + sticky aside qui passe au-dessus en mobile.
```

---

## Prompt — Fichiers techniques (à lancer une fois)

```
Génère robots.txt et sitemap.xml pour myconciergehotel.com.
robots.txt : Allow / ; Disallow /api/ /admin/ /compte/ ; autoriser explicitement GPTBot, PerplexityBot, ClaudeBot, Google-Extended ; ligne Sitemap.
sitemap.xml : accueil (1.0), /classements (0.8), /guides (0.8), fiches hôtel & guides (0.7), pages fixes (0.5), avec lastmod.
Ajoute aussi un composant <Head> réutilisable qui prend title, description, canonical, ogImage et injecte Open Graph + Twitter Card.
```

---

## Workflow recommandé (Stitch → Cursor)

1. **Stitch** : génère la maquette visuelle de l'écran (dégrossit la mise en page).
2. **Export** vers le code.
3. **Cursor** : applique `.cursorrules` + `tokens.css`, remplace par les composants nommés, **ajoute toutes les balises SEO + JSON-LD + FAQ** (que Stitch ne fait pas).
4. Vérifie : 1 seul H1, Hn ordonnés, JSON-LD valide (Rich Results Test), `alt` partout, lazy-load, mobile OK.
5. Déploie.
