# Runbook — Migration domaine `myconciergehotel.com`

Référence pour finaliser la migration de l'ancien domaine vers
`myconciergehotel.com` (apex) après les décisions prises en chat le 19 mai 2026.

## Décisions prises

| Sujet          | Choix        | Note                                                        |
| -------------- | ------------ | ----------------------------------------------------------- |
| Canonical      | **apex**     | `https://myconciergehotel.com/...`                          |
| Ancien domaine | **redirect** | 308 vers la URL équivalente sur apex                        |
| DNS strategy   | **records**  | Records DNS gérés au registrar, **pas** délégation à Vercel |

## D1 — Redirect `www.` → apex (308) côté Vercel

Cible : éviter le canonical split. Tout trafic sur `www.myconciergehotel.com`
doit retourner un **308 Permanent Redirect** vers `myconciergehotel.com`.

### Étapes (Vercel dashboard — 5 min)

1. Ouvrir [https://vercel.com/dashboard](https://vercel.com/dashboard) →
   projet **myconciergehotel**.
2. Onglet **Settings** → **Domains**.
3. Vérifier que `myconciergehotel.com` (apex) est listé en **Primary**.
4. Si `www.myconciergehotel.com` est listé comme primary, cliquer **...** →
   **Edit** → cocher **Redirect to** : `myconciergehotel.com`, status code
   **308 Permanent Redirect**.
5. Si `www.` n'est pas encore listé : **Add Domain** →
   `www.myconciergehotel.com` → laisser Vercel détecter, puis cocher
   **Redirect to** apex (308).
6. Valider que la résolution DNS du `www.` pointe bien vers Vercel
   (CNAME `cname.vercel-dns.com` côté registrar).

### Vérification post-déploiement

```bash
curl -I https://www.myconciergehotel.com
# Attendu :
#   HTTP/2 308
#   location: https://myconciergehotel.com/

curl -I https://myconciergehotel.com
# Attendu :
#   HTTP/2 200
```

## D2 — Google Search Console : propriété + sitemap + Change of Address

Cible : Google indexe le bon domaine et transfère l'autorité de l'ancien.

### Étapes (GSC — 15 min)

1. Aller sur [https://search.google.com/search-console](https://search.google.com/search-console).
2. **Ajouter une propriété** → type **Domaine** (pas URL-prefix) →
   saisir `myconciergehotel.com`. Vérifier via record TXT DNS.
3. Une fois la propriété **vérifiée** :
   - Aller dans **Sitemaps** (menu latéral).
   - Soumettre `https://myconciergehotel.com/sitemap.xml`.
   - Attendre 24-48h, vérifier que `lastReadDate` est récent et que
     "URLs detected" ≥ nombre attendu (hotels + guides + pages statiques).
4. **Change of Address** (seulement si l'ancien domaine est différent) :
   - Ouvrir la propriété de l'**ancien** domaine.
   - **Settings** → **Change of address** → sélectionner
     `myconciergehotel.com` comme destination.
   - Pré-requis vérifiés automatiquement par Google : 301/308 actif depuis
     l'ancien, propriété de destination vérifiée, pas d'erreurs critiques.
   - Confirmer. Le transfert d'autorité prend ~180 jours pour se finaliser.
5. **Optionnel mais recommandé** : indexer manuellement les 5 pages les
   plus stratégiques via **URL Inspection** → **Request indexing**.
   - `/` (homepage)
   - `/hotel/[top-hotel-slug]` (ex: `four-seasons-george-v`)
   - `/destination/paris`
   - `/recherche`
   - `/a-propos`

### Vérification post-soumission

- Sitemap : statut "Success" dans GSC.
- Couverture : pas d'augmentation soudaine des erreurs "Not found" ou
  "Redirect loop".
- Change of address : statut "Active" pendant les 180 jours.

## Annexes

### Pourquoi 308 et pas 301

301 et 308 sont **équivalents** côté Google et indexation (transfert
de PageRank, déduplication). 308 préserve la méthode HTTP (POST reste POST)
ce qui est plus sûr si un client envoie accidentellement un POST sur le
`www.`. Vercel propose 308 par défaut depuis 2023, accepter le defaut.

### Risques connus

- **Si l'ancien domaine héberge encore d'autres apps** (sous-domaines non
  migrés) : ne pas désactiver les DNS de l'ancien domaine, juste mettre
  une redirection 308 globale du root. Vérifier que les sous-domaines
  restent fonctionnels.
- **Cache CDN** : les anciens visiteurs peuvent garder l'ancien domaine en
  cache 24-48h. Pas d'action nécessaire — la 308 nettoiera.

### Référence

- [`docs/04-seo-geo-aeo.md`](../04-seo-geo-aeo.md) — SEO global.
- [`.cursor/rules/seo-geo.mdc`](../../.cursor/rules/seo-geo.mdc) §"Rollout multilingue V2".
- [`docs/runbooks/vercel-setup.md`](vercel-setup.md) — bootstrap Vercel.
