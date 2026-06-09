import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawPath = path.join(
  process.env.USERPROFILE ?? "",
  ".cursor/projects/c-Users-benja-Projects-conciergetravel-fr/agent-tools/687c3959-8edf-427c-97eb-5816a9e349df.txt"
);

const raw = fs.readFileSync(rawPath, "utf8");
const jsonStart = raw.indexOf("{");
const jsonEnd = raw.lastIndexOf("}") + 1;
const data = JSON.parse(raw.slice(jsonStart, jsonEnd));

function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanAnswer(text) {
  return text
    .replace(/\[\d+\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function applyCorrections(item) {
  let { question, answer } = item;
  answer = cleanAnswer(answer);

  // Align with verified fiche data
  answer = answer.replace(/16h00/g, "15h00");
  answer = answer.replace(/à 16h/g, "à 15h");
  answer = answer.replace(/50 € par animal et par nuit/g, "30 € par animal et par jour");
  answer = answer.replace(/50 € par animal et par jour/g, "30 € par animal et par jour");
  answer = answer.replace(/cinq restaurants/g, "six restaurants");
  answer = answer.replace(/5 restaurants/g, "6 restaurants");
  answer = answer.replace(
    /L'Orangerie \(élue au guide Michelin\), Clover Gordes par le Chef Jean-François Piège, La Bastide de Pierres, Le TiGrr et le salon de thé Ladurée/g,
    "Clover Gordes (Jean-François Piège), La Table de La Bastide, La Bastide de Pierres, Ladurée Gordes, Beefbar Gordes et le Brunch du Dimanche"
  );
  answer = answer.replace(
    /L'Orangerie est le restaurant étoilé au guide Michelin[^.]+\./g,
    "Clover Gordes est la table provençale du chef multi-étoilé Jean-François Piège, mais le restaurant lui-même n'est pas étoilé au Guide MICHELIN ; il compte deux toques au Gault&Millau 2025."
  );
  answer = answer.replace(/avant midi/g, "avant 12h00");
  answer = answer.replace(/L'Orangerie propose-t-elle un brunch le dimanche/g, "Le Brunch du Dimanche est-il proposé à La Bastide");
  answer = answer.replace(/L'Orangerie/g, "Clover Gordes");
  answer = answer.replace(/Le TiGrr/g, "Beefbar Gordes");
  answer = answer.replace(
    /Un early check-in peut être possible selon les disponibilités, mais n'est généralement pas garanti avant 14h00\./g,
    "Un early check-in peut être possible selon les disponibilités, généralement à partir de 12h00 ; contactez la conciergerie à l'avance pour confirmer."
  );
  answer = answer.replace(
    /Oui, un petit-déjeuner buffet gratuit est inclus/g,
    "Le petit-déjeuner est proposé à La Table de La Bastide (7h30–11h en semaine, 7h30–10h30 le week-end) ; son inclusion dépend du tarif réservé"
  );

  if (question.includes("Clover Gordes a-t-il une étoile Michelin") || question.includes("étoilé au guide Michelin")) {
    answer =
      "Non. Clover Gordes est la table provençale du chef multi-étoilé Jean-François Piège, mais le restaurant lui-même n'est pas étoilé. Il compte deux toques au Gault&Millau 2025 et est ouvert tous les jours de 12h15 à 14h et de 19h15 à 21h45 ; réservation sur SevenRooms.";
  }

  return { ...item, question, answer };
}

const faq = data.faq.map(applyCorrections);
const concierge = data.concierge_questions.map((item) => ({
  ...item,
  question: item.question.replace(/L'Orangerie/g, "Clover Gordes"),
  concierge_reply: cleanAnswer(item.concierge_reply).replace(/L'Orangerie/g, "Clover Gordes"),
}));

const faqByCategory = new Map();
for (const item of faq) {
  if (!faqByCategory.has(item.category)) faqByCategory.set(item.category, []);
  faqByCategory.get(item.category).push(item);
}

const cqByCategory = new Map();
for (const item of concierge) {
  if (!cqByCategory.has(item.category)) cqByCategory.set(item.category, []);
  cqByCategory.get(item.category).push(item);
}

let faqHtml = `    <section class="htl-section" id="faq">
      <h2>Questions fréquentes — Airelles Gordes, La Bastide</h2>
      <p class="htl-lede">Tout ce qu'un voyageur peut se demander avant et pendant son séjour — adresse, chambres, tables, spa, famille et politiques de la maison.</p>
`;

for (const [category, items] of faqByCategory) {
  faqHtml += `\n      <div class="faq-group">\n        <h3>${esc(category)}</h3>\n`;
  for (const item of items) {
    faqHtml += `        <details class="faq-item">
          <summary>${esc(item.question)}</summary>
          <p>${esc(item.answer)}</p>
        </details>\n`;
  }
  faqHtml += `      </div>\n`;
}
faqHtml += `    </section>`;

let cqHtml = `    <section class="htl-section" id="concierge-questions">
      <h2>Le Concierge répond — Airelles Gordes, La Bastide</h2>
      <p class="htl-lede">Tables, transferts, spa, excursions ou occasions spéciales : voici comment le Concierge formule sa réponse lorsque l'on lui pose la question.</p>
`;

for (const [category, items] of cqByCategory) {
  cqHtml += `\n      <div class="faq-group">\n        <h3>${esc(category)}</h3>\n`;
  for (const item of items) {
    cqHtml += `        <details class="faq-item faq-concierge">
          <summary>${esc(item.question)}</summary>
          <p class="cq-reply">${esc(item.concierge_reply)}</p>
        </details>\n`;
  }
  cqHtml += `      </div>\n`;
}
cqHtml += `    </section>`;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

const outDir = path.join(__dirname, "../DA/_generated");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "airelles-faq-section.html"), faqHtml);
fs.writeFileSync(path.join(outDir, "airelles-concierge-section.html"), cqHtml);
fs.writeFileSync(
  path.join(outDir, "airelles-faq-jsonld.json"),
  JSON.stringify(jsonLd, null, 2)
);
fs.writeFileSync(path.join(outDir, "airelles-faq-data.json"), JSON.stringify({ faq, concierge_questions: concierge }, null, 2));

console.log(`FAQ: ${faq.length} items, Concierge: ${concierge.length} items`);
