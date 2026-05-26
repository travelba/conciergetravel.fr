# @mch/design-import — Stitch ↔ repo bridge

Pulls UI screens from a [Google Stitch](https://stitch.withgoogle.com/) project
into `docs/design/stitch/`, and exposes a **local stdio MCP proxy** so Cursor
can call Stitch tools (`list_projects`, `generate_screen_from_text`,
`get_screen`, …) directly inside an agent session.

## Why a local proxy?

Cursor's remote-MCP client cannot talk to `https://stitch.googleapis.com/mcp`
with an `X-Goog-Api-Key` header — it forces an OAuth dynamic-client-registration
discovery step that Stitch does not support. Symptom: the MCP shows
`status=connected` but `tools=0`, so no `mcp_stitch_*` tool is ever exposed.

References:

- [Cursor forum #156221](https://forum.cursor.com/t/remote-mcp-server-fails-with-invalid-url-protocol-for-stitch-endpoint/156221)
- [Claude Code #41664](https://github.com/anthropics/claude-code/issues/41664)

The workaround is a thin stdio MCP server (`src/stitch-mcp-proxy.ts`) that
wraps Google's official `StitchProxy` from [`@google/stitch-sdk`](https://www.npmjs.com/package/@google/stitch-sdk).
Stdio MCP servers bypass OAuth discovery entirely.

## Scripts

| Command                                                      | What it does                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `pnpm --filter @mch/design-import pull`                      | Mirror the default Stitch project into `docs/design/stitch/`             |
| `pnpm --filter @mch/design-import pull -- --dry-run`         | List screens without downloading any byte                                |
| `pnpm --filter @mch/design-import pull -- --project-id=<id>` | Mirror a different Stitch project                                        |
| `pnpm --filter @mch/design-import mcp:proxy`                 | Run the stdio MCP proxy manually (Cursor spawns it automatically though) |
| `pnpm --filter @mch/design-import typecheck`                 | Strict TypeScript check                                                  |

## Wire the MCP proxy into Cursor

Edit `~/.cursor/mcp.json` and replace any remote `stitch` entry with the local
proxy:

```json
{
  "mcpServers": {
    "stitch": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "C:/Users/benja/Projects/conciergetravel.fr/scripts/design-import/src/stitch-mcp-proxy.ts"
      ],
      "env": {
        "STITCH_API_KEY": "${STITCH_API_KEY}"
      }
    }
  }
}
```

Then **fully close and reopen Cursor** (reloading the window does not re-spawn
MCP servers). Verify success by asking the agent to list the available Stitch
tools — they should appear under `mcp_stitch_*`.

## Default Stitch project

`11149337623414320821` — see `src/pull-stitch.ts` for the constant. Override
with `--project-id=<id>` on a per-run basis when needed.

## Output layout

```
docs/design/stitch/
├── manifest.json                    # screen count, IDs, pull timestamp
├── screens/<screen-id>.html         # raw HTML downloaded from Stitch
└── screenshots/<screen-id>.png      # raw PNG screenshot
```

`manifest.json` is committed; HTML and PNG payloads are ignored by default (see
`docs/design/stitch/.gitignore`) because they are large and re-derivable from
the manifest. Commit individual screens when you need to anchor a design
decision in a PR.

## Security — API key handling

The Stitch API key is sensitive. **Never** commit it.

- ✅ Store it in your shell as `$env:STITCH_API_KEY` (PowerShell) or
  `export STITCH_API_KEY=...` (bash), then reference it via `${STITCH_API_KEY}`
  in `~/.cursor/mcp.json`. Cursor expands the variable at server-spawn time.
- ❌ Pasting the raw key into `~/.cursor/mcp.json` works but leaves the
  secret readable by any Windows process — fine for a quick test, not for
  long-term use.
- ❌ Never put the key in `apps/web/.env.local` or any repo-tracked file.

To rotate the key, regenerate it at `stitch.withgoogle.com → profile →
Stitch settings`, then update the env var in your shell and restart Cursor.
