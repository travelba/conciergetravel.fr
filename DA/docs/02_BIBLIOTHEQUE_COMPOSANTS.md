# Bibliothèque de composants — MyConciergeHotel

Specs + code de référence (HTML/CSS) extraits de la production. Tout composant réutilise les tokens de `tokens.css`. Classes nommées en français pour cohérence avec l'existant.

> Convention : chaque composant = (1) rôle, (2) anatomie, (3) HTML de référence, (4) règles, (5) notes SEO/GEO.

---

## 1. Header / Navigation

**Rôle** : barre de navigation. Transparente sur hero (texte blanc), passe en crème translucide + flou au scroll. Pages internes : crème collant dès le départ.

**Anatomie** : marque (monogramme `M C` + nom) · nav 6 entrées max · zone droite (favoris · langue FR · compte).

```html
<header class="header" id="header">
  <div class="wrap header-inner">
    <a href="/" class="brand" aria-label="MyConciergeHotel, accueil">
      <span class="brand-mono">M<em>C</em></span>
      <span class="brand-name">MyConciergeHotel</span>
    </a>
    <nav class="nav" aria-label="Navigation principale">
      <a href="#hotels">Hôtels</a>
      <a href="#destinations">Destinations</a>
      <a href="#experiences">Expériences</a>
      <a href="classement.html">Classements</a>
      <a href="#concierge">Le Concierge</a>
      <a href="#magazine">Magazine</a>
    </nav>
    <div class="header-right">
      <span class="hr-item" aria-label="Favoris"
        ><svg class="icon" viewBox="0 0 24 24">
          <path
            d="M12 21s-7.5-4.6-10-9.2C.5 8.4 2 5 5.5 5c2 0 3.4 1.2 4.5 2.6C11.1 6.2 12.5 5 14.5 5 18 5 19.5 8.4 22 11.8 19.5 16.4 12 21 12 21z"
          /></svg
      ></span>
      <span class="sep"></span>
      <span class="hr-item"
        >FR
        <svg class="icon" viewBox="0 0 24 24" style="width:14px;height:14px">
          <path d="M6 9l6 6 6-6" /></svg
      ></span>
      <span class="sep"></span>
      <span class="hr-item"
        ><svg class="icon" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg
        ><span>Mon compte</span></span
      >
    </div>
  </div>
</header>
```

**Règles** : max **6 entrées** de nav (au-delà → débordement). Monogramme `M C` avec le `C` en `--or-clair`. Sur page interne, ajouter `class="hotel-page"` (ou `guide-page`) sur `<body>` → header crème collant via `.hotel-page .header`.

