# Audit — Complétude hôtels ↔ classements (2026-06-29)

> READ-ONLY. Aucune écriture DB, aucun commit. Source: PostgREST live
> (`editorial_rankings`, `editorial_ranking_entries`, `hotels`) + combinator
> (`scripts/editorial-pilot/src/rankings/combinator.ts`, `MIN_ELIGIBLE=3`).

## 0. Chiffres de cadrage

| Métrique                                           | Valeur       |
| -------------------------------------------------- | ------------ |
| Hôtels publiés (catalogue)                         | 2984         |
| Classements (total)                                | 854          |
| Classements publiés                                | 854          |
| Lignes `editorial_ranking_entries`                 | 7383         |
| Hôtels présents dans ≥1 classement publié          | 2158 (72.3%) |
| Hôtels présents dans ≥1 classement (publié ou non) | 2158 (72.3%) |
| Seeds matrice combinator                           | 5275         |
| Classements publiés mappables à un seed            | 725 / 854    |

## 1. Hôtels orphelins (dans AUCUN classement publié)

**826 hôtels orphelins** sur 2984 publiés = **27.7%**.
(En comptant aussi les classements non publiés : 826 orphelins = 27.7%.)

### 1.a — Orphelins par pays (top 30)

| Pays | Orphelins | Total publiés | % orphelins |
| ---- | --------- | ------------- | ----------- |
| FR   | 308       | 741           | 41.6%       |
| US   | 74        | 276           | 26.8%       |
| CN   | 54        | 117           | 46.2%       |
| ES   | 45        | 124           | 36.3%       |
| IT   | 23        | 173           | 13.3%       |
| CA   | 18        | 50            | 36.0%       |
| GB   | 16        | 103           | 15.5%       |
| JP   | 16        | 70            | 22.9%       |
| PT   | 16        | 45            | 35.6%       |
| MU   | 14        | 27            | 51.9%       |
| CH   | 14        | 72            | 19.4%       |
| ZA   | 14        | 35            | 40.0%       |
| SA   | 13        | 28            | 46.4%       |
| BE   | 12        | 22            | 54.5%       |
| AE   | 11        | 78            | 14.1%       |
| TR   | 11        | 39            | 28.2%       |
| DE   | 11        | 54            | 20.4%       |
| ID   | 10        | 41            | 24.4%       |
| MA   | 9         | 42            | 21.4%       |
| GR   | 7         | 88            | 8.0%        |
| IN   | 7         | 37            | 18.9%       |
| MV   | 5         | 34            | 14.7%       |
| NL   | 4         | 18            | 22.2%       |
| SC   | 4         | 14            | 28.6%       |
| HK   | 4         | 8             | 50.0%       |
| LB   | 4         | 4             | 100.0%      |
| AT   | 3         | 35            | 8.6%        |
| MG   | 3         | 3             | 100.0%      |
| LC   | 3         | 5             | 60.0%       |
| RU   | 3         | 3             | 100.0%      |

### 1.b — Orphelins par ville (top 30)

| Ville             | Orphelins |
| ----------------- | --------- |
| Paris (FR)        | 59        |
| New York (US)     | 14        |
| Londres (GB)      | 12        |
| Istanbul (TR)     | 11        |
| Tokyo (JP)        | 11        |
| Chicago (US)      | 9         |
| Barcelone (ES)    | 9         |
| Berlin (DE)       | 8         |
| Marrakech (MA)    | 8         |
| Marbella (ES)     | 7         |
| Dubai (AE)        | 6         |
| Florence (IT)     | 6         |
| Espagne (ES)      | 6         |
| Québec (CA)       | 6         |
| Cape Town (ZA)    | 6         |
| France (FR)       | 6         |
| Jakarta (ID)      | 6         |
| Chengdu (CN)      | 5         |
| Philadelphia (US) | 5         |
| Angers (FR)       | 4         |
| Amsterdam (NL)    | 4         |
| Courchevel (FR)   | 4         |
| Lhassa (CN)       | 4         |
| Gand (BE)         | 4         |
| Wengen (CH)       | 4         |
| La Rosière (FR)   | 4         |
| Maldives (MV)     | 4         |
| Hong Kong (HK)    | 4         |
| Tignes (FR)       | 4         |
| Beijing (CN)      | 4         |

### 1.c — Orphelins par tier (luxury_tier)

| luxury_tier         | Orphelins |
| ------------------- | --------- |
| self_5_star         | 542       |
| relais_chateaux     | 55        |
| ritz_carlton        | 44        |
| (none)              | 43        |
| small_luxury_hotels | 31        |
| kempinski           | 30        |
| four_seasons        | 25        |
| st_regis            | 16        |
| world_50_best       | 9         |
| fairmont            | 9         |
| park_hyatt          | 8         |
| raffles             | 3         |
| grace_hotels        | 2         |
| jumeirah            | 2         |
| waldorf_astoria     | 2         |
| bulgari             | 1         |
| capella             | 1         |
| nayara              | 1         |
| palace_atout_france | 1         |
| mandarin_oriental   | 1         |

## 2. Hôtels phares orphelins (palace / R&C / 5★)

- Palaces Atout France orphelins (`is_palace=true`) : **0** (sur 33 palaces publiés) → **les 33 palaces sont tous maillés.**
- Relais & Châteaux orphelins : **64** (tier `relais_chateaux` ou affiliation R&C)
- 5★ (hors palace) orphelins : **826** — non discriminant : ~100 % du catalogue est 5★, donc ce chiffre = total orphelins. Le vrai signal phare est R&C (64) + les grandes marques (Ritz-Carlton 44, Kempinski 30, Four Seasons 25, St Regis 16) cf. §1.c.

> Note data-quality : 1 ligne porte `luxury_tier='palace_atout_france'` mais `is_palace=false` (cf. §1.c) — incohérence flag/tier à vérifier (probable doublon de fiche). N'impacte pas le maillage palace officiel.

