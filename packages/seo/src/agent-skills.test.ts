import { describe, expect, it } from 'vitest';

import { AgentSkillsDocumentZod, DEFAULT_AGENT_SKILLS } from './agent-skills';

describe('agent-skills', () => {
  it('default document satisfies its own Zod schema', () => {
    const parsed = AgentSkillsDocumentZod.safeParse(DEFAULT_AGENT_SKILLS);
    expect(parsed.success).toBe(true);
  });

  it('rejects documents missing schemaVersion', () => {
    const parsed = AgentSkillsDocumentZod.safeParse({
      site: 'X',
      skills: [{ name: 's', description: 'd' }],
    });
    expect(parsed.success).toBe(false);
  });

  it('exposes the post-Phase-2 catalog of LLM-actionable skills', () => {
    const skillNames = DEFAULT_AGENT_SKILLS.skills.map((skill) => skill.name);
    expect(skillNames).toEqual(
      expect.arrayContaining([
        'search',
        'list-cities',
        'get-hotel',
        'get-hotel-room',
        'filter',
        'list-rankings',
        'get-ranking',
        'compare-prices',
        'booking',
        'request-quote',
        'loyalty',
      ]),
    );
  });

  it('exposes the post-ADR-0014 taxonomy + concierge-tip skills', () => {
    const skillNames = DEFAULT_AGENT_SKILLS.skills.map((skill) => skill.name);
    expect(skillNames).toEqual(
      expect.arrayContaining([
        'list-categories',
        'list-themes',
        'list-occasions',
        'list-brands',
        'get-concierge-tip',
      ]),
    );
  });

  it('skill names are unique', () => {
    const names = DEFAULT_AGENT_SKILLS.skills.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every skill that declares an inputSchema lists its required keys among its properties', () => {
    for (const skill of DEFAULT_AGENT_SKILLS.skills) {
      if (!skill.inputSchema) continue;
      const properties = Object.keys(skill.inputSchema.properties);
      for (const requiredKey of skill.inputSchema.required ?? []) {
        expect(properties).toContain(requiredKey);
      }
    }
  });

  it('every skill that declares an HTTP endpoint targets the /api/agent namespace (ADR-0017)', () => {
    const endpointSkills = DEFAULT_AGENT_SKILLS.skills.filter(
      (s): s is typeof s & { endpoint: NonNullable<typeof s.endpoint> } => s.endpoint !== undefined,
    );
    expect(endpointSkills.length).toBeGreaterThan(0);
    for (const skill of endpointSkills) {
      expect(skill.endpoint.path.startsWith('/api/agent/')).toBe(true);
      expect(['GET', 'POST']).toContain(skill.endpoint.method);
    }
  });
});
