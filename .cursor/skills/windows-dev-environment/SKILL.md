---
name: windows-dev-environment
description: Windows + PowerShell development gotchas for MyConciergeHotel.com — quoting CLI arguments with commas, missing Unix tools, Supabase SSL self-signed handshake, pnpm filters, path separators. Use whenever running shell commands, writing CLI scripts, or troubleshooting environment errors on Windows.
---

# Windows dev environment — MyConciergeHotel.com

The repo's primary maintainer runs Windows 10/11 + PowerShell. The codebase is otherwise UNIX-style, but the shell layer has Windows-specific quirks that bite every fresh agent session. This skill is the cheat-sheet to avoid 2-3 wasted iterations per task.

## Triggers

Invoke when:

- Running any `pnpm` / `tsx` / `node` command via the Shell tool on Windows.
- Designing a CLI script in `scripts/` that will be invoked from PowerShell.
- Debugging "command not found", "self-signed certificate", or "destination not found" errors that don't reproduce on Linux/macOS.
- Writing or refactoring `package.json` scripts that pass comma-separated lists.

## Rule 1 — PowerShell splits unquoted comma-separated args

```powershell
# WRONG — PowerShell expands a,b,c as separate tokens
pnpm --filter @mch/editorial-pilot exec tsx run.ts --slug=alpes,biarritz,bordeaux

# Becomes (under the hood):
#   tsx run.ts --slug=alpes biarritz bordeaux
# → first arg is "--slug=alpes", "biarritz" and "bordeaux" become positional.
```

**Always quote when an argument contains commas, spaces, or `=`:**

```powershell
pnpm --filter @mch/editorial-pilot exec tsx run.ts "--slug=alpes,biarritz,bordeaux"
```

The double-quotes are passed through to the child process unchanged.

## Rule 2 — Forbidden Unix-only commands

These do **not** exist on stock PowerShell:

| Forbidden             | Use instead                                                                   |
| --------------------- | ----------------------------------------------------------------------------- |
| `head -n 80 file`     | `Read` tool (read first N lines) or `Get-Content file -TotalCount 80`         |
| `tail -n 50 file`     | `Read` tool (negative offset) or `Get-Content file -Tail 50`                  |
| `grep pattern file`   | `Grep` tool (preferred) — never `Select-String` because output format differs |
| `find . -name X`      | `Glob` tool                                                                   |
| `cat file`            | `Read` tool                                                                   |
| `sed 's/old/new/' -i` | `StrReplace` tool                                                             |
| `awk` / `cut`         | `Read` + manual extraction                                                    |

**Never** pipe a long-running command into `head`/`tail` from PowerShell. Either let the full output stream to the terminal file, or use the `Shell` tool's `block_until_ms` to background it and `Read` the terminal file.

## Rule 3 — Supabase SSL self-signed handshake

`pg` ≥ 8.16 promotes `sslmode=require` (the default in Supabase connection strings) to `sslmode=verify-full`. Supabase's pool certificate is self-signed → handshake fails with `SELF_SIGNED_CERT_IN_CHAIN`.

**Fix pattern used everywhere in `scripts/editorial-pilot/src`:**

```ts
const conn =
  process.env['DATABASE_URL'] ??
  process.env['SUPABASE_DB_POOLER_URL'] ??
  process.env['SUPABASE_DB_URL'];
if (!conn) throw new Error('Missing DATABASE_URL.');
// Strip `sslmode=*` so the explicit `ssl: { rejectUnauthorized: false }`
// below takes effect (pg ≥ 8.16 ignores it when sslmode=require is set).
const cleaned = conn.replace(/[?&]sslmode=[^&]*/giu, '');
const client = new pgModule.Client({
  connectionString: cleaned,
  ssl: { rejectUnauthorized: false },
});
```

Every new DB-touching script in `scripts/` MUST follow this pattern. Reference: `scripts/editorial-pilot/src/guides/inspect-guide.ts`.

## Rule 4 — Path separators in code = forward slash always

Even on Windows, write code paths with `/`:

```ts
// ✅ portable
loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });

// ❌ breaks on Linux CI
loadDotenv({ path: path.resolve(__dirname, '..\\..\\..\\..\\.env.local') });
```

`path.resolve` normalizes correctly on both platforms; `path.join` is also safe. Only the **terminal** uses `\`, the **code** uses `/`.

## Rule 5 — `pnpm --filter` on Windows

The filter argument can match by either package name or directory path. Names work cross-platform:

```powershell
# ✅ preferred — package name
pnpm --filter @mch/editorial-pilot exec tsx src/run.ts

# ⚠️ works but path needs forward slashes
pnpm --filter ./scripts/editorial-pilot exec tsx src/run.ts