### 2.b — Relais & Châteaux orphelins (échantillon 40)

| slug                              | ville                 | pays |
| --------------------------------- | --------------------- | ---- |
| `anjajavy-le-lodge`               | Anjajavy              | MG   |
| `au-coeur-du-village-hotel-spa`   | La Clusaz             | FR   |
| `blackberry-farm`                 | Tennessee             | US   |
| `blue-margouillat-seaview-hotel`  | Saint-Leu             | RE   |
| `brindos-lac-and-chateau`         | Anglet                | FR   |
| `calabash-luxury-boutique-hotel`  | St George's           | GD   |
| `cap-maison`                      | Cap Estate            | LC   |
| `curtain-bluff-resort`            | St Mary's Parish      | AG   |
| `domaine-de-fontenille`           | Lauris                | FR   |
| `epako-safari-lodge-spa`          | Omaruru               | NA   |
| `epoque-hotel`                    | Bucarest              | RO   |
| `gmundner-lodge`                  | Dordabis District     | NA   |
| `great-plains-mara`               | Maasai Mara           | KE   |
| `hostellerie-briqueterie-and-spa` | Vinay                 | FR   |
| `hostellerie-la-cheneaudiere-spa` | Colroy-la-roche       | FR   |
| `hotel-20-degres-sud`             | Grand Baie            | MU   |
| `hotel-albergo`                   | Beyrouth              | LB   |
| `aya-estate`                      | Zornitza Village      | BG   |
| `balzac-paris`                    | Paris                 | FR   |
| `brittany-spa`                    | Roscoff               | FR   |
| `casa-palopo`                     | Santa Catarina Palopó | GT   |
| `chateau-de-riell`                | Prades                | FR   |
| `chateau-de-valmer`               | La Croix-Valmer       | FR   |
| `chateau-saint-jean`              | Montluçon             | FR   |
| `hotel-copernicus`                | Cracovie              | PL   |
| `hotel-de-la-plage`               | Sainte-Anne-la-Palud  | FR   |
| `hotel-grad-otocec`               | Otočec                | SI   |
| `hotel-jagdhof-glashutte`         | Bad Laasphe           | DE   |
| `jashita-hotel-tulum`             | Tulum                 | MX   |
| `l-ile-de-la-lagune-thalasso-spa` | Saint-Cyprien         | FR   |
| `la-marine-noirmoutier`           | Noirmoutier-en-l'île  | FR   |
| `le-domaine-de-verchant`          | Castelnau Le Lez      | FR   |
| `le-mas-des-herbes-blanches`      | Joucas                | FR   |
| `le-saint-paul`                   | Saint-Paul-de-Vence   | FR   |
| `les-etangs-de-corot`             | Ville d'Avray         | FR   |
| `hotel-les-roches`                | Le Lavandou           | FR   |
| `quadrille`                       | Gdynia                | PL   |
| `auberge-des-templiers`           | Boismorand            | FR   |
| `relais-christine`                | Paris                 | FR   |
| `hotel-restaurant-en-marge`       | Aureville             | FR   |

## 3. Couverture inverse par pays

| Périmètre               | Couverts | Total | %     |
| ----------------------- | -------- | ----- | ----- |
| France (FR)             | 433      | 741   | 58.4% |
| International (hors FR) | 1725     | 2243  | 76.9% |
| **Global**              | 2158     | 2984  | 72.3% |

### 3.a — Détail par pays (top 35 par volume)

| Pays | Couverts | Total | % couverture |
| ---- | -------- | ----- | ------------ |
| FR   | 433      | 741   | 58.4%        |
| US   | 202      | 276   | 73.2%        |
| IT   | 150      | 173   | 86.7%        |
| ES   | 79       | 124   | 63.7%        |
| CN   | 63       | 117   | 53.8%        |
| GB   | 87       | 103   | 84.5%        |
| GR   | 81       | 88    | 92.0%        |
| AE   | 67       | 78    | 85.9%        |
| CH   | 58       | 72    | 80.6%        |
| JP   | 54       | 70    | 77.1%        |
| DE   | 43       | 54    | 79.6%        |
| CA   | 32       | 50    | 64.0%        |
| PT   | 29       | 45    | 64.4%        |
| TH   | 40       | 42    | 95.2%        |
| MA   | 33       | 42    | 78.6%        |
| ID   | 31       | 41    | 75.6%        |
| TR   | 28       | 39    | 71.8%        |
| IN   | 30       | 37    | 81.1%        |
| MX   | 33       | 36    | 91.7%        |
| AT   | 32       | 35    | 91.4%        |
| ZA   | 21       | 35    | 60.0%        |
| MV   | 29       | 34    | 85.3%        |
| AU   | 27       | 30    | 90.0%        |
| SA   | 15       | 28    | 53.6%        |
| MU   | 13       | 27    | 48.1%        |
| BE   | 10       | 22    | 45.5%        |
| NL   | 14       | 18    | 77.8%        |
| CZ   | 18       | 18    | 100.0%       |
| VN   | 14       | 16    | 87.5%        |
| MY   | 15       | 16    | 93.8%        |
| CL   | 13       | 14    | 92.9%        |
| EG   | 11       | 14    | 78.6%        |
| SC   | 10       | 14    | 71.4%        |
| IE   | 14       | 14    | 100.0%       |
| AR   | 12       | 14    | 85.7%        |

## 4. Complétude par classement (combinator-mappés)

Pour chaque classement publié mappable à un seed : éligibles (combinator) vs entries réelles. `target` = longueur cible par scope (cap éditorial : ville/quartier ≈ 8, pays/cluster/région ≈ 10, France ≈ 12).

