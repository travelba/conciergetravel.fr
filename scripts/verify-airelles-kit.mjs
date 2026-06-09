const urls = [
  'http://localhost:3000/hotel/les-airelles-gordes',
  'http://localhost:3000/en/hotel/les-airelles-gordes-en',
  'http://localhost:3000/en/hotel/les-airelles-gordes',
];

for (const url of urls) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  const h = await res.text();
  const restoCards = (h.match(/class="resto-card/g) ?? []).length;
  const restoHidden = (h.match(/resto-card more-hidden/g) ?? []).length;
  const expCards = (h.match(/class="exp-card/g) ?? []).length;
  const expHidden = (h.match(/exp-card more-hidden/g) ?? []).length;
  const airellesFr = (h.match(/airelles\.com\/fr\/destination/g) ?? []).length;
  const airellesEn = (h.match(/airelles\.com\/en\/destination/g) ?? []).length;
  const restoArticles = [...h.matchAll(/<article class="([^"]*resto-card[^"]*)"/g)].map((m) => m[1]);
  const expArticles = [...h.matchAll(/<article class="([^"]*exp-card[^"]*)"/g)].map((m) => m[1]);
  console.log(
    JSON.stringify(
      {
        url,
        status: res.status,
        restoCards,
        restoHidden,
        restoArticleClasses: restoArticles,
        expCards,
        expHidden,
        expArticleClasses: expArticles,
        hasRestoToggle: h.includes('btn-voir-resto'),
        hasExpToggle: h.includes('btn-voir-exp'),
        restoCollapsed: h.includes('resto-grid is-collapsed'),
        expCollapsed: h.includes('exp-list is-collapsed'),
        montgolfiereLink: h.includes('montgolfiere-luberon.com'),
        conciergeExpLink: h.includes('Organiser avec le Concierge') || h.includes('Arrange with the Concierge'),
        airellesFr,
        airellesEn,
      },
      null,
      2,
    ),
  );
}
