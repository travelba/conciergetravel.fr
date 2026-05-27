/**
 * Tiny inline XLSX reader — extracts the single-sheet `inlineStr`
 * encoded data emitted by python-pptx-style generators (no
 * sharedStrings.xml). Avoids adding `xlsx` / `exceljs` as a dependency
 * for what is a one-shot ingestion script (see the catalogue gap
 * closure plan, Phase 0).
 *
 * The two source files (`chaines_hotelières_luxe_monde.xlsx` +
 * `boutique_hotels_monde.xlsx`) ship every cell as
 * `<c r="B6" s="..." t="inlineStr"><is><t>Aman Resorts</t></is></c>`
 * which is 100 % decodable from the bare zip + XML. Anything more
 * elaborate (formulas, shared strings, styles) is irrelevant for our
 * tabular extraction.
 *
 * Skill: editorial-pilot, content-enrichment-pipeline.
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const ENTITY_DECODE: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&([a-z]+);/gi, (_, name: string) => ENTITY_DECODE[name.toLowerCase()] ?? `&${name};`)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 16)));
}

function colToIdx(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

interface ParsedRow {
  readonly row: number;
  readonly cells: Record<number, string>;
}

function parseSheetXml(xml: string): readonly ParsedRow[] {
  const rows: ParsedRow[] = [];
  const rowRe = /<row\s[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(xml)) !== null) {
    const rowIdx = Number(rowMatch[1]);
    const inner = rowMatch[2] ?? '';
    const cells: Record<number, string> = {};
    const cellRe = /<c\s+([^>/]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch;
    while ((cellMatch = cellRe.exec(inner)) !== null) {
      const attrs = cellMatch[1] ?? '';
      const body = cellMatch[2] ?? '';
      const refMatch = attrs.match(/r="([A-Z]+)(\d+)"/);
      if (!refMatch || !refMatch[1]) continue;
      const colIdx = colToIdx(refMatch[1]);
      const typeMatch = attrs.match(/t="([^"]+)"/);
      const type = typeMatch?.[1] ?? 'n';
      let val = '';
      if (type === 'inlineStr' || type === 'str') {
        const t = body.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        val = t?.[1] !== undefined ? decodeEntities(t[1]) : '';
      } else {
        const v = body.match(/<v>([\s\S]*?)<\/v>/);
        val = v?.[1] !== undefined ? decodeEntities(v[1]) : '';
      }
      cells[colIdx] = val;
    }
    rows.push({ row: rowIdx, cells });
  }
  return rows;
}

export interface SheetTable {
  readonly headers: readonly string[];
  readonly data: readonly Record<string, string>[];
}

/**
 * Extracts a single sheet (1-indexed) from an .xlsx as a table of
 * `{ header → value }` objects. Header row is configurable because our
 * two source files mix banner/title rows above the actual table.
 */
export function readXlsxSheet(
  xlsxPath: string,
  sheetIndex: number,
  headerRow: number,
  maxColumns = 20,
): SheetTable {
  const tmpDir = mkdtempSync(join(tmpdir(), 'xlsxread-'));
  try {
    // Powershell ZipFile.ExtractToDirectory works cross-platform via
    // Node's built-in `unzip` fallback if available, but we already
    // know we're on Windows — call `tar` (ships with Win10+) which
    // handles zip natively as of 2026. Fall back to PowerShell.
    try {
      execFileSync('tar', ['-xf', xlsxPath, '-C', tmpDir], { stdio: 'pipe' });
    } catch {
      execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${xlsxPath.replace(/'/g, "''")}', '${tmpDir.replace(/'/g, "''")}')`,
        ],
        { stdio: 'pipe' },
      );
    }

    const sheetXmlPath = join(tmpDir, 'xl', 'worksheets', `sheet${sheetIndex}.xml`);
    const xml = readFileSync(sheetXmlPath, 'utf-8');
    const rows = parseSheetXml(xml);

    const headerParsedRow = rows.find((r) => r.row === headerRow);
    if (!headerParsedRow) {
      throw new Error(`No header row at index ${headerRow} in sheet ${sheetIndex}`);
    }
    const headers: string[] = [];
    const headerColIdx: number[] = [];
    for (let i = 0; i < maxColumns; i++) {
      const v = headerParsedRow.cells[i];
      if (v && v.trim().length > 0) {
        headers.push(v);
        headerColIdx.push(i);
      }
    }

    const data = rows
      .filter((r) => r.row > headerRow)
      .map((r) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          const colIdx = headerColIdx[i];
          if (colIdx === undefined) return;
          obj[h] = r.cells[colIdx] ?? '';
        });
        return obj;
      });

    return { headers, data };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