> **Lecture critique.** Un `manquants` élevé n'est PAS toujours un défaut. Quand `entries == target`, le classement a atteint son **plafond éditorial** : il liste volontairement les 8/10/12 meilleurs, donc les éligibles au-delà du cap sont normaux (le combinator est volontairement permissif — c'est un filtre d'éligibilité, pas une sélection d'autorité). Le LLM choisit ensuite les N meilleurs. **Les vrais déficits = classements où `entries < target`** → §5 (sous-peuplés) + §1 (orphelins). La colonne `manquants` de §4 sert surtout à fournir des **listes de candidats** pour densifier un classement (augmenter le `target`) ou pour comprendre quels hôtels ne sont cités nulle part.

### 4.a — Échantillon demandé (villes/pays/thèmes à fort volume)

| slug                                 | éligibles              | entries | target | manquants |
| ------------------------------------ | ---------------------- | ------- | ------ | --------- |
| `meilleurs-palaces-paris`            | 13                     | 13      | 8      | 0         |
| `hotel-de-luxe-paris`                | 128                    | 8       | 8      | 120       |
| `hotel-de-luxe-nice`                 | 10                     | 8       | 8      | 2         |
| `meilleurs-hotels-nice`              | 10                     | 8       | 8      | 4         |
| `hotel-de-luxe-cannes`               | _(non mappé / absent)_ |         |        |           |
| `meilleurs-hotels-cannes`            | _(non mappé / absent)_ |         |        |           |
| `plus-beaux-hotels-courchevel`       | 16                     | 8       | 8      | 8         |
| `hotel-de-luxe-courchevel`           | 16                     | 8       | 8      | 8         |
| `meilleurs-hotels-rome`              | 24                     | 8       | 8      | 16        |
| `hotel-de-luxe-rome`                 | 24                     | 8       | 8      | 16        |
| `meilleurs-hotels-venise`            | 19                     | 8       | 8      | 11        |
| `hotel-de-luxe-venise`               | 19                     | 8       | 8      | 11        |
| `meilleurs-hotels-marrakech`         | 25                     | 8       | 8      | 17        |
| `hotel-de-luxe-marrakech`            | 25                     | 8       | 8      | 17        |
| `meilleurs-hotels-dubai`             | 58                     | 8       | 8      | 50        |
| `hotel-de-luxe-dubai`                | 58                     | 8       | 8      | 50        |
| `meilleurs-hotels-italie`            | 173                    | 10      | 10     | 163       |
| `meilleurs-hotels-espagne`           | 124                    | 10      | 10     | 114       |
| `meilleurs-hotels-japon`             | 70                     | 10      | 10     | 60        |
| `meilleurs-hotels-maroc`             | 42                     | 10      | 10     | 32        |
| `palaces-spa-bien-etre`              | 33                     | 12      | 12     | 22        |
| `palaces-romantiques-france`         | 33                     | 12      | 12     | 21        |
| `palaces-gastronomie-michelin`       | 33                     | 12      | 12     | 21        |
| `meilleurs-palaces-france`           | 33                     | 12      | 12     | 22        |
| `plus-beaux-hotels-5-etoiles-france` | 2984                   | 12      | 12     | 2972      |

### 4.b — Top 40 classements les plus incomplets (éligibles − entries)

| slug                                        | éligibles | entries | target | manquants |
| ------------------------------------------- | --------- | ------- | ------ | --------- |
| `meilleurs-hotels-anniversaire-france`      | 2984      | 12      | 12     | 2972      |
| `meilleurs-hotels-escapade-france`          | 2984      | 12      | 12     | 2972      |
| `meilleurs-hotels-fetes-france`             | 2984      | 12      | 12     | 2972      |
| `meilleurs-hotels-lune-de-miel-france`      | 2984      | 12      | 12     | 2972      |
| `meilleurs-hotels-mariage-france`           | 2984      | 12      | 12     | 2972      |
| `meilleurs-hotels-minceur-france`           | 2984      | 12      | 12     | 2972      |
| `meilleurs-hotels-seminaire-france`         | 2984      | 12      | 12     | 2972      |
| `meilleurs-hotels-staycation-france`        | 2984      | 12      | 12     | 2972      |
| `meilleurs-hotels-week-end-france`          | 2984      | 12      | 12     | 2972      |
| `plus-beaux-5-etoiles-france`               | 2984      | 12      | 12     | 2972      |
| `plus-beaux-hotels-5-etoiles-france`        | 2984      | 12      | 12     | 2972      |
| `plus-beaux-hotels-france`                  | 2984      | 12      | 12     | 2972      |
| `meilleurs-hotels-famille-france`           | 1876      | 12      | 12     | 1864      |
| `meilleurs-hotels-romantiques-france`       | 1876      | 12      | 12     | 1864      |
| `meilleurs-hotels-spa-france`               | 1876      | 12      | 12     | 1864      |
| `meilleurs-hotels-kids-friendly-france`     | 1506      | 12      | 12     | 1494      |
| `meilleurs-hotels-design-france`            | 1134      | 12      | 12     | 1122      |
| `meilleurs-hotels-montagne-france`          | 982       | 12      | 12     | 970       |
| `meilleurs-hotels-bord-de-mer-france`       | 774       | 12      | 12     | 762       |
| `meilleurs-hotels-charme-france`            | 749       | 12      | 12     | 737       |
| `meilleurs-hotels-gastronomie-france`       | 584       | 12      | 12     | 572       |
| `meilleurs-hotels-ski-france`               | 318       | 12      | 12     | 306       |
| `meilleurs-5-etoiles-etats-unis`            | 276       | 10      | 10     | 266       |
| `meilleurs-hotels-etats-unis`               | 276       | 10      | 10     | 266       |
| `meilleurs-hotels-piscine-france`           | 225       | 12      | 12     | 213       |
| `meilleurs-hotels-urbains-france`           | 190       | 12      | 12     | 178       |
| `plus-beaux-resorts-france`                 | 182       | 12      | 12     | 170       |
| `meilleurs-5-etoiles-italie`                | 173       | 10      | 10     | 163       |
| `meilleurs-hotels-italie`                   | 173       | 10      | 10     | 163       |
| `meilleurs-hotels-vignobles-france`         | 168       | 12      | 12     | 156       |
| `meilleurs-hotels-famille-etats-unis`       | 162       | 10      | 10     | 152       |
| `meilleurs-hotels-romantiques-etats-unis`   | 162       | 10      | 10     | 152       |
| `meilleurs-hotels-spa-etats-unis`           | 162       | 10      | 10     | 152       |
| `meilleurs-hotels-campagne-france`          | 144       | 12      | 12     | 133       |
| `meilleurs-hotels-kids-friendly-etats-unis` | 142       | 10      | 10     | 132       |
| `meilleurs-hotels-rooftop-france`           | 142       | 12      | 12     | 131       |
| `hotel-de-luxe-paris`                       | 128       | 8       | 8      | 120       |
| `meilleurs-5-etoiles-paris`                 | 128       | 8       | 8      | 120       |
| `meilleurs-hotels-urbains-paris`            | 128       | 8       | 8      | 120       |
| `meilleurs-5-etoiles-espagne`               | 124       | 10      | 10     | 114       |

