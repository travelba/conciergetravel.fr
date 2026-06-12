import { describe, expect, it } from 'vitest';

import {
  auditKitVisiteurHtml,
  extractPublicIdFromSrc,
  formatKitVisiteurGateMessage,
} from './audit-kit-visiteur.js';

const SLUG = 'shangri-la-paris';
const CLOUD = 'https://res.cloudinary.com/demo/image/upload';

function sampleHtml(opts: {
  readonly exps?: number;
  readonly restoPlaceholder?: boolean;
  readonly sharedPress?: string;
}): string {
  const expCards = Array.from({ length: opts.exps ?? 4 }, (_, i) => {
    const pid = opts.sharedPress !== undefined && i === 1 ? opts.sharedPress : `press-${20 + i}`;
    return `<article class="exp-card"><img src="${CLOUD}/cct/hotels/${SLUG}/${pid}" alt="Exp ${i}" /><h4>Experience ${i}</h4></article>`;
  }).join('');
  const restoSrc = opts.restoPlaceholder
    ? '/kit/img/htl_resto.jpg'
    : `${CLOUD}/cct/hotels/${SLUG}/press-30`;
  return `<html><body>
    <article class="room-v2"><img src="${CLOUD}/cct/hotels/${SLUG}/press-7" alt="Chambre Deluxe" /><h3>Deluxe Room</h3></article>
    ${expCards}
    <article class="resto-card"><img src="${restoSrc}" alt="Shang Palace" /><h4>Shang Palace</h4></article>
    <h3>Spa &amp; bien-être</h3><img src="${CLOUD}/cct/hotels/${SLUG}/press-16" alt="Spa" />
  </body></html>`;
}

describe('auditKitVisiteurHtml', () => {
  it('passes when exp cards, no placeholders, no dupes', () => {
    const report = auditKitVisiteurHtml(sampleHtml({ exps: 4 }), SLUG);
    expect(report.passed).toBe(true);
    expect(formatKitVisiteurGateMessage(report)).toContain('visitor audit OK');
  });

  it('fails when experience grid is empty', () => {
    const report = auditKitVisiteurHtml(sampleHtml({ exps: 0 }), SLUG);
    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.includes('exp-card'))).toBe(true);
  });

  it('fails on dining placeholder', () => {
    const report = auditKitVisiteurHtml(sampleHtml({ exps: 4, restoPlaceholder: true }), SLUG);
    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.includes('htl_resto'))).toBe(true);
  });

  it('flags superior/deluxe alt mismatch', () => {
    const html = `<article class="room-v2"><img src="${CLOUD}/cct/hotels/${SLUG}/press-7" alt="Chambre Deluxe" /><h3>Superior Room</h3></article>`;
    const report = auditKitVisiteurHtml(html, SLUG);
    expect(report.issues.some((i) => i.includes('Superior card'))).toBe(true);
  });

  it('allows same press-* on exp-card and resto-card (same venue)', () => {
    const html = `<html><body>
      <article class="exp-card"><img src="${CLOUD}/cct/hotels/${SLUG}/press-10" alt="Dîner" /><h4>Dîner au Shang Palace</h4></article>
      <article class="exp-card"><img src="${CLOUD}/cct/hotels/${SLUG}/press-11" alt="Exp 2" /><h4>Experience 2</h4></article>
      <article class="exp-card"><img src="${CLOUD}/cct/hotels/${SLUG}/press-12" alt="Exp 3" /><h4>Experience 3</h4></article>
      <article class="exp-card"><img src="${CLOUD}/cct/hotels/${SLUG}/press-13" alt="Exp 4" /><h4>Experience 4</h4></article>
      <article class="resto-card"><img src="${CLOUD}/cct/hotels/${SLUG}/press-10" alt="Shang Palace" /><h4>Shang Palace</h4></article>
    </body></html>`;
    const report = auditKitVisiteurHtml(html, SLUG);
    expect(report.issues.some((i) => i.includes('cross-block'))).toBe(false);
  });

  it('flags room + exp sharing the same press-*', () => {
    const html = `<html><body>
      <article class="room-v2"><img src="${CLOUD}/cct/hotels/${SLUG}/press-9" alt="Suite" /><h3>Suite sur pistes</h3></article>
      <article class="exp-card"><img src="${CLOUD}/cct/hotels/${SLUG}/press-9" alt="Ski" /><h4>Première descente</h4></article>
      <article class="exp-card"><img src="${CLOUD}/cct/hotels/${SLUG}/press-11" alt="E2" /><h4>E2</h4></article>
      <article class="exp-card"><img src="${CLOUD}/cct/hotels/${SLUG}/press-12" alt="E3" /><h4>E3</h4></article>
      <article class="exp-card"><img src="${CLOUD}/cct/hotels/${SLUG}/press-13" alt="E4" /><h4>E4</h4></article>
    </body></html>`;
    const report = auditKitVisiteurHtml(html, SLUG);
    expect(report.issues.some((i) => i.includes('cross-block'))).toBe(true);
  });
});

describe('extractPublicIdFromSrc', () => {
  it('reads press slot from Cloudinary URL', () => {
    expect(extractPublicIdFromSrc(SLUG, `${CLOUD}/cct/hotels/${SLUG}/press-12`)).toBe('press-12');
  });

  it('reads generic placeholder', () => {
    expect(extractPublicIdFromSrc(SLUG, '/kit/img/htl_resto.jpg')).toBe(
      'PLACEHOLDER:htl_resto.jpg',
    );
  });
});
