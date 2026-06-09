# Runbook — Sourcing photo press-kit (pilote 2026-06-08)

> Sourcing d'images officielles (press-kit / DAM de groupe + Wikimedia/Places
> déjà en base) → Cloudinary → enrichissement Vision → curation hero + tuiles.
> Skills : `photo-pipeline`, `photo-quality-seo-geo-agentique`,
> `content-enrichment-pipeline`, `llm-output-robustness`.

## 1. Objectif & périmètre

Prouver de bout en bout la chaîne « photos officielles propres » sur un
échantillon de 14 hôtels de groupe (Tier A/B), sans aucune photo générée
par IA et **zéro hotlink fournisseur/OTA** : toute image servie est
réhébergée sur Cloudinary (`cct/hotels/<slug>/…`).

Hors périmètre (volontairement) : sourcing Google Places **nouveau** pour
les indépendants (ambiguïté légale — voir §7) ; enhancement IA (interdit,
ADR-0024) ; génération IA (interdit).

## 2. Résultats chiffrés

14 hôtels, galeries avant → après (uploads press-kit ajoutés ce jour) :

| Hôtel                       | avant → après | hero retenu (curate) |
| --------------------------- | ------------- | -------------------- |
| fairmont-jasper-park-lodge  | 7 → 17        | press-9              |
| the-ritz-carlton-berlin     | 9 → 15        | press-1              |
| fairmont-royal-york         | 9 → 13        | commons-3            |
| w-austin                    | 9 → 13        | commons-2            |
| raffles-europejski-warsaw   | 7 → 11        | commons-8            |
| the-st-regis-hong-kong      | 9 → 11        | press-2              |
| fairmont-beijing            | 7 → 10        | press-2              |
| the-savoy                   | 9 → 10        | press-2              |
| the-st-regis-riyadh         | 9 → 10        | places-4             |
| the-st-regis-san-francisco  | 6 → 10        | press-1              |
| four-seasons-georges-v      | 9 → 10        | commons-6            |
| four-seasons-hotel-seattle  | 7 → 9         | places-3             |
| four-seasons-hotel-florence | 9 → 9         | commons-6            |
| four-seasons-…-embarcadero  | 9 → 9         | places-6             |

- **53 photos** uploadées + scorées Vision (catégorie, alt FR/EN, caption
  FR/EN, quality, representativeness, hero_suitable), **0 drop**.
- **100 %** des entrées des 14 galeries ont : alt FR **et** EN, width/height,
  catégorie, score representativeness (vérifié en base).
- **0** référence image non-Cloudinary sur les fiches rendues (prod), hors
  la tuile de carte `maps.wikimedia.org` (bénigne).

## 3. Coûts

- Vision (gpt-4o-mini) : ~0,04 $ pour les 53 scores `categorize` ; upload
  Vision du même ordre. **Pilote total < ~0,15 $.**
- Cloudinary : ~50 uploads + 1 listing Admin API complet (~24 k assets, 48
  pages) pour `backfill-dimensions`.
- Extrapolation : ~**0,01 $/photo** Vision. Une cohorte de 100 hôtels
  (~6-8 photos utiles chacun) ≈ 6-8 $ Vision + ~600-800 uploads Cloudinary.

## 4. Séquence exacte (scoppée par cohorte)

Toujours **scoper par `--slugs`** (jamais en plein catalogue, sauf
`backfill-dimensions`). Depuis `scripts/editorial-pilot/` :

```powershell
# 1. Pré-requis env (s'arrête si une clé manque)
#    Supabase service role, Cloudinary, Tavily, OpenAI
# 2. Audit + sélection cohorte (Tier A/B, parent group, official_url propre)
pnpm photos:audit
# 3. Gate official_url (anti-toxique / corporate-root) — dry, eyeball
pnpm photos:backfill-url:dry
# 4. Découverte Tavily (lecture seule) → revue manuelle du JSON candidates
pnpm photos:discover "--slugs=<a,b,c>"
# 5. Upload press-kit (LIVE) — voir gotchas rate-limit/doublons
pnpm photos:upload-press-kit --discovery-dir=runs "--slugs=<a,b,c>" --limit=12
# 6. Scores Vision manquants (back-off SDK intégré ; concurrency basse)
pnpm photos:categorize --backfill-scores --concurrency=2 "--slugs=<a,b,c>"
# 7. Curation hero + 4 tuiles (pur DB, idempotent) — dry puis live
pnpm photos:curate --dry-run --require-scores "--slugs=<a,b,c>"
pnpm photos:curate --require-scores "--slugs=<a,b,c>"
# 8. Dimensions JSON-LD — UNE fois en plein catalogue (1 listing)
npx tsx src/photos/backfill-dimensions.ts
```

## 5. Gotchas capitalisés (2026-06-08)

1. **OpenAI compte neuf = tier bas → 429 « Rate limit ».** Distinct du 429
   `insufficient_quota` (= pas de crédit). `upload-press-kit` a désormais un
   retry/back-off (cap 20 s, `Retry-After` honoré) + timeout dur de 30 s sur
   l'appel Vision et 15 s sur le fetch image (anti-hang). Garder
   `categorize --concurrency=2`. Le SDK OpenAI (`categorize`) retry seul.