## 5. Classements sous-peuplés (entries < éligibles ET entries < target)

Cas suspects : peu d'entries alors que beaucoup d'éligibles. Ces classements affichent une liste plus courte que ce que le catalogue permet.

Total sous-peuplés : **27**

| slug                                               | éligibles | entries | target | déficit (target−entries) |
| -------------------------------------------------- | --------- | ------- | ------ | ------------------------ |
| `meilleurs-hotels-gastronomie-lac-leman`           | 9         | 3       | 9      | 6                        |
| `meilleurs-hotels-gastronomie-emirats-arabes-unis` | 22        | 6       | 10     | 4                        |
| `meilleurs-hotels-gastronomie-rome`                | 12        | 4       | 8      | 4                        |
| `meilleurs-hotels-gastronomie-sud-ouest`           | 7         | 4       | 7      | 3                        |
| `meilleurs-5-etoiles-centre-val-de-loire`          | 11        | 8       | 10     | 2                        |
| `meilleurs-hotels-gastronomie-alpes`               | 13        | 9       | 10     | 1                        |
| `meilleurs-hotels-gastronomie-bourgogne`           | 4         | 3       | 4      | 1                        |
| `meilleurs-hotels-gastronomie-champagne`           | 5         | 4       | 5      | 1                        |
| `meilleurs-hotels-gastronomie-paris-1`             | 6         | 5       | 6      | 1                        |
| `meilleurs-hotels-gastronomie-reims`               | 4         | 3       | 4      | 1                        |
| `meilleurs-hotels-montagne-cote-d-azur`            | 20        | 9       | 10     | 1                        |
| `meilleurs-hotels-romantiques-santorin`            | 6         | 5       | 6      | 1                        |
| `meilleurs-hotels-romantiques-sud-ouest`           | 19        | 9       | 10     | 1                        |
| `meilleurs-hotels-santorin`                        | 8         | 7       | 8      | 1                        |
| `meilleurs-hotels-sicile`                          | 5         | 4       | 5      | 1                        |
| `meilleurs-hotels-ski-french-riviera`              | 4         | 3       | 4      | 1                        |
| `meilleurs-hotels-ski-nice`                        | 4         | 3       | 4      | 1                        |
| `meilleurs-hotels-spa-alsace`                      | 5         | 4       | 5      | 1                        |
| `meilleurs-hotels-spa-ile-de-france`               | 4         | 3       | 4      | 1                        |
| `meilleurs-hotels-spa-luberon`                     | 4         | 3       | 4      | 1                        |
| `meilleurs-hotels-spa-nice`                        | 7         | 6       | 7      | 1                        |
| `meilleurs-hotels-spa-sud-ouest`                   | 19        | 9       | 10     | 1                        |
| `meilleurs-hotels-urbains-venise`                  | 10        | 7       | 8      | 1                        |
| `meilleurs-hotels-vignobles-champagne`             | 6         | 5       | 6      | 1                        |
| `meilleurs-resorts-emirats-arabes-unis`            | 12        | 9       | 10     | 1                        |
| `meilleurs-villas-cote-d-azur`                     | 5         | 4       | 5      | 1                        |
| `meilleurs-villas-saint-tropez`                    | 4         | 3       | 4      | 1                        |

## 6. Listes de slugs manquants exploitables (échantillon)

### `hotel-de-luxe-paris` — 120 éligibles manquants

```
bulgari-hotel-paris
four-seasons-hotel-george-v
hotel-barriere-le-fouquet-s-paris
hotel-de-crillon-a-rosewood-hotel
hotel-lutetia
la-reserve-paris-hotel-and-spa
le-royal-monceau-raffles-paris
plaza-athenee-paris
1k-paris
banke-hotel-opera-autograph-collection
brach
brach-paris
burgundy
bus-palladium
bvlgari-hotel-paris
canopy-by-hilton-paris-eiffel-tower
chateau-des-fleurs
chateau-voltaire
chteau-des-fleurs
cour-des-vosges
disney-hotel-new-york-the-art-of-marvel
disney-newport-bay
disneyland-hotel
fouquet-s-paris
grand-hotel-du-palais-royal
grand-mazarin
hotel-amour
hotel-atmospheres
balzac-paris
hotel-barriere-le-westminster-le-touquet
hotel-cabane-paris
hotel-castille
hotel-costes
hotel-d-aubusson
hotel-de-buci
hotel-de-sers
hotel-des-grands-voyageurs
hotel-du-louvre-the-unbound-collection
hotel-du-rond-point-des-champs-elysees
hotel-du-sentier
hotel-dupond-smith
hotel-experimental-marais
hotel-fougere
hotel-fouquet-s-paris
hotel-grand-powers
hotel-grands-boulevards-experimental
hotel-hana
hotel-hoy-paris
hotel-jardin-de-cluny
hotel-la-bourdonnais
hotel-marignan-champs-elysees
hotel-molitor-paris-mgallery
hotel-monge
hotel-montalembert
hotel-national-des-arts-et-metiers
hotel-parc-saint-severin
hotel-particulier-montmartre
hotel-raphael
relais-christine
hotel-rochechouart
```

