'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';

import { Link, usePathname } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';

import { MobileNav } from '../layout/mobile-nav';

function routeParamsFromUseParams(params: ReturnType<typeof useParams>): Record<string, string> {
  const out: Record<string, string> = {};
  if (params === null) return out;
  for (const [key, value] of Object.entries(params)) {
    if (key === 'locale') continue;
    if (typeof value === 'string' && value.length > 0) {
      out[key] = value;
    } else if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length > 0) {
      out[key] = value[0];
    }
  }
  return out;
}

function HomeKitLocaleLink(): ReactElement {
  const t = useTranslations('header.locale');
  const currentLocale = useLocale() as Locale;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeParams = routeParamsFromUseParams(useParams());
  const otherLocale: Locale = currentLocale === 'fr' ? 'en' : routing.defaultLocale;
  const qs = searchParams.toString();
  const href: Parameters<typeof Link>[0]['href'] =
    pathname.includes('[') && Object.keys(routeParams).length > 0
      ? ({
          pathname,
          params: routeParams,
        } as Parameters<typeof Link>[0]['href'])
      : ((qs.length > 0 ? `${pathname}?${qs}` : pathname) as Parameters<typeof Link>[0]['href']);

  return (
    <Link href={href} locale={otherLocale} className="hr-item" aria-label={t('label')}>
      <span aria-hidden>{currentLocale === 'fr' ? 'FR' : 'EN'}</span>
      <svg className="icon" viewBox="0 0 24 24" style={{ width: 14, height: 14 }} aria-hidden>
        <path d="M6 9l6 6 6-6" />
      </svg>
    </Link>
  );
}

/**
 * Kit homepage header — absolute over the hero, cream backdrop on scroll.
 * Mirrors `design/html-kit/index.html` §header.
 */
export function HomeKitHeader(): ReactElement {
  const t = useTranslations('homepage.kitHeader');
  const tHeader = useTranslations('header');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = (): void => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const headerClass = scrolled ? 'header header--overlay scrolled' : 'header header--overlay';

  return (
    <header className={headerClass} id="header">
      <div className="wrap header-inner">
        <Link href="/" className="brand" aria-label={tHeader('brand')}>
          <span className="brand-mono">
            M<em>C</em>
          </span>
          <span className="brand-name">MyConciergeHotel</span>
        </Link>

        <nav className="nav" aria-label={tHeader('primaryNav.label')}>
          <a href="#hotels">{t('hotels')}</a>
          <a href="#destinations">{t('destinations')}</a>
          <a href="#experiences">{t('experiences')}</a>
          <Link href="/classements">{t('rankings')}</Link>
          <a href="#concierge">{t('concierge')}</a>
          <a href="#magazine">{t('magazine')}</a>
        </nav>

        <div className="header-right">
          <Link href="/compte/favoris" className="hr-item" aria-label={t('favorites')}>
            <svg className="icon" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 21s-7.5-4.6-10-9.2C.5 8.4 2 5 5.5 5c2 0 3.4 1.2 4.5 2.6C11.1 6.2 12.5 5 14.5 5 18 5 19.5 8.4 22 11.8 19.5 16.4 12 21 12 21z" />
            </svg>
          </Link>
          <span className="sep" aria-hidden />
          <HomeKitLocaleLink />
          <span className="sep" aria-hidden />
          <Link href="/compte" className="hr-item">
            <svg className="icon" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            <span>{tHeader('account.myAccount')}</span>
          </Link>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