2. **Re-run upload = doublons.** `pressIndex` est positionnel : relancer
   `upload-press-kit` sur un hôtel déjà partiellement uploadé ré-uploade en
   `press-N+1`. **Ne relancer que les hôtels à 0 upload** (ou dédupliquer).
3. **Four Seasons : images difficiles.** `www.fourseasons.com/alt/img-opt/…`
   = protégées au téléchargement (OpenAI « Error while downloading ») ;
   `press.fourseasons.com/.../news/…` = articles HTML (« unsupported image »).
   **Seules** les `press.fourseasons.com/content/dam/…` en https passent →
   FS rend peu/pas de candidats. À câbler : fetch avec Referer/UA navigateur,
   ou sourcing manuel FS.
4. **Accor : CDN `ahstatic.com`** sert les médias officiels (Fairmont,
   Raffles, Sofitel, The Savoy…) → whitelisté dans `HOSTNAME_WHITELIST_GLOBAL`.
5. **Domaines de marque propres ≠ chemin parent.** Ajouter dans
   `SLUG_EXTRA_ALLOWED_HOSTS` (`upload-press-kit-images.ts`), ex.
   `jasper-park-lodge.com`, `thefairmontroyalyork.com`. À prévoir par
   propriété lors de chaque cohorte.
6. **Comparateur de prix = noms d'OTA en texte seul** (`booking.com`,
   `expedia`, `tripadvisor`, `agoda`) — **légal et voulu** (skill
   `competitive-pricing-comparison`). Ne PAS confondre avec une fuite image :
   contrôler uniquement les **URLs d'images** (src/srcset/og:image/ImageObject).
7. **Windows : `Invoke-WebRequest` POST vers OpenAI peut hang** (bug PS 5.1).
   Utiliser `curl.exe` ou `Invoke-RestMethod` pour tout test d'API.
8. **`backfill-dimensions`** liste tout `cct/hotels/` (~24 k assets) à chaque
   run → le lancer **une seule fois** en plein catalogue (additif, idempotent),
   pas par slug.

## 6. Acceptation (walk)

- Le serveur dev local 404 sur **toutes** les routes (le proxy i18n Next 16
  `apps/web/src/proxy.ts` ne s'applique pas sur l'instance Turbopack locale ;
  symptôme corrélé à un symlink cassé sous `apps/web`). **Faire le walk sur
  la prod** (`https://myconciergehotel.com/hotel/<slug>` + `/en/…`) ou un
  preview Vercel — pas en local tant que ce point n'est pas résolu.
- Pas de MCP navigateur disponible dans cet environnement → pas de captures
  ni LCP mesuré au navigateur ; vérification au **HTML rendu** (JSON-LD
  `Hotel` + 5 `ImageObject` dont 1 `representativeOfPage`, width/height,
  `og:image` Cloudinary, zéro hôte image fournisseur). LCP : hero servi en
  `f_auto/q_auto` + srcset responsive (delivery optimisée).
- **ISR** : la prod peut afficher l'ancienne curation tant que la
  revalidation n'a pas eu lieu ; la base est à jour immédiatement.

## 7. À câbler / limites

- **Indépendants / boutique (parent group `null`)** : le press-kit retombe
  sur `official_url` seul. Sourcing Google Places **nouveau** différé
  (légal). Décision produit requise avant cohorte indépendants.
- **Four Seasons** : stratégie de fetch dédiée (cf. gotcha 3).
- **Groupes mappés mais non exercés par le pilote** : `oetker`,
  `cheval_blanc`, `aman`, `mandarin_oriental`, `belmond`, `six_senses`,
  `como`, `rosewood`, `bulgari`, `relais_chateaux`, `lhw`, `hyatt`,
  `ihg_lux`, `auberge_resorts`, `oberoi`, `anantara`. Domaines déjà dans
  `PARENT_DOMAINS_BY_GROUP` ; prévoir un run `discover` de calibrage + ajout
  probable de `SLUG_EXTRA_ALLOWED_HOSTS` par propriété avant l'upload.

## 8. Séquence cohortes recommandée

1. **Accor (`accor_lux`)** et **Marriott (`marriott_lux`)** — meilleur
   rendement (CDN réhébergeables `ahstatic.com` / `cache.marriott.com`).
2. **Oetker / Cheval Blanc / Aman / Mandarin / Rosewood / Bulgari** — DAM
   Contentful/CDN, à calibrer par `discover`.
3. **LHW / Relais & Châteaux / Hyatt / IHG** — portails plus hétérogènes,
   eyeball renforcé du gate `official_url`.
4. **Four Seasons** — après mise en place du fetch dédié.
5. **Indépendants** — après décision légale Google Places.

Procéder par lots de 10-15 hôtels, `categorize --concurrency=2`, et
**ne relancer que les hôtels à 0 upload** en cas d'échec partiel.
