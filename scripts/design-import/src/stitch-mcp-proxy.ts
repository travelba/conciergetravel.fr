/**
 * stitch-mcp-proxy.ts — Local stdio MCP server that proxies to Google Stitch.
 *
 * Why this exists: Cursor's remote-MCP client cannot connect directly to
 * https://stitch.googleapis.com/mcp with an `X-Goog-Api-Key` header — it
 * insists on OAuth dynamic client registration which Stitch does not expose.
 * Logs show `status=connected` but `tools=0`, so the agent sees no
 * `mcp_stitch_*` tools at all. See:
 *   - forum.cursor.com #156221 (Cursor)
 *   - github.com/anthropics/claude-code/issues/41664 (Claude Code, same bug)
 *
 * Workaround: spawn a local stdio MCP server in Node that uses Google's
 * official `StitchProxy` (from @google/stitch-sdk) to forward MCP traffic.
 * Cursor speaks stdio MCP natively, so no OAuth discovery happens.
 *
 * Wire it up in ~/.cursor/mcp.json:
 *   {
 *     "mcpServers": {
 *       "stitch": {
 *         "command": "npx",
 *         "args": [
 *           "-y",
 *           "tsx",
 *           "C:/Users/benja/Projects/conciergetravel.fr/scripts/design-import/src/stitch-mcp-proxy.ts"
 *         ],
 *         "env": { "STITCH_API_KEY": "..." }
 *       }
 *     }
 *   }
 *
 * Then restart Cursor (close the app, reopen — reloading the window does
 * not re-spawn MCP servers).
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { StitchProxy } from '@google/stitch-sdk';

async function main(): Promise<void> {
  const apiKey = process.env.STITCH_API_KEY?.trim();
  if (!apiKey) {
    process.stderr.write(
      '[stitch-mcp-proxy] STITCH_API_KEY is required (set it in the MCP server env block).\n',
    );
    process.exit(1);
  }

  const proxy = new StitchProxy({ apiKey });
  const transport = new StdioServerTransport();
  await proxy.start(transport);
  // The transport keeps the process alive while Cursor talks to it.
  process.stderr.write('[stitch-mcp-proxy] ready (stdio).\n');
}

main().catch((error) => {
  process.stderr.write(`[stitch-mcp-proxy] fatal: ${String(error)}\n`);
  process.exit(1);
});
