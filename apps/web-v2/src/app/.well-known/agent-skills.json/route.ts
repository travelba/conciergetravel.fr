import { NextResponse } from 'next/server';

import { V2_AGENT_SKILLS } from '@/lib/agent-skills-v2';

export const dynamic = 'force-dynamic';

/** /.well-known/agent-skills.json — v2 declarative skills (MCP + HTTP). */
export function GET(): NextResponse {
  return NextResponse.json(V2_AGENT_SKILLS, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
