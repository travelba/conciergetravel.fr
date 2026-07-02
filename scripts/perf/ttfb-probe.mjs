// Quick TTFB probe (headers-arrival time, not full download).
// Usage: node scripts/perf/ttfb-probe.mjs <base> <path> [n]
const [, , base = 'http://localhost:3100', path = '/', n = '3'] = process.argv;
for (let i = 0; i < Number(n); i++) {
  const t0 = performance.now();
  const res = await fetch(`${base}${path}`);
  const ttfb = performance.now() - t0; // fetch resolves at headers
  const body = await res.text();
  const total = performance.now() - t0;
  console.log(
    `${path} hit${i + 1}: status=${res.status} ttfb=${ttfb.toFixed(0)}ms total=${total.toFixed(0)}ms size=${(body.length / 1024).toFixed(0)}KB cache=${res.headers.get('x-vercel-cache') ?? '-'}`,
  );
}
