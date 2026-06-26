import { describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG, runStaticChecks, type Finding } from './checks.js';

function ids(findings: readonly Finding[]): string[] {
  return findings.map((f) => f.check);
}
function find(findings: readonly Finding[], check: string): Finding | undefined {
  return findings.find((f) => f.check === check);
}

const HEALTHY = `<!doctype html><html><head>
  <title>Le Meurice — Palace Paris place de la Concorde</title>
  <meta name="description" content="Le Meurice, palace parisien classé Atout France face au jardin des Tuileries : table Alain Ducasse, spa Valmont et conciergerie d'exception au cœur de Paris.">
  <link rel="canonical" href="https://myconciergehotel.com/hotel/le-meurice">
  <link rel="alternate" hreflang="fr" href="https://myconciergehotel.com/hotel/le-meurice">
  <link rel="alternate" hreflang="en" href="https://myconciergehotel.com/en/hotel/le-meurice">
  <script type="application/ld+json">{"@type":"Hotel","name":"Le Meurice","aggregateRating":{"@type":"AggregateRating","ratingValue":"4.8","bestRating":"5"}}</script>
  </head><body><h1>Le Meurice</h1><p>Un palace parisien.</p></body></html>`;

const URL = 'https://myconciergehotel.com/hotel/le-meurice';

describe('runStaticChecks — healthy page', () => {
  it('produces no findings on a well-formed page', () => {
    const findings = runStaticChecks({ url: URL, status: 200, html: HEALTHY });
    expect(findings).toEqual([]);
  });
});

describe('runStaticChecks — HTTP status', () => {
  it('fails fast on non-200 and skips body checks', () => {
    const findings = runStaticChecks({ url: URL, status: 404, html: '<h1>x</h1>' });
    expect(ids(findings)).toEqual(['http-status']);
    expect(findings[0]?.severity).toBe('fail');
  });
});

describe('runStaticChecks — h1', () => {
  it('fails when no h1', () => {
    const html = HEALTHY.replace('<h1>Le Meurice</h1>', '<p>no heading</p>');
    expect(find(runStaticChecks({ url: URL, status: 200, html }), 'h1')?.severity).toBe('fail');
  });
  it('warns when multiple h1', () => {
    const html = HEALTHY.replace('<h1>Le Meurice</h1>', '<h1>A</h1><h1>B</h1>');
    expect(find(runStaticChecks({ url: URL, status: 200, html }), 'h1')?.severity).toBe('warn');
  });
});

describe('runStaticChecks — scaffolding leak', () => {
  it('fails when brief/dossier scaffolding leaks into prose', () => {
    const html = HEALTHY.replace(
      '<p>Un palace parisien.</p>',
      '<p>Le brief confirme un dossier encore incomplet pour cet hôtel.</p>',
    );
    const findings = runStaticChecks({ url: URL, status: 200, html });
    expect(find(findings, 'scaffolding-leak')?.severity).toBe('fail');
  });
  it('does NOT flag the legit Wikidata sameAs URL inside JSON-LD', () => {
    const html = HEALTHY.replace(
      '"name":"Le Meurice"',
      '"name":"Le Meurice","sameAs":"https://www.wikidata.org/wiki/Q1234567"',
    );
    const findings = runStaticChecks({ url: URL, status: 200, html });
    expect(find(findings, 'scaffolding-leak')).toBeUndefined();
  });
  it('does NOT flag the visible EEAT provenance footer (Wikidata label)', () => {
    const html = HEALTHY.replace(
      '<p>Un palace parisien.</p>',
      '<footer><h2>Références externes</h2><a href="https://www.wikidata.org/wiki/Q1234567">Wikidata</a><a href="#">Wikipédia (FR)</a></footer>',
    );
    const findings = runStaticChecks({ url: URL, status: 200, html });
    expect(find(findings, 'scaffolding-leak')).toBeUndefined();
  });
});

describe('runStaticChecks — JSON-LD', () => {
  it('fails on unparseable JSON-LD', () => {
    const html = HEALTHY.replace('{"@type":"Hotel"', '{"@type":"Hotel",,,');
    expect(find(runStaticChecks({ url: URL, status: 200, html }), 'jsonld-parse')?.severity).toBe(
      'fail',
    );
  });
  it('fails when a frozen Offer is emitted (Phase 6)', () => {
    const html = HEALTHY.replace(
      '<body>',
      '<script type="application/ld+json">{"@type":"Offer","price":"100"}</script><body>',
    );
    expect(
      find(runStaticChecks({ url: URL, status: 200, html }), 'jsonld-offer-frozen')?.severity,
    ).toBe('fail');
  });
  it('fails when AggregateRating is not on the /5 scale', () => {
    const html = HEALTHY.replace('"bestRating":"5"', '"bestRating":"10"');
    expect(
      find(runStaticChecks({ url: URL, status: 200, html }), 'jsonld-rating-scale')?.severity,
    ).toBe('fail');
  });
});

describe('runStaticChecks — list-page value (anti "0 hôtels")', () => {
  const listUrl = 'https://myconciergehotel.com/classement/meilleurs-palaces-france';
  it('fails when a listing renders "0 hôtels"', () => {
    const html = `<head><title>Meilleurs palaces de France — le classement du Concierge</title></head><body><h1>Palaces</h1><p>0 hôtels trouvés.</p></body>`;
    const findings = runStaticChecks({ url: listUrl, status: 200, html });
    expect(find(findings, 'list-value')?.severity).toBe('fail');
  });
  it('passes when a listing renders a positive count', () => {
    const html = `<head><title>Meilleurs palaces de France — le classement du Concierge</title></head><body><h1>Palaces</h1><p>12 hôtels sélectionnés.</p></body>`;
    const findings = runStaticChecks({ url: listUrl, status: 200, html });
    expect(find(findings, 'list-value')).toBeUndefined();
  });
  it('does not apply the list check to a hotel detail page', () => {
    const html = `<head><title>x</title></head><body><h1>H</h1><p>0 hôtels</p></body>`;
    const findings = runStaticChecks({ url: URL, status: 200, html });
    expect(find(findings, 'list-value')).toBeUndefined();
  });
});

describe('runStaticChecks — hreflang parity', () => {
  it('warns when alternates exist but a V1 locale is missing', () => {
    const html = HEALTHY.replace(/<link rel="alternate" hreflang="en"[^>]*>/u, '');
    expect(find(runStaticChecks({ url: URL, status: 200, html }), 'hreflang')?.severity).toBe(
      'warn',
    );
  });
  it('does not warn when there are no alternates at all', () => {
    const html = HEALTHY.replace(/<link rel="alternate"[^>]*>/gu, '');
    expect(find(runStaticChecks({ url: URL, status: 200, html }), 'hreflang')).toBeUndefined();
  });
});

describe('config is overridable', () => {
  it('accepts custom ok statuses', () => {
    const cfg = { ...DEFAULT_CONFIG, okStatuses: new Set([200, 301]) };
    const findings = runStaticChecks({ url: URL, status: 301, html: HEALTHY }, cfg);
    expect(find(findings, 'http-status')).toBeUndefined();
  });
});
