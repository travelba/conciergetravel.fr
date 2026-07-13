# Checklist bascule v2 — MyConciergeHotel.com

> Phase 7 SEO bascule prep. Gate PO avant bascule DNS (Q14).
> Références : [`url-mapping-v1-v2.md`](./url-mapping-v1-v2.md) ·
> [`baseline-seo-snapshot.md`](./baseline-seo-snapshot.md) · CDC v2 §9.

---

## 1. Prérequis (avant J-7)

| #   | Tâche                                                                       | Responsable | Statut |
| --- | --------------------------------------------------------------------------- | ----------- | ------ |
| 1.1 | Capturer baseline GSC/GA4 dans `baseline-seo-snapshot-YYYY-MM-DD.md`        | PO / SEO    | ☐      |
| 1.2 | Vérifier `apps/web-v2` build prod (`pnpm --filter @mch/web-v2 build`)       | Eng         | ☐      |
| 1.3 | Preview Vercel v2 walk-through FR + EN (home, SRP, fiche, programme-membre) | PO          | ☐      |
| 1.4 | Valider MCP : `GET /api/mcp` + `tools/call get_hotel` sur preview           | Eng         | ☐      |
| 1.5 | Valider `/.well-known/agent-skills.json` + `/llms.txt` sur preview          | Eng         | ☐      |

---

## 2. Audit URLs (échantillon + automatisé)

### 2.1 Cœur catalogue — **conservé** (zéro 301)

Vérifier HTTP 200 + canonical self sur un échantillon de 20 URLs :

- `/` · `/en`
- `/hotel/le-meurice` · `/en/hotel/le-meurice`
- `/recherche` · `/en/search`
- `/hotels/france/paris`
- `/classement/meilleurs-palaces-paris` · `/classements`
- `/programme-membre` · `/en/member-program`

**Outil** : Screaming Frog (liste import) ou script curl batch.

### 2.2 Redirects 301 obligatoires (v2 `next.config.ts`)

| Source v1                     | Cible v2                   | Test  |
| ----------------------------- | -------------------------- | ----- |
| `/le-concierge-club`          | `/programme-membre`        | ☐ 301 |
| `/le-concierge-club/prestige` | `/programme-membre`        | ☐ 301 |
| `/en/the-concierge-club`      | `/en/member-program`       | ☐ 301 |
| `/presse/le-concierge-club`   | `/presse/programme-membre` | ☐ 301 |
| `/le-concierge/fidelite`      | `/programme-membre`        | ☐ 301 |
| `/en/le-concierge/loyalty`    | `/en/member-program`       | ☐ 301 |
| `/compte/rejoindre`           | `/compte/inscription`      | ☐ 301 |

Liste complète : [`url-mapping-v1-v2.md`](./url-mapping-v1-v2.md) §4–5.

### 2.3 hreflang

- [ ] SRP, fiche hôtel, classement : paires `fr-FR` / `en` + `x-default` → FR
- [ ] Sub-sitemaps `hotels.xml` / `rankings.xml` : `<xhtml:link>` alternates présents
- [ ] Pas de hreflang croisé vers domaine v1 après bascule

---

## 3. Sitemaps & robots

| URL                      | Attendu                                        | Statut |
| ------------------------ | ---------------------------------------------- | ------ |
| `/sitemap.xml`           | Index → `hotels.xml` + `rankings.xml`          | ☐      |
| `/sitemaps/hotels.xml`   | Tous slugs indexables (demo → read-model prod) | ☐      |
| `/sitemaps/rankings.xml` | Tous classements publiés                       | ☐      |
| `/robots.txt`            | `Sitemap: https://…/sitemap.xml`               | ☐      |

Post-bascule : remplacer l’URL sitemap dans GSC si property change.

---

## 4. JSON-LD & rich results

Échantillon 5 fiches (Palace FR + EN) :

- [ ] `Hotel` + `@context` schema.org
- [ ] `AggregateRating` : `bestRating: 5` (jamais 10 — ADR-0032)
- [ ] `FAQPage` aligné sur contenu visible
- [ ] Pas de bloc `Offer` avant Phase 6 booking APIs
- [ ] Rich Results Test Google : 0 erreur bloquante

---

## 5. Surfaces agentiques (Phase 6)

| Surface      | URL                              | Statut |
| ------------ | -------------------------------- | ------ |
| agent-skills | `/.well-known/agent-skills.json` | ☐      |
| MCP          | `/api/mcp` (JSON-RPC)            | ☐      |
| llms.txt     | `/llms.txt`                      | ☐      |
| search       | `POST /api/agent/search`         | ☐      |
| hotel        | `GET /api/agent/hotel/{slug}`    | ☐      |
| ranking      | `GET /api/agent/ranking/{slug}`  | ☐      |
| quote        | `POST /api/agent/quote`          | ☐      |

Sync contract : tout nouvel outil MCP ⇒ mettre à jour `agent-skills.json` + `llms.txt` + handlers partagés.

---

## 6. Soumission Google Search Console (J-0 → J+7)

1. **Property** : confirmer domaine ou URL-prefix (`https://myconciergehotel.com/`)
2. **Baseline** : exporter impressions/clics 28j (voir baseline doc §3)
3. **Sitemap** : soumettre `/sitemap.xml` (pas les sub-sitemaps individuellement)
4. **Inspection URL** : tester 10 URLs stratégiques (home, 3 fiches, 2 classements, programme-membre, SRP)
5. **Monitoring J+1 / J+7 / J+28** :
   - Couverture index (pages valides vs exclues)
   - Erreurs hreflang
   - Erreurs rich results Hotel/FAQ
   - 404 spike post-301 Club → programme-membre
6. **Bing Webmaster Tools** : resoumettre sitemap (miroir GSC)

---

## 7. Rollback

| Déclencheur                            | Action                                   |
| -------------------------------------- | ---------------------------------------- |
| 500 > 1 % sur routes indexables 15 min | Revert deploy Vercel → v1                |
| Canonical mass-wrong                   | Hotfix ou rollback DNS                   |
| 301 loop Club/programme                | Fix `next.config.ts` redirects, redeploy |

Conserver snapshot DNS TTL + config Vercel v1 taguée avant bascule.

---

## 8. Sign-off PO

| Gate                               | Validé | Date |
| ---------------------------------- | ------ | ---- |
| URL audit échantillon OK           | ☐      |      |
| 301 Club → programme-membre OK     | ☐      |      |
| Sitemap + GSC soumis               | ☐      |      |
| MCP + agent-skills live            | ☐      |      |
| Baseline post-bascule J+7 planifié | ☐      |      |

**Décision bascule DNS** : ☐ Go · ☐ No-go — _commentaire PO_