**SEO** : `<nav aria-label>`, liens textuels réels (pas d'image), ancres descriptives.

---

## 2. Hero (accueil)

**Rôle** : accueil immersif. Photo de luxe plein écran, voile dégradé depuis la gauche, texte blanc lisible à gauche.

**Anatomie** : `img.hero-bg` · `.hero-overlay` (double dégradé) · eyebrow · `h1` · sous-titre italique · paragraphe · pastilles de réassurance · barre de recherche flottante.

```html
<section class="hero">
  <img
    class="hero-bg"
    src="assets/img/hero.jpg"
    alt="Palace parisien au crépuscule"
    width="1920"
    height="1080"
  />
  <div class="hero-overlay"></div>
  <div class="wrap hero-grid">
    <div class="hero-content">
      <span class="eyebrow left">Conciergerie hôtelière · Palaces 5 étoiles</span>
      <h1>Les plus beaux palaces,<br />au meilleur tarif.</h1>
      <p class="hero-sub">Nous vous attendions.</p>
      <p class="hero-para">
        Une sélection confidentielle d'hôtels d'exception, orchestrée par votre Concierge.
      </p>
      <div class="hero-trust">
        <span class="trust-pill"
          ><svg class="icon" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg> Meilleur tarif
          garanti</span
        >
        <span class="trust-pill"
          ><svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /></svg> Conciergerie
          24/7</span
        >
      </div>
    </div>
  </div>
</section>
```

**Règles** : `min-height:92vh`. Eyebrow `max-width:430px` (anti-débordement). `h1` blanc + `text-shadow`. Mobile : overlay vertical pour lisibilité.

**SEO/GEO** : `h1` = mot-clé principal du business ; `alt` descriptif sur la photo.

---

## 3. Eyebrow (sur-titre éditorial)

**Rôle** : sur-titre encadré de deux filets fins. Porte la **voix du Concierge** au-dessus d'un titre SEO.

```html
<span class="eyebrow">Le carnet du Concierge · Paris</span>
<!-- variante alignée à gauche, sans filet avant -->
<span class="eyebrow left">Le conseil du Concierge</span>
```

**Règles** : majuscules, `12px`, interlettrage `.34em`, couleur `--or` (ou `--or-clair` sur photo). Filets `::before/::after` (34px). C'est **ici** que vit la voix concierge, pas dans le Hn.

---

## 4. Carte hôtel (`.hcard`)

**Rôle** : vignette hôtel en grille `4/5`. Brique réutilisée partout (home, listings, « où séjourner » du guide).

```html
<a class="hcard" href="hotels/le-meurice.html">
  <div class="hcard-img">
    <img
      src="assets/img/htl_facade.jpg"
      alt="Façade du Meurice, rue de Rivoli, Paris"
      width="640"
      height="800"
      loading="lazy"
      decoding="async"
    />
  </div>
  <div class="hcard-body">
    <h3>Le Meurice</h3>
    <span class="loc">Paris 1ᵉʳ · 228 rue de Rivoli</span>
  </div>
</a>
```

**Règles** : image `aspect-ratio:4/5`, zoom `scale(1.06)` au survol. Titre EB Garamond `20px`. Grille parente `.grid-4` (4 col → 2 → 1).

**SEO** : `h3` = nom de l'hôtel (mot-clé). `alt` = nom + lieu + sujet.

---

## 5. Bandeau « Le Concierge » (`.concierge-feature`)

**Rôle** : section signature qui incarne l'univers du Concierge. Sceau en filigrane, deux colonnes (texte + visuel).

```html
<section class="concierge-feature section-creme2" id="le-concierge">
  <div class="wrap cf-grid">
    <div class="cf-tx">
      <span class="eyebrow">Le mot du Concierge</span>
      <h2>Votre majordome d'adresses confidentielles</h2>
      <p>
        De la table à réserver au perron où l'on vous attend, laissez-nous orchestrer chaque détail
        de votre séjour.
      </p>
      <ul class="cf-list">
        <li>
          <svg class="icon" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg> Réservations &
          demandes spéciales
        </li>
        <li>
          <svg class="icon" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg> Surclassements &
          attentions VIP
        </li>
        <li>
          <svg class="icon" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg> Conciergerie 24/7
        </li>
      </ul>
      <a class="btn btn-or" href="le-concierge.html">Rencontrer le Concierge</a>
    </div>
    <div class="cf-visual">
      <img
        src="assets/img/concierge.jpg"
        alt="Le Concierge en redingote bordeaux au perron du palace"
        width="800"
        height="500"
        loading="lazy"
      />
    </div>
  </div>
</section>
```

**Règles** : grille `1fr 1.05fr`, gap `60px`. Sceau `concierge_seal.png` en `::before`, opacité `.05`. Mobile : 1 colonne, visuel au-dessus. **C'est le lieu privilégié de la voix concierge.**

---

## 6. Carte de classement (`.crank`)

**Rôle** : entrée d'un classement numéroté (page classement). Numéro de rang + photo + corps (étoiles, titre, lieu, description, score, CTA).

```html
<article class="crank">
  <div class="cr-num">1</div>
  <a class="cr-photo" href="hotels/le-meurice.html">
    <img
      src="assets/img/htl_facade.jpg"
      alt="Le Meurice, palace parisien rue de Rivoli"
      width="340"
      height="255"
      loading="lazy"
    />
  </a>
  <div class="cr-body">
    <div class="cr-stars">★★★★★ <span class="htl-palace">Palace</span></div>
    <h2>Le Meurice</h2>
    <span class="loc">Paris 1ᵉʳ · 228 rue de Rivoli · face aux Tuileries</span>
    <p>
      Le conseil du Concierge : demandez une suite donnant sur le jardin des Tuileries. Table
      d'Alain Ducasse, deux étoiles Michelin.
    </p>
    <div class="cr-foot">
      <span class="cr-score">9,6<small>/10</small></span>
      <a class="btn-ligne" href="hotels/le-meurice.html">Voir la fiche</a>
    </div>
  </div>
</article>
```

**Règles** : grille `74px 340px 1fr`. `cr-num` EB Garamond `64px` taupe. Mobile `900px` → zones `num/photo` puis `body` pleine largeur ; `560px` → num `46px`. **H2 = nom de l'hôtel** (mot-clé), voix concierge dans `<p>`.

**GEO** : adresse exacte dans `.loc`, distinctions (Palace, Michelin) citables. Parent `<ol>` idéal + `ItemList` JSON-LD.

---

## 7. Hero de guide (`.guide-hero`)

**Rôle** : en-tête de page guide ville. Photo voilée, titre ville géant, sous-titre « Le guide du Concierge ».

```html
<section class="guide-hero">
  <img
    class="gh-bg"
    src="assets/img/paris.jpg"
    alt="Paris, vue sur les toits haussmanniens au crépuscule"
    width="1920"
    height="1080"
  />
  <div class="gh-overlay"></div>
  <div class="wrap gh-content">
    <span class="eyebrow">Le guide du Concierge</span>
    <h1>Paris</h1>
    <p class="gh-sub">Où séjourner, dîner et flâner — selon le Concierge</p>
  </div>
</section>
```

**Règles** : `min-height:62vh`, double dégradé pour lisibilité bas-gauche. `h1` `clamp(58px,9vw,118px)`. **H1 = nom de la ville** (mot-clé fort).

---

## 8. Carte quartier (`.gq`) & tuile éditoriale (`.gtile`)

**Quartier** — carte texte simple, grille `.g-quartiers` (4 col) :

```html
<article class="gq">
  <h3>Le Triangle d'Or — Paris 8ᵉ</h3>
  <p>Avenue Montaigne, le Concierge y a ses entrées : maisons de couture et palaces de l'avenue.</p>
</article>
```

**Tuile éditoriale** — photo + texte, grille `.g-tiles` (2 col) :

```html
<article class="gtile">
  <div class="gtile-img">
    <img
      src="assets/img/occ_gastronomie.jpg"
      alt="Table gastronomique étoilée à Paris"
      width="800"
      height="450"
      loading="lazy"
    />
  </div>
  <div class="gtile-tx">
    <h3>La table : où dîner à Paris</h3>
    <p>Notre carnet le murmure : les meilleures tables étoilées, du palace au bistrot d'initiés.</p>
  </div>
</article>
```

**Règles** : `gq` et `gtile` = fond blanc, bord `--ligne`, hover `translateY(-3px)`. **H3 = mot-clé** (quartier/thème), voix concierge en `<p>`.

---

## 9. Comparateur de prix (`.price-compare`) — fiche hôtel

**Rôle** : tableau comparatif des tarifs OTA, avec la ligne « nous » mise en avant. Cœur de la proposition de valeur (comparateur).

```html
<div class="price-compare">
  <div class="pc-row">
    <span class="pc-name">Booking.com</span><span class="pc-price">1 280<small>€</small></span>
  </div>
  <div class="pc-row pc-us">
    <span class="pc-name">MyConciergeHotel <em>Meilleur tarif</em></span
    ><span class="pc-price">1 190<small>€</small></span>
  </div>
  <p class="pc-note">Tarif indicatif/nuit, chambre Deluxe. Comparaison sans affiliation.</p>
</div>
```

**Règles** : ligne `.pc-us` sur fond `--creme-2`, prix en `--accent`. Prix en EB Garamond.

**GEO** : prix indicatifs = données chiffrées citables. Conforme au CDC « comparateur sans affiliation ».

---

## 10. FAQ (`<details>` + `FAQPage`)

**Rôle** : questions/réponses repliables. **Composant GEO clé** (fort potentiel de citation IA).

```html
<section class="htl-section" id="faq">
  <h2>Questions fréquentes sur les palaces de Paris</h2>
  <details class="faq-item">
    <summary>Combien y a-t-il de palaces à Paris&nbsp;?</summary>
    <p>
      Paris compte une douzaine d'hôtels distingués par le label Palace d'Atout France, dont Le
      Meurice, Le Bristol et le Plaza Athénée.
    </p>
  </details>
  <details class="faq-item">
    <summary>Quelle différence entre un 5 étoiles et un Palace&nbsp;?</summary>
    <p>
      Le label Palace est une distinction au-dessus des 5 étoiles, attribuée par Atout France à un
      nombre restreint d'établissements d'exception.
    </p>
  </details>
</section>
```

Accompagner du JSON-LD `FAQPage` correspondant (voir `tokens`/schema-templates de la skill SEO).

**Règles** : `summary` `16px`, marqueur `+`/`–` en accent. Réponse directe en 1re phrase.

---

## 11. Boutons

| Classe          | Aspect                         | Emploi                               |
| --------------- | ------------------------------ | ------------------------------------ |
| `.btn.btn-or`   | Plein taupe foncé, texte crème | CTA principal                        |
| `.btn.btn-line` | Outline blanc translucide      | CTA sur photo/hero                   |
| `.btn-ligne`    | Outline taupe, pilule          | CTA sur fond clair (cartes internes) |
| `.link-or`      | Lien texte taupe + flèche      | Liens « voir tout »                  |

```html
<a class="btn btn-or" href="#">Réserver</a>
<a class="btn-ligne" href="#">Voir la fiche</a>
<a class="link-or" href="classement.html">Tous les classements →</a>
```

**Règles** : majuscules, interlettrage `.13em`. `.btn` rayon `2px`, `.btn-ligne` pilule. Hover : `.link-or` écarte la flèche (`gap`).

---

## 12. Footer (`.footer`)

**Rôle** : pied de page 5 colonnes (marque + 4 colonnes de liens) + barre légale.

```html
<footer class="footer">
  <div class="wrap foot-top">
    <div class="foot-brand">
      <span class="brand-mono">M<em>C</em></span>
      <p class="fb-tag">Nous vous attendions.</p>
      <p>La conciergerie des plus beaux palaces et hôtels 5 étoiles.</p>
    </div>
    <div class="foot-col">
      <h4>Découvrir</h4>
      <a href="classement.html">Classements</a><a href="guide.html">Paris</a>
    </div>
    <div class="foot-col">
      <h4>Le Concierge</h4>
      <a href="le-concierge.html">Services</a><a href="#">Conciergerie 24/7</a>
    </div>
    <div class="foot-col">
      <h4>Maison</h4>
      <a href="#">À propos</a><a href="#">Contact</a>
    </div>
    <div class="foot-col">
      <h4>Légal</h4>
      <a href="#">Mentions légales</a><a href="#">Confidentialité</a>
    </div>
  </div>
  <div class="wrap foot-bottom">
    <span>© 2026 MyConciergeHotel</span><span class="fb-iata">Membre IATA</span>
  </div>
</footer>
```

**Règles** : fond `--creme-3`, titres de colonne majuscules `.18em`. Mobile : 2 colonnes.

---

## Récapitulatif des grilles

| Grille                   | Desktop    | Tablet (≤1000)         | Mobile (≤640) |
| ------------------------ | ---------- | ---------------------- | ------------- |
| `.grid-4` (cartes hôtel) | 4 col      | 2 col                  | 2 col         |
| `.g-quartiers`           | 4 col      | 2 col                  | 1 col         |
| `.g-tiles`               | 2 col      | 1 col                  | 1 col         |
| `.crank`                 | 74/340/1fr | zones num+photo / body | num 46px      |
| `.foot-top`              | 5 col      | 2 col                  | 2 col         |
