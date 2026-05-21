import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_AGENT_SKILLS } from '@mch/seo';
import { describe, expect, it } from 'vitest';

/**
 * Garde-fou Vague 7 / ADR-0017 — every `endpoint` declared in
 * `DEFAULT_AGENT_SKILLS` MUST correspond to an actual route handler
 * on disk under `apps/web/src/app/api/agent/`.
 *
 * Why this test exists:
 *
 * Before the Vague 2 audit, the catalog declared 11 skills with
 * `inputSchema` but no `endpoint`, and 1 skill (`get-concierge-tip`)
 * had its endpoint claimed in the catalog but no route file existed.
 * LLM agents read the catalog at runtime and got 404s when calling
 * the advertised paths.
 *
 * This test enforces the inverse invariant: every advertised endpoint
 * resolves to a Next.js App Router file. Drift (a skill renamed in
 * the catalog, a route deleted, a path typo) now surfaces as a CI
 * failure rather than a runtime 404 for LLM consumers.
 *
 * Companion: `agent-skills.test.ts` in `@mch/seo` enforces the
 * inverse — every callable skill with `inputSchema` MUST have an
 * `endpoint` (with `filter` / `booking` allowlisted as intentionally
 * declarative).
 */
const ROUTES_ROOT = new URL('../app/', import.meta.url).pathname;

/**
 * Translate an `endpoint.path` like `/api/agent/hotel/{slug}/room/{roomSlug}`
 * into the App Router file path
 * `apps/web/src/app/api/agent/hotel/[slug]/room/[roomSlug]/route.ts`.
 */
function pathToRouteFile(endpointPath: string): string {
  // Strip leading `/`, replace `{param}` segments with `[param]`, append
  // `/route.ts`. The `api/agent/` prefix prefix maps 1:1 to the App
  // Router segment shape — we don't need to special-case it.
  const segments = endpointPath
    .replace(/^\//u, '')
    .split('/')
    .map((seg) => seg.replace(/^\{(.+)\}$/u, '[$1]'));
  return join(ROUTES_ROOT, ...segments, 'route.ts');
}

describe('agent-skills endpoint ↔ route file coverage', () => {
  const endpointSkills = DEFAULT_AGENT_SKILLS.skills.filter(
    (s): s is typeof s & { endpoint: NonNullable<typeof s.endpoint> } => s.endpoint !== undefined,
  );

  it('catalog has at least one endpoint-bearing skill', () => {
    // Guards against an accidental wipe of every `endpoint` field —
    // would otherwise make the loop test below vacuously pass.
    expect(endpointSkills.length).toBeGreaterThan(0);
  });

  it('every endpoint resolves to an existing route.ts on disk', () => {
    const missing: { skill: string; path: string; expectedFile: string }[] = [];
    for (const skill of endpointSkills) {
      const file = pathToRouteFile(skill.endpoint.path);
      if (!existsSync(file)) {
        missing.push({ skill: skill.name, path: skill.endpoint.path, expectedFile: file });
      }
    }
    expect(missing).toEqual([]);
  });

  it('translates path placeholders correctly (smoke)', () => {
    expect(pathToRouteFile('/api/agent/search').endsWith('/api/agent/search/route.ts')).toBe(true);
    expect(
      pathToRouteFile('/api/agent/concierge-tip/{slug}').endsWith(
        '/api/agent/concierge-tip/[slug]/route.ts',
      ),
    ).toBe(true);
    expect(
      pathToRouteFile('/api/agent/hotel/{hotelSlug}/room/{roomSlug}').endsWith(
        '/api/agent/hotel/[hotelSlug]/room/[roomSlug]/route.ts',
      ),
    ).toBe(true);
  });
});
