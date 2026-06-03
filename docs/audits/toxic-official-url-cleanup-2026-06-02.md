# Toxic `official_url` cleanup — 2026-06-02

## Context

Phase 1.5 `external_sources` backfill. Of the 849 published hotels with no
`external_sources` provenance, 827 carried an `official_url` but **0** had a
`wikidata_id`. A blind run of
`scripts/editorial-pilot/src/enrichment/convert-wikidata-to-external-sources.ts`
would have (a) projected these URLs into the EEAT provenance array served to
LLMs + rendered in `<HotelExternalSourcesFooter>`, and (b) mislabelled them
`source: 'wikidata'` (the script assumes `official_url` was resolved via
Wikidata P856, which is false for this scaffold-promoted cohort).

Auditing the `official_url` values surfaced a large block of **SEO-squatter /
OTA / booking-engine** domains auto-scraped during the scaffold pass. These
are objectively wrong data regardless of `external_sources` and were already
polluting prod for the 77 hotels where a previous conversion run had projected
them.

## Detection (host-anchored, no brand false positives)

A first naive regex matched `hotels\.com` as a substring and caught dozens of
**legitimate brand domains** (`rosewoodhotels.com`, `bulgarihotels.com`,
`comohotels.com`, `tajhotels.com`, `langhamhotels.com`, `regenthotels.com`,
`25hours-hotels.com`, `roccofortehotels.com`, `standardhotels.com`,
`ovolohotels.com`, `h10hotels.com`, `cordishotels.com`, `sources-hotels.com`,
`lhm-hotels.com`, `capellahotels.com`, `oberoihotels.com`,
`starwoodhotels.com`). Those were **excluded** by anchoring the OTA names to
the registrable domain.

Final predicate (all `~*`, case-insensitive):

```
official_url ~* '\.com-hotel\.(com|info)(/|$)'                                   -- squatter
or official_url ~* '\.(ae-dubai|sa-riyadh|uk-hotel)\.info(/|$)'                  -- squatter
or official_url ~* '://([a-z0-9-]+\.)*hotel[a-z]+\.info(/|$)'                    -- hotel{city}.info squatter
or official_url ~* 'h-rez\.com'                                                 -- booking engine
or official_url ~* '://([a-z0-9-]+\.)*(tripadvisor\.[a-z.]+|trip\.com|booking\.com|agoda\.com|hotels\.com|expedia\.[a-z.]+|trivago\.[a-z.]+|kayak\.[a-z.]+|hostelworld\.com|ostrovok\.ru|makemytrip\.com)(/|$)'  -- OTA
```

## Impact

- **140 published hotels** matched. Breakdown: ~129 squatter domains
  (`.com-hotel.com` / `.com-hotel.info` / `{cc}-{city}.info` /
  `hotel{city}.info`), **8** booking engines (`h-rez.com`), **3** OTA
  (`tripadvisor.in` ×2, `us.trip.com` ×1).
- **77** of the 140 had the toxic URL **already projected into
  `external_sources`** (live EEAT pollution on prod) → those entries were
  stripped too.

## Actions taken

1. `UPDATE hotels SET official_url = NULL` for the 140 matched rows.
2. Stripped `external_sources` array elements whose `value` or `source_url`
   matched the same toxic predicate (77 rows). Arrays that became empty were
   left as `[]` (the footer self-elides, the reader treats empty as no
   provenance).

## Reversibility

The toxic values were **wrong data** (squatter/OTA), so no rollback is
intended. If ever needed, the full slug → URL list is preserved below and the
stripped `external_sources` entries were pure derivations of `official_url`
(reconstructible). Cloudinary / Supabase row identity untouched.

## Follow-up

These 140 hotels now lack any `official_url`. A future enrichment pass should
re-source a **real** official site (Tavily extract on the hotel name + city,
or Wikidata P856 resolution via `enrich-wikidata-ids.ts`) before re-projecting
into `external_sources`. Until then they simply carry no "official site"
reference — which is correct (better no link than a spam link).

## Full matched list (slug → toxic official_url)

