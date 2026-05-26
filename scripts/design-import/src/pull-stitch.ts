/**
 * pull-stitch.ts — Mirror a Google Stitch project into `docs/design/stitch/`.
 *
 * Why a script and not just the MCP? Cursor's remote-MCP client cannot talk to
 * `stitch.googleapis.com/mcp` (forum.cursor.com #156221, claude-code #41664).
 * Even after the local stdio proxy ships, this script remains the canonical
 * way to pull a snapshot into the repo for reviewers, future agents, and
 * humans who do not have Stitch credentials.
 *
 * Output layout (versioned in git, except large binary artefacts):
 *   docs/design/stitch/
 *     manifest.json                 — list of screens with metadata
 *     screens/<screen-id>.html      — raw HTML download from Stitch
 *     screenshots/<screen-id>.png   — raw PNG download from Stitch
 *
 * Usage:
 *   STITCH_API_KEY=... pnpm --filter @mch/design-import pull
 *   STITCH_API_KEY=... pnpm --filter @mch/design-import pull -- --project-id=<id>
 *   STITCH_API_KEY=... pnpm --filter @mch/design-import pull -- --dry-run
 *
 * Idempotent — re-run after any change in Stitch to refresh the snapshot.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Stitch, StitchError, StitchToolClient } from '@google/stitch-sdk';

const DEFAULT_PROJECT_ID = '11149337623414320821';

interface CliOptions {
  readonly projectId: string;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions {
  let projectId = DEFAULT_PROJECT_ID;
  let dryRun = false;
  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    const match = arg.match(/^--project-id=(.+)$/);
    if (match?.[1]) {
      projectId = match[1];
      continue;
    }
  }
  return { projectId, dryRun };
}

function resolveRepoRoot(): string {
  // src/pull-stitch.ts → ../../.. = repo root (scripts/design-import/src → repo)
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', '..', '..');
}

async function downloadBinary(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status} ${res.statusText}): ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

interface ScreenManifestEntry {
  readonly screenId: string;
  readonly projectId: string;
  readonly htmlPath: string;
  readonly screenshotPath: string;
  readonly pulledAt: string;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const apiKey = process.env.STITCH_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      '[pull-stitch] STITCH_API_KEY is required. Set it in your shell or in a local .env.local before running.',
    );
    process.exit(1);
  }

  console.log(`[pull-stitch] project=${opts.projectId} dryRun=${opts.dryRun}`);

  const client = new StitchToolClient({ apiKey });
  const sdk = new Stitch(client);
  const project = sdk.project(opts.projectId);

  let screens: Awaited<ReturnType<typeof project.screens>>;
  try {
    screens = await project.screens();
  } catch (error) {
    if (error instanceof StitchError) {
      console.error(`[pull-stitch] Stitch error (${error.code}): ${error.message}`);
      if (error.code === 'AUTH_FAILED') {
        console.error(
          '[pull-stitch] Tip: verify your STITCH_API_KEY at stitch.withgoogle.com → profile → Stitch settings.',
        );
      } else if (error.code === 'NOT_FOUND') {
        console.error(
          `[pull-stitch] Tip: project ${opts.projectId} was not found. Confirm the ID via the Stitch UI URL.`,
        );
      }
      await client.close();
      process.exit(1);
    }
    throw error;
  }

  console.log(`[pull-stitch] ${screens.length} screen(s) in project`);

  const repoRoot = resolveRepoRoot();
  const outRoot = join(repoRoot, 'docs', 'design', 'stitch');
  const htmlDir = join(outRoot, 'screens');
  const imgDir = join(outRoot, 'screenshots');

  if (!opts.dryRun) {
    await Promise.all([ensureDir(htmlDir), ensureDir(imgDir)]);
  }

  const entries: ScreenManifestEntry[] = [];
  let index = 0;
  for (const screen of screens) {
    index += 1;
    const screenId = screen.id;
    const label = `[${index}/${screens.length}] screen=${screenId}`;
    if (opts.dryRun) {
      console.log(`${label} (dry-run — skipped download)`);
      entries.push({
        screenId,
        projectId: opts.projectId,
        htmlPath: `screens/${screenId}.html`,
        screenshotPath: `screenshots/${screenId}.png`,
        pulledAt: new Date().toISOString(),
      });
      continue;
    }

    try {
      const [htmlUrl, imgUrl] = await Promise.all([screen.getHtml(), screen.getImage()]);
      const [html, png] = await Promise.all([downloadBinary(htmlUrl), downloadBinary(imgUrl)]);
      const htmlPath = join(htmlDir, `${screenId}.html`);
      const imgPath = join(imgDir, `${screenId}.png`);
      await Promise.all([writeFile(htmlPath, html), writeFile(imgPath, png)]);
      console.log(`${label} OK (html ${html.byteLength}B, png ${png.byteLength}B)`);
      entries.push({
        screenId,
        projectId: opts.projectId,
        htmlPath: `screens/${screenId}.html`,
        screenshotPath: `screenshots/${screenId}.png`,
        pulledAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${label} FAILED: ${message}`);
    }
  }

  const manifest = {
    projectId: opts.projectId,
    pulledAt: new Date().toISOString(),
    screenCount: entries.length,
    screens: entries,
  };

  if (!opts.dryRun) {
    const manifestPath = join(outRoot, 'manifest.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`[pull-stitch] manifest written → ${manifestPath}`);
  } else {
    console.log('[pull-stitch] dry-run summary:');
    console.log(JSON.stringify(manifest, null, 2));
  }

  await client.close();
  console.log('[pull-stitch] done.');
}

main().catch((error) => {
  console.error('[pull-stitch] unhandled error:', error);
  process.exit(1);
});