### `hotel-de-luxe-nice` — 2 éligibles manquants

```
hotel-amour-nice
le-meridien-nice
```

### `meilleurs-hotels-nice` — 4 éligibles manquants

```
hotel-amour-nice
hotel-petit-palais
le-meridien-nice
palais-de-la-mediterranee
```

### `plus-beaux-hotels-courchevel` — 8 éligibles manquants

```
fouquets-courchevel
alpes-hotel-du-pralong
hotel-annapurna
l-apogee
le-chabichou
penthouse-ourse-polaire-par-le-collectionist
penthouse-rond-point-des-pistes-701-par-le-collectionist
six-senses-residences-courchevel
```

### `hotel-de-luxe-courchevel` — 8 éligibles manquants

```
fouquets-courchevel
alpes-hotel-du-pralong
hotel-annapurna
l-apogee
penthouse-ourse-polaire-par-le-collectionist
penthouse-rond-point-des-pistes-701-par-le-collectionist
rosewood-courchevel-le-jardin-alpin
six-senses-residences-courchevel
```

### `meilleurs-hotels-rome` — 16 éligibles manquants

```
babuino-181
bulgari-roma
bvlgari-hotel-roma
casa-monti
hotel-d-inghilterra
hotel-de-la-ville-rocco-forte-collection
palazzo-ripetta
hotel-vilon
margutta-19
orient-express-la-minerva
portrait-roma
rocco-forte-house
sofitel-rome-villa-borghese
the-rome-edition
villa-medicis
villa-spalletti-trivelli
```

### `hotel-de-luxe-rome` — 16 éligibles manquants

```
babuino-181
bulgari-roma
bvlgari-hotel-roma
casa-monti
hotel-d-inghilterra
palazzo-ripetta
hotel-vilon
margutta-19
orient-express-la-minerva
palazzo-manfredi
portrait-roma
rocco-forte-house
sofitel-rome-villa-borghese
the-rome-edition
villa-medicis
villa-spalletti-trivelli
```

### `meilleurs-hotels-venise` — 11 éligibles manquants

```
aman-venice
baglioni-hotel-luna
gjelina-hotel
hotel-ai-reali
hotel-cipriani
il-palazzo-experimental
jw-marriott-venice-resort-and-spa
nolinski-venezia
palazzo-garzoni
sina-centurion-palace
st-regis-venice
```

### `hotel-de-luxe-venise` — 11 éligibles manquants

```
aman-venice
baglioni-hotel-luna
gjelina-hotel
hotel-ai-reali
hotel-cipriani
il-palazzo-experimental
jw-marriott-venice-resort-and-spa
nolinski-venezia
palazzo-garzoni
sina-centurion-palace
st-regis-venice
```

### `meilleurs-hotels-marrakech` — 17 éligibles manquants

```
club-med-exclusive-collection-marrakech-le-riad
dar-kemgia
hotel-barriere-le-naoura
ksar-char-bagh
le-naoura
les-deux-tours
les-jardins-de-la-koutoubia
les-jardins-de-la-medina
palais-leonia
royal-mansour
selman-marrakech
sofitel-marrakech-palais-imperial
the-oberoi-marrakech
villa-aman
villa-noria
villa-taj-marrakech
villa-zin
```

### `hotel-de-luxe-marrakech` — 17 éligibles manquants

```
club-med-exclusive-collection-marrakech-le-riad
dar-kemgia
hotel-barriere-le-naoura
palais-ronsard
ksar-char-bagh
le-naoura
les-deux-tours
les-jardins-de-la-koutoubia
palais-leonia
royal-mansour
selman-marrakech
sofitel-marrakech-palais-imperial
the-oberoi-marrakech
villa-aman
villa-noria
villa-taj-marrakech
villa-zin
```

### `meilleurs-hotels-dubai` — 50 éligibles manquants

```
25hours-hotel-dubai-one-central
25hours-hotel-one-central
address-sky-view
al-maha-a-luxury-collection-desert-resort-and-spa-dubai
anantara-the-palm-dubai-resort
anantara-world-islands-dubai-resort
arabian-boutique-hotel
armani-hotel-dubai
atlantis-the-royal-dubai
banyan-tree-dubai-at-bluewaters
bulgari-hotel
bulgari-resort-dubai
bvlgari-hotel-and-resort
fairmont-the-palm
four-seasons-hotel-difc
four-seasons-resort-dubai-at-jumeirah-beach
hotel-indigo-dubai-downtown
jumeirah-beach-hotel
jumeirah-creekside-hotel
jumeirah-dar-al-masyaf
jumeirah-emirates-towers-hotel
jumeirah-marsa-al-arab
jumeirah-mina-a-salam
jumeirah-zabeel-saray
kempinski-central-avenue-dubai
kempinski-hotel-and-residences-palm-jumeirah
kempinski-hotel-mall-of-the-emirates
kempinski-the-boulevard-dubai
mandarin-oriental-downtown
mandarin-oriental-jumeira
mandarin-oriental-jumeirah
me-by-melia
me-dubai
nikki-beach-resort-and-spa-dubai
one-and-only-one-za-abeel
one-and-only-royal-mirage
palazzo-versace-hotel-dubai
pullman-dubai-jumeirah-lakes-towers
raffles-dubai
raffles-the-palm-dubai
six-senses-dubai
sls-dubai
the-lana
the-lana-dorchester-collection
the-ritz-carlton-dubai
the-ritz-carlton-dubai-international-financial-centre
the-st-regis-downtown-dubai
the-st-regis-dubai-the-palm
waldorf-astoria-dubai-international-financial-centre
waldorf-astoria-dubai-palm-jumeirah
```

