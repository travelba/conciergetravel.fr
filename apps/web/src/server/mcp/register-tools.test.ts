import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { DEFAULT_AGENT_SKILLS } from '@mch/seo';
import { describe, expect, it } from 'vitest';

import { REGISTERED_TOOL_NAMES, registerMchTools } from './register-tools';

/**
 * MCP tool catalogue coverage + registration smoke (Lot 4, ADR-0029).
 *
 * Companion to `@mch/seo`'s `agent-skills.test.ts` (which guards the
 * manifest itself) and `agent-skills-routes.test.ts` (manifest ↔ HTTP
 * route). This file guards the third leg: manifest ↔ MCP tool.
 */

type CapturedTool = {
  readonly name: string;
  readonly config: { description?: string; inputSchema?: unknown; annotations?: unknown };
  readonly callback: (
    args: Record<string, unknown>,
    extra: { requestInfo?: { headers?: Record<string, string> } },
  ) => Promise<CallToolResult>;
};

function captureTools(): CapturedTool[] {
  const tools: CapturedTool[] = [];
  const fakeServer = {
    registerTool(name: string, config: CapturedTool['config'], callback: CapturedTool['callback']) {
      tools.push({ name, config, callback });
    },
  };
  // The fake only implements the `registerTool` surface the function uses.
  registerMchTools(fakeServer as never);
  return tools;
}

describe('registerMchTools — catalogue coverage', () => {
  const skillNames = DEFAULT_AGENT_SKILLS.skills.map((s) => s.name);

  it('registers exactly one MCP tool per manifest skill (full parity)', () => {
    expect(new Set(REGISTERED_TOOL_NAMES)).toEqual(new Set(skillNames));
  });

  it('every endpoint-bearing skill maps to a registered tool', () => {
    const endpointSkills = DEFAULT_AGENT_SKILLS.skills
      .filter((s) => s.endpoint !== undefined)
      .map((s) => s.name);
    const registered = new Set<string>(REGISTERED_TOOL_NAMES);
    for (const name of endpointSkills) {
      expect(registered.has(name)).toBe(true);
    }
  });

  it('REGISTERED_TOOL_NAMES has no duplicates', () => {
    expect(new Set(REGISTERED_TOOL_NAMES).size).toBe(REGISTERED_TOOL_NAMES.length);
  });
});

describe('registerMchTools — registration smoke', () => {
  const tools = captureTools();
  const byName = new Map(tools.map((t) => [t.name, t]));

  it('registers a tool for every name in REGISTERED_TOOL_NAMES', () => {
    expect(tools).toHaveLength(REGISTERED_TOOL_NAMES.length);
    for (const name of REGISTERED_TOOL_NAMES) {
      expect(byName.has(name)).toBe(true);
    }
  });

  it('pulls each description verbatim from the manifest', () => {
    const search = byName.get('search');
    const manifestSearch = DEFAULT_AGENT_SKILLS.skills.find((s) => s.name === 'search');
    expect(search?.config.description).toBe(manifestSearch?.description);
  });

  it('annotates pricing/booking tools as read-only (no destructive hint)', () => {
    for (const name of ['compare-prices', 'request-quote', 'booking']) {
      expect(byName.get(name)?.config.annotations).toMatchObject({ readOnlyHint: true });
    }
  });

  it('a frozen tool callback returns a non-error frozen envelope end-to-end', async () => {
    const booking = byName.get('booking');
    expect(booking).toBeDefined();
    const result = await booking!.callback({}, {});
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({ status: 'frozen', capability: 'booking' });
  });

  it('the declarative `filter` tool returns a refinement hint (no endpoint)', async () => {
    const filter = byName.get('filter');
    const result = await filter!.callback({ type: 'palace' }, {});
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({ hint: 'refine' });
  });
});