| slug                                                 | toxic official_url                                           |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| cayo-guillermo-resort-kempinski-cuba                 | cayoguillermoresortkempinski.com-hotel.com/amp/fr            |
| 25hours-piazza-san-paolino                           | 25hourshotelflorencepiazzasanpaolino.com-hotel.com           |
| address-sky-view                                     | addressskyview.ae-dubai.info                                 |
| adina-apartment                                      | adinaapartmentbrisbaneanzacsquare.com-hotel.info             |
| les-airelles-gordes                                  | airellesgordeslabastide.com-hotel.com                        |
| al-mashreq-boutique-hotel                            | almashreqboutiquehotel.sa-riyadh.info                        |
| anantara-plaza-nice                                  | anantaraplazanicehotelaleadinghoteloftheworld.com-hotel.com  |
| anantara-the-palm-dubai-resort                       | anantarathepalmresort.ae-dubai.info                          |
| anantara-world-islands-dubai-resort                  | anantaraworldislands.ae-dubai.info                           |
| anse-chastanet                                       | ansechastanetresort.com-hotel.com                            |
| l-auberge-basque                                     | auberge-stpee-sur-nivelle.h-rez.com                          |
| babuino-181                                          | babuino181hotelrome.com-hotel.com                            |
| bolontiku-boutique-hotel                             | bolontikuhotelboutique.com-hotel.com                         |
| brach                                                | brachparisparis.com-hotel.com                                |
| hostellerie-briqueterie-and-spa                      | briqueteriechampagne.com-hotel.com                           |
| bulgari-roma                                         | bvlgarihotelroma.com-hotel.com                               |
| capesounio                                           | capesouniogrecotelexclusiveresort.com-hotel.com              |
| jumeirah-capri-palace                                | capripalacejumeirah.com-hotel.com                            |
| castello-banfi-il-borgo                              | castellobanfiilborgo.com-hotel.com                           |
| chateau-d-audrieu                                    | chateaudaudrieu.com-hotel.com                                |
| chateau-de-la-gaude                                  | chateaudelagaude.com-hotel.com                               |
| chateau-de-valmer                                    | chateaudevalmer.com-hotel.com                                |
| chateau-monfort                                      | chateaumonfort.com-hotel.com                                 |
| clarance-hotel                                       | clarancehotellille.com-hotel.com                             |
| como-parrot-cay                                      | como-shambhala-retreat.h-rez.com                             |
| como-alpina                                          | comoalpinadolomites.com-hotel.com                            |
| corfuimperial                                        | corfuimperialgrecotelbeachluxeresort.com-hotel.com           |
| correntoso-lake-and-river-hotel                      | correntosolakeriverhotel.com-hotel.com                       |
| coworth-park                                         | coworthparkdorchestercollection.uk-hotel.info                |
| crystalbrook-vincent                                 | crystalbrookvincent.com-hotel.info                           |
| eight-hotel-portofino                                | eight.hotelportofino.info/en                                 |
| fairmont-riyadh                                      | fairmont.sa-riyadh.info                                      |
| forestis-dolomites                                   | forestisdolomites.com-hotel.com                              |
| four-seasons-hotel-riyadh                            | fourseasons.sa-riyadh.info                                   |
| four-seasons-georges-v                               | fourseasonshotelgeorgevparis.com-hotel.com                   |
| four-seasons-megeve                                  | fourseasonshotelmegeve.com-hotel.com                         |
| four-seasons-hotel-ritz-lisbon                       | fourseasonshotelritzlisbon.com-hotel.com                     |
| grace-cafayate                                       | gracecafayatehotel.com-hotel.com                             |
| grace-hotel-auberge-resorts-collection               | gracehotelsantorini.com-hotel.com                            |
| astirpalace                                          | grecotelastirpalace.com-hotel.com                            |
| casa-paradiso                                        | grecotelcasaparadiso.com-hotel.com                           |
| eva-palace                                           | grecotelevapalace.com-hotel.com                              |
| la-riviera-peloponnese                               | grecotellarivieraaquapark.com-hotel.com                      |
| luxme-damadama                                       | grecotelluxmedamadama.com-hotel.com                          |
| luxme-daphnilabay                                    | grecotelluxmedaphnilabay.com-hotel.com                       |
| luxme-whitepalace                                    | grecotelluxmewhite.com-hotel.com                             |
| marine-palace                                        | grecotelmarinepalaceaquapark.com-hotel.com                   |
| hotel-1898                                           | hotel1898barcelona.com-hotel.com                             |
| hotel-calimala                                       | hotelcalimala.com-hotel.com                                  |
| echaurren                                            | hotelechaurrenrelais.com-hotel.com                           |
| hotel-hana                                           | hotelhana.com-hotel.com                                      |
| hotel-jazz                                           | hoteljazzbarcelona.com-hotel.com                             |
| londra-palace-venezia                                | hotellondrapalacevenezia.com-hotel.com                       |
| maison-colbert                                       | hotelmaisoncolbert.com-hotel.com                             |
| hotel-marignan-champs-elysees                        | hotelmarignanchampselysees.com-hotel.com                     |
| murmuri-hotel-barcelona                              | hotelmurmuribarcelona.com-hotel.com                          |
| palazzo-manfredi                                     | hotelpalazzomanfrediroma.com-hotel.com                       |
| hotel-parador-santa-catarina                         | hotelparadorsantacatarina.com-hotel.com                      |
| hotel-regency                                        | hotelregencyflorence.com-hotel.com                           |
| relais-il-falconiere-spa                             | ilfalconiererelais.com-hotel.com                             |
| il-salviatino-florence-italy                         | ilsalviatinohotel.com-hotel.com                              |
| jade-mountain                                        | jademountainhotelstlucia.com-hotel.com                       |
| jumeirah-mallorca                                    | jumeirahmallorca.com-hotel.com                               |
| kasbah-tamadot                                       | kasbahtamadot.com-hotel.com                                  |
| kempinski-hotel-frankfurt-gravenbruch                | kempinski-hotel-frankfurt.h-rez.com                          |
| kempinski-central-avenue-dubai                       | kempinskicentralavenue.ae-dubai.info                         |
| la-bastide-de-saint-tropez                           | labastidedesainttropez.com-hotel.com                         |
| hotel-la-borde                                       | labordeteritoria.com-hotel.com                               |
| la-fantaisie                                         | lafantaisie.com-hotel.com                                    |
| la-reserve-paris-hotel-and-spa                       | lareserveparishotelspa.com-hotel.com                         |
| las-ventanas-al-paraiso-a-rosewood-resort            | las-ventanas-al-paraiso.h-rez.com                            |
| grand-mazarin                                        | legrandmazarin.com-hotel.com                                 |
| hameau-albert-1er                                    | lehameaualbert1er.com-hotel.com                              |
| le-meridien-essex-chicago                            | lemeridienessex.hotelchicago.info/en                         |
| le-narcisse-blanc                                    | lenarcisseblanchotelparis.com-hotel.com                      |
| le-petit-nice-passedat                               | lepetitpassedat.hotelmarseille.info/en                       |
| hotel-le-pigonnet                                    | lepigonnethotelaixenprovence.com-hotel.com                   |
| le-roch-hotel-and-spa                                | lerochhotelspa.com-hotel.com                                 |
| le-sirenuse                                          | lesirenusehotel.com-hotel.com                                |
| les-jardins-de-la-koutoubia                          | lesjardinsdelakoutoubia.com-hotel.com                        |
| les-sources-de-caudalie                              | lessourcesdecaudalie.com-hotel.com                           |
| le-vieux-logis                                       | levieuxlogis.com-hotel.com                                   |
| little-palm-island                                   | little-palm-island-resort.h-rez.com                          |
| margutta-19                                          | margutta19hotel.com-hotel.com                                |
| minos-beach-art-hotel                                | minosbeacharthotel.com-hotel.com                             |
| molino-de-alcuneza                                   | molinodealcunezarelaischateauxhotel.com-hotel.com            |
| mondrian-bordeaux-les-carmes                         | mondrianbordeauxlescarmes.com-hotel.com                      |
| monsieur-george                                      | monsieurgeorgehotelspachampselysees.com-hotel.com            |
| monsieur-george-hotel-and-spa                        | monsieurgeorgehotelspachampselysees.com-hotel.com            |
| muse-saint-tropez                                    | musesainttropezramatuelle.com-hotel.com                      |
| mykonosblu                                           | mykonosblugrecotelboutiqueresort.com-hotel.com               |
| one-and-only-the-palm-dubai                          | oneonlythepalmdubai.ae-dubai.info                            |
| ovolo-south-yarra                                    | ovolosouthyarra.com-hotel.info                               |
| ovolo-the-valley                                     | ovolothevalleybrisbane.com-hotel.info                        |
| palazzo-ripetta                                      | palazzoripetta.com-hotel.com                                 |
| park-hyatt-chicago                                   | parkhyatt.hotelchicago.info/en                               |
| passalacqua                                          | passalacqua.com-hotel.com                                    |
| penha-longa-resort                                   | penhalongaresort.com-hotel.com                               |
| praktik-rambla                                       | praktikramblabarcelona.com-hotel.com                         |
| aguas-de-ibiza-grand-luxe-hotel                      | quilibra-aguas-de-ibiza.h-rez.com                            |
| raffles-the-palm-dubai                               | rafflesthepalm.ae-dubai.info                                 |
| le-chambard                                          | relaisetchateauxlechambard.com-hotel.com                     |
| the-ritz-carlton-marina-del-rey                      | ritz-carlton-marinadelrey.h-rez.com                          |
| hotel-de-la-ville-rocco-forte-collection             | roccofortehoteldelaville.com-hotel.com                       |
| hotel-de-russie-rocco-forte-collection               | roccofortehotelderussie.com-hotel.com                        |
| romazzino                                            | romazzino.com-hotel.com                                      |
| romeo-napoli                                         | romeohotelnaples.com-hotel.com                               |
| rosewood-villa-magna                                 | rosewoodvillamagna.com-hotel.com                             |
| six-senses-ibiza                                     | sixsensesibiza.com-hotel.com                                 |
| sls-dubai                                            | slshotel.ae-dubai.info/fr                                    |
| sofitel-le-scribe-paris-opera                        | sofitellescribeparisopera.com-hotel.com                      |
| sofitel-paris-baltimore-tour-eiffel                  | sofitelparisbaltimoretoureiffel.com-hotel.com                |
| sofitel-rome-villa-borghese                          | sofitelromavillaborghese.com-hotel.com                       |
| spicers-peak-lodge                                   | spicers-peak-ldg-maryvale.h-rez.com                          |
| the-calile                                           | thecalile.com-hotel.info                                     |
| the-gainsborough-bath-spa                            | thegainsboroughbath.uk-hotel.info                            |
| the-gritti-palace-a-luxury-collection-hotel-venice   | thegrittipalacevenice.com-hotel.com/fr                       |
| the-lana                                             | thelanadorchestercollection.ae-dubai.info                    |
| the-ritz-carlton-dubai                               | theritzcarlton.ae-dubai.info                                 |
| the-ritz-carlton-riyadh                              | theritzcarlton.sa-riyadh.info                                |
| the-ritz-carlton-fukuoka                             | theritzcarltonfukuoka.com-hotel.info                         |
| the-ritz-carlton-grand-cayman                        | theritzcarltongrandcayman.com-hotel.com                      |
| the-st-regis-riyadh                                  | thestregis.sa-riyadh.info                                    |
| the-st-regis-downtown-dubai                          | thestregisdowntown.ae-dubai.info                             |
| the-st-regis-mardavall-mallorca-resort               | thestregismardavallmallorcaresort.com-hotel.com              |
| the-st-regis-dubai-the-palm                          | thestregisthepalm.ae-dubai.info                              |
| the-yeatman                                          | theyeatmanhotelvilanovadegaia.com-hotel.com                  |
| tiara-miramar-beach-hotel-and-spa                    | tiaramiramarbeachresort.com-hotel.com                        |
| tiara-miramar-beach-resort                           | tiaramiramarbeachresort.com-hotel.com                        |
| urso-hotel-and-spa                                   | ursohotelmadrid.com-hotel.com                                |
| four-seasons-hotel-chengdu                           | us.trip.com/hotels/chengdu-hotel-detail-114013787/...        |
| valverde-lisboa-hotel-garden                         | valverdehotellisboa.com-hotel.com                            |
| hotel-vermelho                                       | vermelhomelides.com-hotel.com                                |
| verride-palacio-de-santa-catarina                    | verridepalaciosantacatarina.com-hotel.com                    |
| villa-florentine                                     | villaflorentine.com-hotel.com                                |
| villa-maia                                           | villamaia.com-hotel.com/en/owner/contact                     |
| waldorf-astoria-dubai-international-financial-centre | waldorfastoriainternationalfinancialcentre.ae-dubai.info     |
| waldorf-astoria-panama-city                          | waldorfastoriapanamahotel.com-hotel.com                      |
| alex-lake-zurich                                     | tripadvisor.in/Hotel_Review-...Alex_Lake_Zurich-Thalwil.html |
| park-hyatt-chennai                                   | tripadvisor.in/Hotel_Review-...Park_Hyatt_Chennai...         |