### `hotel-de-luxe-dubai` — 50 éligibles manquants

```
25hours-hotel-dubai-one-central
25hours-hotel-one-central
address-sky-view
al-maha-a-luxury-collection-desert-resort-and-spa-dubai
anantara-the-palm-dubai-resort
anantara-world-islands-dubai-resort
arabian-boutique-hotel
armani-hotel-dubai
atlantis-the-royal-dubai
banyan-tree-dubai-at-bluewaters
bulgari-hotel
bvlgari-hotel-and-resort
fairmont-the-palm
four-seasons-hotel-difc
four-seasons-resort-dubai-at-jumeirah-beach
hotel-indigo-dubai-downtown
jumeirah-al-naseem
jumeirah-beach-hotel
jumeirah-creekside-hotel
jumeirah-dar-al-masyaf
jumeirah-emirates-towers-hotel
jumeirah-marsa-al-arab
jumeirah-mina-a-salam
jumeirah-zabeel-saray
kempinski-central-avenue-dubai
kempinski-hotel-and-residences-palm-jumeirah
kempinski-hotel-mall-of-the-emirates
kempinski-the-boulevard-dubai
mandarin-oriental-downtown
mandarin-oriental-jumeira
mandarin-oriental-jumeirah
me-by-melia
me-dubai
nikki-beach-resort-and-spa-dubai
one-and-only-royal-mirage
palazzo-versace-hotel-dubai
park-hyatt-dubai
pullman-dubai-jumeirah-lakes-towers
raffles-dubai
raffles-the-palm-dubai
six-senses-dubai
sls-dubai
the-lana
the-lana-dorchester-collection
the-ritz-carlton-dubai
the-ritz-carlton-dubai-international-financial-centre
the-st-regis-downtown-dubai
the-st-regis-dubai-the-palm
waldorf-astoria-dubai-international-financial-centre
waldorf-astoria-dubai-palm-jumeirah
```

### `meilleurs-hotels-italie` — 163 éligibles manquants

```
25hours-piazza-san-paolino
7pines-resort-sardinia
aki-family-resort-plose
albergo-pietrasanta
aman-rosa-alpina
aman-venice
armani-hotel-milano
babuino-181
baglioni-hotel-luna
bellevue-hotel-spa
belmond-hotel-cipriani
belmond-villa-san-michele
belmond-villa-sant-andrea
borgo-dei-conti-resort
borgo-pignano-volterra-tuscany
borgo-san-felice
borgo-santandrea
borgo-santo-pietro
bulgari-hotel-milan
bulgari-hotel-rome
bulgari-roma
bvlgari-hotel-roma
ca-sagredo-hotel
caruso-a-belmond-hotel
casa-maria-luigia
casa-monti
castelfalfi
castelfalfi-florence
castello-di-casole
castello-di-casole-a-belmond-hotel
club-med-pragelato
collegio-alla-querce
como-alpina
como-castello-del-nero
cristallo-resort-and-spa
eight-hotel-portofino
faro-capo-spartivento
forestis-dolomites
four-seasons-hotel-florence
four-seasons-hotel-milan
galleria-vik-milano
gallia-palace-beach-golf-spa-resort
gallicantu
gardena-grodnerhof-hotel-spa
grand-hotel-cocumella
grand-hotel-excelsior-vittoria
grand-hotel-parkers
grand-hotel-savoia
grand-hotel-villa-serbelloni
hermitage-hotel-spa
hotel-ai-reali
bellevue-syrene-1820
caesar-augustus
hotel-calimala
hotel-capo-d-orso-thalasso-and-spa
capofaro-resort
hotel-cappella
castel-fragsburg
castello-banfi-il-borgo
castello-di-guarene
```

### `meilleurs-hotels-espagne` — 114 éligibles manquants

```
7-pines-resort-ibiza
a-quinta-da-auga-hotel-spa
abac-restaurant-and-hotel
aguas-de-ibiza-grand-luxe-hotel
akelarre
akelarre-restaurant-hotel
alhambra-palace-hotel
alma-barcelona
atrio-restaurante-hotel
barcelo-raval
boho-club
brach-madrid
can-meno
casa-camper-hotel-barcelona
casa-de-las-artes
casa-la-siesta
castell-son-claret
chic-and-basic-born
club-med-magna-marbella
divina-suites
dunas-de-formentera
el-fuerte-marbella
el-palace-hotel
faustino-gran-relais-and-chateaux
finca-la-donaira
finca-santa-ponsa
fontenille-santa-ponsa
gran-hotel-mas-d-en-bruno
grand-hotel-central
grand-hotel-son-net
grand-hyatt-barcelona
grand-hyatt-la-manga-club-golf-and-spa
h10-port-vell
heritage-madrid-hotel
hotel-1898
hotel-bagues
hotel-boutique-alicante-palacete-s-xvii
hotel-boutique-hort-de-nal
cap-menorca
hotel-casa-de-las-cuatro-torres
hotel-casa-fuster
hotel-claris
hotel-dormirdcine
echaurren
faustino-gran
fontenille-menorca-torre-vella
helguera-palacio-boutique-antique-hotel
hotel-jazz
la-vella-farga
mirador-de-dalt-vila
molino-de-alcuneza
hotel-neri
hotel-orfila
hotel-palacio-de-villapanes
hotel-unico
hotel-urban-madrid
huerto-del-cura
iberostar-heritage-grand-mencey
iberostar-selection-lanzarote-park
iberostar-selection-marbella-coral-beach
```

