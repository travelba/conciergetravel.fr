// ADR-0031 spike — evidence capture.
// Compares CSP enforcement between a force-static page (mentions-legales,
// CDN HIT, no nonce in HTML) and a force-dynamic page (lieux, fresh nonce).
// Counts CSP violations and checks whether React hydrated at all.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// pnpm keeps playwright under the virtual store; resolve it explicitly so the
// script runs from the repo root without its own package.json.
const { chromium } = require(
  '../../node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.js',
);

const TARGETS = [
  { name: 'static  /mentions-legales', url: 'https://myconciergehotel.com/mentions-legales' },
  { name: 'dynamic /lieux', url: 'https://myconciergehotel.com/lieux' },
];

const browser = await chromium.launch();
for (const t of TARGETS) {
  const page = await browser.newPage();
  const violations = [];
  page.on('console', (msg) => {
    if (msg.text().includes('Content Security Policy')) violations.push(msg.text());
  });
  await page.goto(t.url, { waitUntil: 'networkidle', timeout: 60000 });
  const hydrated = await page.evaluate(() => typeof self.__next_f !== 'undefined');
  const interactive = await page.evaluate(() => {
    // The consent banner button / burger menu need React handlers.
    return document.querySelectorAll('script[nonce]').length;
  });
  console.log(`${t.name}`);
  console.log(`  CSP violations : ${violations.length}`);
  console.log(`  __next_f defined (bootstrap executed) : ${hydrated}`);
  console.log(`  script[nonce] count : ${interactive}`);
  if (violations.length > 0) console.log(`  sample: ${violations[0]?.slice(0, 160)}`);
  await page.close();
}
await browser.close();
