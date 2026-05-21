import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
// Use `fileURLToPath` so the path is OS-native (Windows: `C:\…`, POSIX:
// `/…`) — `new URL(…).pathname` returns `/C:/…` on Windows which
// `path.join` can't compose into a usable filesystem path.
const ROUTES_ROOT = fileURLToPath(new URL('../app/', import.meta.url));

/**
 * Locate the App Router `route.ts` file matching an `endpoint.path` like
 * `/api/agent/hotel/{hotelSlug}/room/{roomSlug}`.
 *
 * Static segments must match exactly. Dynamic segments (`{name}` in the
 * catalog) accept ANY `[…]` directory on disk — the public-facing
 * placeholder name (used by LLMs reading the agent catalog) is
 * deliberately decoupled from Next's internal segment name. For example
 * the catalog advertises `{hotelSlug}` for clarity while the filesystem
 * is `[slug]` because two endpoints share the same hotel root.
 *
 * Returns the absolute path of the matching `route.ts`, or `null`.
 */
function findRouteFile(endpointPath: string): string | null {
  const segments = endpointPath
    .replace(/^\//u, '')
    .split('/')
    .map((seg) => (/^\{.+\}$/u.test(seg) ? null : seg));

  function walk(currentDir: string, remaining: (string | null)[]): string | null {
    if (remaining.length === 0) {
      const file = join(currentDir, 'route.ts');
      return existsSync(file) ? file : null;
    }
    const [head, ...tail] = remaining;
    if (head === null) {
      if (!existsSync(currentDir)) return null;
      for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name.startsWith('[') && entry.name.endsWith(']')) {
          const result = walk(join(currentDir, entry.name), tail);
          if (result !== null) return result;
        }
      }
      return null;
    }
    return walk(join(currentDir, head), tail);
  }

  return walk(ROUTES_ROOT, segments);
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
    const missing: { skill: string; path: string }[] = [];
    for (const skill of endpointSkills) {
      if (findRouteFile(skill.endpoint.path) === null) {
        missing.push({ skill: skill.name, path: skill.endpoint.path });
      }
    }
    expect(missing).toEqual([]);
  });

  it('resolves static and dynamic placeholders to the right file (smoke)', () => {
    // Returned paths use OS-native separators (Windows: `\`), so
    // compose the expected suffix with `join` too instead of a
    // hard-coded POSIX string.
    expect(findRouteFile('/api/agent/search')).not.toBeNull();
    expect(
      findRouteFile('/api/agent/search')!.endsWith(join('api', 'agent', 'search', 'route.ts')),
    ).toBe(true);

    // `{slug}` matches the on-disk `[slug]` segment.
    expect(
      findRouteFile('/api/agent/concierge-tip/{slug}')!.endsWith(
        join('api', 'agent', 'concierge-tip', '[slug]', 'route.ts'),
      ),
    ).toBe(true);

    // `{hotelSlug}` deliberately matches `[slug]` on disk — the public
    // placeholder name is decoupled from the filesystem segment name.
    expect(
      findRouteFile('/api/agent/hotel/{hotelSlug}/room/{roomSlug}')!.endsWith(
        join('api', 'agent', 'hotel', '[slug]', 'room', '[roomSlug]', 'route.ts'),
      ),
    ).toBe(true);

    // Sanity: a typo'd path must NOT match.
    expect(findRouteFile('/api/agent/does-not-exist')).toBeNull();
  });
});