# ❌ avoid — Windows path with backslashes confuses pnpm
pnpm --filter .\scripts\editorial-pilot exec tsx src/run.ts
```

If `--filter` matches nothing, pnpm exits 0 with `No projects matched the filters` — easy to miss. Always check the output for that line when a "successful" command produces no output.

## Rule 6 — Backgrounded commands and terminal files

When running long pipelines (e.g. v2 guide regen takes 10-15 min), use the Shell tool with `block_until_ms: 0` to background. The terminal output streams to `C:\Users\<user>\.cursor\projects\<project>\terminals\<id>.txt` — read it with the `Read` tool, never `cat` it from PowerShell.

```ts
// Pattern: background, then poll with AwaitShell for known milestones.
await shell({ command: '…', block_until_ms: 0 });
await awaitShell({ task_id, pattern: 'Done — \\d+ OK / \\d+ failed', block_until_ms: 600000 });
```

### 6a — NEVER kill node processes by date range or by name on Windows

**Bug pattern that wasted 30 min on 2026-05-18:**

```powershell
# WRONG — kills Cursor IDE's tsserver + typingsInstaller + every other node tool.
Get-Process -Name node | Where-Object { $_.StartTime -gt (Get-Date).AddMinutes(-15) } | Stop-Process -Force
```

Cursor IDE runs its own long-lived node helpers (`tsserver.js`, `typingsInstaller.js`, language servers). Killing "all node procs started in the last X minutes" stops them too — TypeScript intelligence stays broken until you restart the IDE.

**Correct pattern — target by command line:**

```powershell
Get-WmiObject Win32_Process -Filter "Name='node.exe'" `
  | Where-Object { $_.CommandLine -like "*run-guides-v2*" -or $_.CommandLine -like "*generate-guide-v2*" } `
  | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

Best of all: track the parent PID printed by the Shell tool when you back-ground a job (e.g. `PID: 26896`), and `Stop-Process -Id 26896` plus its direct children only.

## Rule 7 — `dotenv` loads `.env.local` before `.env`

The repo uses two env files (`.env` for committed defaults, `.env.local` for secrets). Always load both in this order in scripts:

```ts
loadDotenv({ path: path.resolve(__dirname, '../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../.env') });
```

The first call wins for any key already set; the second fills the gaps. This matches Next.js semantics.

## Rule 8 — Newer pg version + Node 22 + Windows = use `pg` 8.11 if hitting SSL issues

If the `Rule 3` strip-sslmode pattern still fails (rare), pin `pg` to `^8.11` in the script's `package.json`. Newer versions have tightened SSL behaviour that doesn't degrade gracefully.

## Rule 9 — Two `.env.local` files in this monorepo (root + apps/web)

The repo ships **two** `.env.local` files and they are NOT symlinked:

| File                   | Loaded by                                                                      | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `/.env.local`          | scripts in `scripts/editorial-pilot`, `packages/*` (via explicit `loadDotenv`) | Editorial pipeline, integration tests, package-level scripts |
| `/apps/web/.env.local` | `next dev` / `next build` (auto-loaded by Next.js from the cwd)                | The web app — server + client bundles                        |

**Next.js only reads the `.env.local` next to its `package.json`.** Editing the root `.env.local` does NOT change anything for the web app.

When you change a `NEXT_PUBLIC_*` variable that the web app needs, edit **`apps/web/.env.local`**.

```powershell
# ❌ WRONG — Next.js will never see this change
echo 'NEXT_PUBLIC_FOO="bar"' >> .env.local

# ✅ RIGHT
echo 'NEXT_PUBLIC_FOO="bar"' >> apps/web/.env.local
```

After modifying `apps/web/.env.local`, **purge the bundle cache** because `NEXT_PUBLIC_*` vars are inlined at compile time:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item -Recurse -Force apps/web/.next
$env:SKIP_ENV_VALIDATION="true"; pnpm --filter @mch/web exec next dev --port 3000
```

## Rule 10 — `@t3-oss/env-nextjs` `skipValidation` does NOT cover the client bundle

`packages/config/src/env-web.ts` uses `createEnv` from `@t3-oss/env-nextjs`. The `skipValidation` flag reads `process.env.SKIP_ENV_VALIDATION`, which is **server-only** — it is not inlined into the client bundle (only `NEXT_PUBLIC_*` vars are). So:

- Setting `SKIP_ENV_VALIDATION=true` skips server validation only.
- The browser **still** runs the Zod schema against the client vars and throws "Invalid environment variables" if any required `NEXT_PUBLIC_*` is missing/empty.

The repo's `env-web.ts` has two safeguards for this:

1. An `onValidationError` callback that logs the actual fields that failed (no more `[object Object]`).
2. A `NEXT_PUBLIC_SKIP_ENV_VALIDATION` escape hatch (use **only** when you knowingly want to bypass client-side validation in dev).

When validation fails in the browser, the React Dev Overlay surfaces a red error. The page itself usually still renders fine (Server Component output is unaffected) — it's the client `createEnv()` call that throws. To diagnose, open DevTools console and look for `[env-web] Environment validation failed:` followed by the JSON of fields with errors.

Reference: `packages/config/src/env-web.ts`.

## Anti-patterns

- ❌ `pnpm … --slug=a,b,c` without quotes → PowerShell mangles the args.
- ❌ Piping through `head`, `tail`, `grep`, `wc` in a Shell tool call.
- ❌ Hardcoding `C:\Users\…` paths in committed code.
- ❌ Connecting to Supabase pg with the raw URL (with `sslmode=require`) on `pg` ≥ 8.16.
- ❌ Using `pnpm --filter .\path` with backslashes.
- ❌ Editing the root `.env.local` and expecting `next dev` to see the change — it reads `apps/web/.env.local` only.
- ❌ Restarting `next dev` after a `NEXT_PUBLIC_*` change without purging `apps/web/.next/` — those vars are inlined at compile time and the cached bundle keeps the old values.
- ❌ Relying on `SKIP_ENV_VALIDATION=true` to bypass client-side validation — it has no effect in the browser.

## References

- `cli-for-agents` skill (CLI design that's terminal-agnostic).
- `llm-output-robustness` skill (referenced in editorial-pilot scripts).
- Reference impls: `scripts/editorial-pilot/src/guides/inspect-guide.ts`, `scripts/editorial-pilot/src/guides/audit-v2-status.ts`.
