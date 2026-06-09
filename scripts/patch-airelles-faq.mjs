import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const genDir = path.join(__dirname, "../DA/_generated");
const htmlPath = path.join(__dirname, "../DA/les-airelles-gordes.html");

const faqSection = fs.readFileSync(path.join(genDir, "airelles-faq-section.html"), "utf8");
const cqSection = fs.readFileSync(path.join(genDir, "airelles-concierge-section.html"), "utf8");
const jsonLd = fs.readFileSync(path.join(genDir, "airelles-faq-jsonld.json"), "utf8");

let html = fs.readFileSync(htmlPath, "utf8");

const faqStart = html.indexOf("    <!-- ============================================================\n         SECTION 7 — QUESTIONS FRÉQUENTES");
const faqEnd = html.indexOf("    <!-- ============================================================\n         SECTION 8 — LE CONCIERGE CLUB");

if (faqStart === -1 || faqEnd === -1) {
  console.error("Markers not found", { faqStart, faqEnd });
  process.exit(1);
}

const replacement = `    <!-- ============================================================
         SECTION 7 — QUESTIONS FRÉQUENTES (Perplexity research)
         ============================================================ -->
${faqSection}

    <!-- ============================================================
         SECTION 7b — QUESTIONS CONCIERGE (Perplexity research)
         ============================================================ -->
${cqSection}

    <!-- ============================================================
         SECTION 8 — LE CONCIERGE CLUB`;

html = html.slice(0, faqStart) + replacement + html.slice(faqEnd + "    <!-- ============================================================\n         SECTION 8 — LE CONCIERGE CLUB".length);

// Update JSON-LD FAQ block
const ldStart = html.indexOf("<!-- JSON-LD : FAQ (synchroniser avec la section #faq) -->");
const ldEnd = html.indexOf("</script>\n</head>", ldStart);
const ldBlock = `<!-- JSON-LD : FAQ (synchroniser avec la section #faq) -->
<script type="application/ld+json">
${jsonLd}
</script>`;
html = html.slice(0, ldStart) + ldBlock + html.slice(ldEnd);

fs.writeFileSync(htmlPath, html);
console.log("Patched", htmlPath);
