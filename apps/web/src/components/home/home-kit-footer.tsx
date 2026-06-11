import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

/**
 * Kit homepage footer — port of `design/html-kit/index.html` §footer.
 */
export async function HomeKitFooter({
  locale,
}: {
  readonly locale: Locale;
}): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'homepage.kitFooter' });
  const year = new Date().getFullYear();

  return (
    <div className="mch-kit">
      <footer className="footer">
        <div className="wrap">
          <div className="foot-top">
            <div className="foot-brand">
              <span className="brand-mono">
                M<em>C</em>
              </span>
              <div className="fb-tag">{t('tagline')}</div>
              <p>{t('body')}</p>
            </div>
            <div className="foot-col">
              <h4>{t('exploreTitle')}</h4>
              <a href="#hotels">{t('exploreHotels')}</a>
              <a href="#destinations">{t('exploreDestinations')}</a>
              <a href="#experiences">{t('exploreOccasions')}</a>
              <Link href="/classements">{t('exploreRankings')}</Link>
              <a href="#magazine">{t('exploreMagazine')}</a>
            </div>
            <div className="foot-col">
              <h4>{t('destinationsTitle')}</h4>
              <Link href={{ pathname: '/destination/[citySlug]', params: { citySlug: 'paris' } }}>
                {t('destParis')}
              </Link>
              <Link
                href={{
                  pathname: '/classements/[axe]/[valeur]',
                  params: { axe: 'lieu', valeur: 'cote-d-azur' },
                }}
              >
                {t('destRiviera')}
              </Link>
              <Link href="/guide/italie">{t('destItaly')}</Link>
              <Link
                href={{
                  pathname: '/classement/[slug]',
                  params: { slug: 'meilleurs-hotels-grece' },
                }}
              >
                {t('destGreece')}
              </Link>
              <Link href="/guide/japon">{t('destJapan')}</Link>
              <Link href="/guide/etats-unis">{t('destNewYork')}</Link>
            </div>
            <div className="foot-col">
              <h4>{t('catalogueTitle')}</h4>
              <Link
                href={{
                  pathname: '/categorie/[categorySlug]',
                  params: { categorySlug: 'palace' },
                }}
              >
                {t('cataloguePalaces')}
              </Link>
              <Link
                href={{
                  pathname: '/categorie/[categorySlug]',
                  params: { categorySlug: 'hotels-5-etoiles' },
                }}
              >
                {t('catalogueFiveStar')}
              </Link>
              <Link
                href={{
                  pathname: '/categorie/[categorySlug]',
                  params: { categorySlug: 'boutique-hotels' },
                }}
              >
                {t('catalogueBoutique')}
              </Link>
              <Link
                href={{
                  pathname: '/categorie/[categorySlug]',
                  params: { categorySlug: 'chateaux-hotels' },
                }}
              >
                {t('catalogueChateau')}
              </Link>
              <Link
                href={{
                  pathname: '/categorie/[categorySlug]',
                  params: { categorySlug: 'villas' },
                }}
              >
                {t('catalogueVillas')}
              </Link>
            </div>
            <div className="foot-col">
              <h4>{t('conciergeTitle')}</h4>
              <a href="#concierge">{t('conciergeAbout')}</a>
              <Link href="/le-concierge-club">{t('conciergeClub')}</Link>
              <Link href="/le-concierge/contact">{t('conciergeContact')}</Link>
              <Link href="/le-concierge">{t('conciergeAboutPage')}</Link>
              <Link href="/mentions-legales">{t('conciergeLegal')}</Link>
            </div>
          </div>
          <div className="foot-bottom">
            <span>{t('copyright', { year })}</span>
            <span className="fb-iata">{t('iataLine')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
