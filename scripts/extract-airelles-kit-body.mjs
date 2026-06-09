import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const src = fs.readFileSync(path.join(repoRoot, 'DA/les-airelles-gordes.html'), 'utf8');
const start = src.indexOf('<!-- ============ FIL D\'ARIANE');
const end = src.indexOf('<!-- ============ FOOTER ============');
if (start === -1 || end === -1) {
  console.error('markers not found', { start, end });
  process.exit(1);
}

let body = src.slice(start, end);
body = body.replaceAll('assets/img/airelles/', '/kit/airelles/');
body = body.replaceAll('assets/img/club_concierge.jpg', '/kit/airelles/club-concierge.jpg');
body = body.replaceAll('href="index.html"', 'href="/fr/hotels"');
body = body.replaceAll('href="index.html#destinations"', 'href="/fr/destination"');
body = body.replaceAll(
  '<a href="/fr/destination">Gordes</a>',
  '<a href="/fr/destination/gordes">Gordes</a>',
);
body = body.replaceAll('href="index.html#hotels"', 'href="/fr/hotels"');
body = body.replaceAll('href="guide.html"', 'href="/fr/destination/gordes"');
body = body.replaceAll('href="classement.html"', 'href="/fr/classements"');
body = body.replaceAll(
  'href="reserver.html"',
  'href="/fr/reservation/sandbox/les-airelles-gordes/chambres"',
);

const outDir = path.join(repoRoot, 'apps/web/src/content/hotels');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'les-airelles-gordes.body.html');
fs.writeFileSync(outPath, body, 'utf8');
console.log('wrote', outPath, 'bytes', body.length);