### `meilleurs-hotels-japon` — 60 éligibles manquants

```
ace-hotel-kyoto
amanemu
ana-intercontinental-tokyo
andon-ryokan
bettei-senjuan
bulgari-tokyo
conrad-tokyo
enowa-yufuin
fairmont-tokyo
fauchon-l-hotel-kyoto
four-seasons-hotel-kyoto
four-seasons-hotel-tokyo-at-otemachi
four-seasons-marunouchi
fufu-kyoto
gora-kadan-fuji
grand-hyatt-tokyo
hakone-ginyu
homeikan
hoshino-resorts-kai-hakone
asaba
beniya-mukayu
hotel-biaclyn-hakodate
hotel-chinzan-so
hotel-gajoen-tokyo
gora-kadan
nishimuraya-honkan
tenku-no-mori
tobira-onsen-myojinkan
janu-tokyo
kanamean-nishitomiya
kayotei-ryokan
noborioji-hotel-nara
park-hotel-tokyo
park-hyatt-tokyo
roka-ryokan
rosewood-miyakojima
ryokan-asakusa-shigetsu
ryokan-hiiragiya
ryokan-ryumeikan-honten
ryokan-sawanoya
ryokan-sowaka
shangri-la-hotel-tokyo
six-senses-kyoto
the-agnes-hotel-and-apartments
the-capitol-hotel-tokyu
the-gate-hotel-kaminarimon
the-kitano-hotel-tokyo
the-prince-park-tower-tokyo
the-ritz-carlton-fukuoka
the-ritz-carlton-nikko
the-ritz-carlton-okinawa
the-ritz-carlton-osaka
the-ritz-carlton-tokyo
the-shinmonzen
the-st-regis-osaka
the-strings-tokyo-by-intercontinental
the-tokyo-edition-toranomon
the-tokyo-station-hotel
the-uza-terrace-beach-club-villas
the-westin-tokyo
```

### `meilleurs-hotels-maroc` — 32 éligibles manquants

```
club-med-exclusive-collection-marrakech-le-riad
dar-kemgia
four-seasons-hotel-casablanca
four-seasons-hotel-marrakech
hotel-barriere-le-naoura
chateau-roslane
heure-bleue-palais
hotel-le-doge
palais-ronsard
riad-fes
hotel-sahrai
ksar-char-bagh
la-villa-des-orangers
le-naoura
les-deux-tours
les-jardins-de-la-koutoubia
les-jardins-de-la-medina
nobu-hotel-marrakech
palais-faraj
palais-leonia
park-hyatt-marrakech
riad-dar-lys
riad-el-amine
royal-mansour
selman-marrakech
sofitel-marrakech-palais-imperial
the-oberoi-marrakech
villa-aman
villa-mabrouka
villa-noria
villa-taj-marrakech
villa-zin
```

### `palaces-spa-bien-etre` — 22 éligibles manquants

```
bulgari-hotel-paris
cheval-blanc-paris
cheval-blanc-st-barth
cheval-blanc-saint-tropez
four-seasons-megeve
hotel-barriere-le-fouquet-s-paris
hotel-de-crillon-a-rosewood-hotel
hotel-du-cap-eden-roc
le-bristol-paris
hotel-lutetia
hotel-martinez
hotel-royal-evian
hotel-the-peninsula-paris
fouquets-courchevel
le-k2-palace
le-meurice
le-royal-monceau-raffles-paris
les-airelles-courchevel
plaza-athenee-paris
le-royal-champagne-hotel-spa
shangri-la-paris
villa-la-coste
```

### `palaces-romantiques-france` — 21 éligibles manquants

```
bulgari-hotel-paris
cheval-blanc-paris
cheval-blanc-st-barth
cheval-blanc-saint-tropez
four-seasons-megeve
hotel-barriere-le-fouquet-s-paris
hotel-du-cap-eden-roc
hotel-martinez
hotel-royal-evian
lapogee-courchevel
la-reserve-ramatuelle
fouquets-courchevel
le-k2-palace
le-meurice
le-royal-monceau-raffles-paris
les-airelles-courchevel
les-sources-de-caudalie
plaza-athenee-paris
le-royal-champagne-hotel-spa
shangri-la-paris
villa-la-coste
```

### `palaces-gastronomie-michelin` — 21 éligibles manquants

```
bulgari-hotel-paris
cheval-blanc-paris
cheval-blanc-st-barth
cheval-blanc-saint-tropez
four-seasons-megeve
grand-hotel-cap-ferrat
hotel-barriere-le-fouquet-s-paris
hotel-du-cap-eden-roc
hotel-martinez
hotel-royal-evian
lapogee-courchevel
la-reserve-paris-hotel-and-spa
la-reserve-ramatuelle
fouquets-courchevel
le-k2-palace
les-airelles-courchevel
les-pres-deugenie
les-sources-de-caudalie
le-royal-champagne-hotel-spa
shangri-la-paris
villa-la-coste
```

### `meilleurs-palaces-france` — 22 éligibles manquants

```
bulgari-hotel-paris
cheval-blanc-paris
cheval-blanc-st-barth
cheval-blanc-saint-tropez
four-seasons-megeve
grand-hotel-cap-ferrat
hotel-barriere-le-fouquet-s-paris
hotel-du-cap-eden-roc
hotel-martinez
lapogee-courchevel
la-reserve-ramatuelle
fouquets-courchevel
le-k2-palace
le-meurice
le-royal-monceau-raffles-paris
les-airelles-courchevel
les-pres-deugenie
les-sources-de-caudalie
plaza-athenee-paris
le-royal-champagne-hotel-spa
shangri-la-paris
villa-la-coste
```

