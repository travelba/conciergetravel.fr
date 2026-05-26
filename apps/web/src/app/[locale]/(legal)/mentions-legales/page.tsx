import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { isRoutingLocale } from '@/i18n/routing';

import { LegalSection, LegalShell } from '../_components/legal-shell';
import { buildLegalMetadata } from '../_components/legal-metadata';

// Legal pages rarely change and have no per-request state — SSG.
export const dynamic = 'force-static';

const LAST_UPDATED = '2026-05-01';

/**
 * TODO: legal-review — the corporate identity fields below are draft.
 *
 * Audit 2026-05-25 (nav-menu Canvas): the previous text shipped with
 * `RCS XXX XXX XXX`, `FR XX XXXXXXXXX`, `+33 1 XX XX XX XX`,
 * `IM XXXXXXXXX` embedded in production-looking prose. As an IATA /
 * Atout-France registered agency this is a real DGCCRF + DSA exposure.
 *
 * Until the responsable juridique has supplied:
 *   - RCS / SIREN / SIRET de l'éditeur
 *   - capital social, adresse complète du siège, directeur de
 *     publication
 *   - TVA intracommunautaire (FR + 11 chiffres)
 *   - immatriculation Atout France (IM + 9 chiffres)
 *   - garantie financière (organisme + adresse)
 *   - assureur RC professionnelle (nom + adresse)
 *   - ligne téléphonique professionnelle
 *
 * the placeholders in `messages/{fr,en}.json#legal.noticePage.sections`
 * are now wrapped in `[À COMPLÉTER : ...]` markers so they are
 * unmissable on visual review, and the page emits `robots: noindex,
 * follow` so Google does not index the draft. A visible amber banner
 * (`draftBanner` translation key) explains the state to any human
 * visitor.
 *
 * Flip the `IS_DRAFT` constant below to `false` once the editor and
 * publication director have signed off — that simultaneously removes
 * the banner and the noindex flag.
 */
const IS_DRAFT = true as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const base = await buildLegalMetadata({
    locale,
    pathname: '/mentions-legales',
    translationsNamespace: 'legal.noticePage',
  });
  // While the corporate identity placeholders are still in place we
  // explicitly noindex this page — see the TODO above.
  if (IS_DRAFT) {
    return { ...base, robots: { index: false, follow: true } };
  }
  return base;
}

export default async function LegalNoticePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  setRequestLocale(raw);

  const t = await getTranslations('legal.noticePage');

  return (
    <LegalShell locale={raw} title={t('title')} lastUpdatedIso={LAST_UPDATED}>
      {IS_DRAFT ? (
        <div
          role="note"
          className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <strong className="block font-semibold">Brouillon — à valider juridiquement</strong>
          <span className="mt-1 block">{t('draftBanner')}</span>
        </div>
      ) : null}
      <LegalSection title={t('sections.editor.title')}>
        <p>{t('sections.editor.body')}</p>
      </LegalSection>
      <LegalSection title={t('sections.contact.title')}>
        <p>{t('sections.contact.body')}</p>
      </LegalSection>
      <LegalSection title={t('sections.hosting.title')}>
        <p>{t('sections.hosting.body')}</p>
      </LegalSection>
      <LegalSection title={t('sections.license.title')}>
        <p>{t('sections.license.body')}</p>
      </LegalSection>
      <LegalSection title={t('sections.ip.title')}>
        <p>{t('sections.ip.body')}</p>
      </LegalSection>
    </LegalShell>
  );
}