### `plus-beaux-hotels-5-etoiles-france` — 2972 éligibles manquants

```
bulgari-hotel-paris
cheval-blanc-paris
cheval-blanc-st-barth
cheval-blanc-saint-tropez
four-seasons-megeve
hotel-barriere-le-fouquet-s-paris
hotel-du-cap-eden-roc
hotel-martinez
hotel-royal-evian
lapogee-courchevel
la-reserve-ramatuelle
fouquets-courchevel
le-k2-palace
le-royal-monceau-raffles-paris
les-airelles-courchevel
les-pres-deugenie
les-sources-de-caudalie
plaza-athenee-paris
le-royal-champagne-hotel-spa
shangri-la-paris
villa-la-coste
and-beyond-punakha-river-lodge
and-beyond-vira-vira
11-cadogan-gardens
1898-the-post
1k-paris
21-foch
21c-museum-hotel-chicago
25hours-hotel-dubai-one-central
25hours-hotel-one-central
25hours-piazza-san-paolino
41-hotel
45-park-lane
48-nord-landscape-h-tel
5-terres-hotel-spa-mgallery-by-sofitel
6717-nature-hotel-and-spa
7-pines-resort-ibiza
70-hectares-and-l-ocean
7132-hotel
717-hotel
7pines-resort-sardinia
a-quinta-da-auga-hotel-spa
abac-restaurant-and-hotel
abbaye-des-vaux-de-cernay
ace-hotel-kyoto
ace-hotel-new-york
acro-suites
acro-wellness-suites
address-sky-view
adina-apartment
adriatik-hotel
aggello-boutique-hotel
aguas-de-ibiza-grand-luxe-hotel
ahama
aida-hotel-spa
aka-back-bay
akelarre
akelarre-restaurant-hotel
aki-family-resort-plose
al-bustan-palace-a-ritz-carlton-hotel
```

## 7. Classements publiés à 0 entry

Total : **0**

## 8. Synthèse & recommandations (à arbitrer par le lead)

### Constats chiffrés

1. **826 hôtels orphelins (27,7 %)** ne sont cités dans aucun classement publié → perte de
   maillage interne sèche sur plus d'un quart du catalogue.
2. **La France est le maillon faible** : 58,4 % de couverture (308 orphelins / 741) contre
   76,9 % à l'international. Paris seul = 59 orphelins (incl. `plaza-athenee-paris`,
   `le-meurice`, `bvlgari-hotel-paris`, `cheval-blanc-paris`…), souvent des fiches doublon
   ou non rattachées à un seed parisien.
3. **0 palace officiel orphelin** (les 33 sont maillés) — mais **64 Relais & Châteaux** et de
   nombreuses grandes marques (Ritz-Carlton 44, Kempinski 30, Four Seasons 25) sont absentes
   de tout classement.
4. **27 classements sous-peuplés** (`entries < target`) = vrais trous à régénérer (déficits
   1→6 entries), surtout la famille `gastronomie-*` (Lac Léman 3/9, ÉAU 6/10, Rome 4/8).
5. **129 classements publiés (854 − 725) ne sont pas mappables à un seed** combinator (chain
   `top-*-monde`, curated Travel+Leisure) → hors périmètre éligibilité, attendu.

### Causes structurelles

- Le `target` par scope (8/10/12) **plafonne** mécaniquement le maillage : un hôtel hors du
  top-N de sa ville n'apparaît nulle part même s'il est éligible. C'est le principal moteur
  des 826 orphelins, pas un manque de classements.
- Des **villes/régions FR à inventaire moyen** n'ont pas de classement dédié (Angers,
  La Rosière, Tignes, Wengen…) → leurs hôtels n'ont aucun seed d'accueil.

### Recommandations de remédiation (priorisées)

1. **Régénérer les 27 classements sous-peuplés (§5)** pour combler les `entries < target` —
   gain rapide, faible coût LLM, surtout la série `gastronomie-*` et `meilleurs-hotels-santorin`,
   `-sicile`, `-spa-nice`.
2. **Densifier les classements à fort vivier** en relevant le `target` des scopes ville/pays
   riches (Dubaï 58 éligibles → 8 cités, Italie 173 → 10, Espagne 124 → 10, Maroc 42 → 10,
   Japon 70 → 10) : passer ville à 10-12 et pays à 12-15 ramènerait des centaines d'hôtels
   dans le maillage. Décision éditoriale (longueur de page vs maillage).
3. **Créer les classements FR manquants** pour les villes/stations orphelines à ≥ 4 hôtels
   (Paris arrondissements non couverts, Angers, Tignes/La Rosière via un head Tarentaise,
   etc.) — vérifier l'éligibilité ≥ MIN_ELIGIBLE avant.
4. **Rattacher les hôtels phares orphelins** : ajouter un classement « Meilleurs Relais &
   Châteaux » (64 orphelins) et des heads marque (Ritz-Carlton, Kempinski) sur le modèle des
   chain rankings existants ; injecter les Paris orphelins (Plaza Athénée, Le Meurice…) dans
   un seed parisien (vérifier doublons de fiches `bvlgari-hotel-paris` vs `bulgari-hotel-paris`).
5. **Nettoyer les doublons de fiches** détectés dans les listes manquantes
   (`bulgari-hotel-paris`/`bvlgari-hotel-paris`, `four-seasons-georges-v`/`four-seasons-hotel-george-v`,
   `mandarin-oriental-jumeira`/`-jumeirah`, `akelarre`/`akelarre-restaurant-hotel`,
   `chateau-des-fleurs`/`chteau-des-fleurs`) — ils gonflent les compteurs d'éligibles et
   polluent le maillage.

> La décision de régénération / ajout / relèvement de `target` revient au lead. Ce document
> ne fait qu'auditer et lister les candidats exploitables (slugs en §6).
