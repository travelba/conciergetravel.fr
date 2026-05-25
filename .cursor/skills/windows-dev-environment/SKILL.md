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

## Rule 9 quater — MCP Supabase ≠ editorial-pilot scripts: keep root `.env.local` Supabase creds even if you only ever use the MCP for DB reads

Symptom: a pipeline like
`scripts/editorial-pilot/src/hotels/run-hotel-factual-summary.ts`
crashes immediately with:

```
[factual-summary] FATAL ZodError:
  path: ["NEXT_PUBLIC_SUPABASE_URL"]  received: "undefined"
  path: ["SUPABASE_SERVICE_ROLE_KEY"] received: "undefined"
```

Root cause: the project maintainer uses the Supabase MCP for all
DB introspection + writes (via `apply_migration` / `execute_sql`),
so they never set the REST-API credentials locally. That works fine
for ad-hoc SQL but **editorial-pilot scripts write through the
Supabase REST API** (`fetch(${SUPABASE_URL}/rest/v1/...)`), which
needs the env vars in the **root** `.env.local`.

Fix once, for the whole pipeline portfolio:

1. Dashboard → <https://supabase.com/dashboard/project/fsmfozxgujskluxakeoq/settings/api>
2. Copy `Project URL` + `service_role` (secret) keys.
3. Add to **root** `.env.local` (gitignored via `*.local`):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://fsmfozxgujskluxakeoq.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG... (the long one, not the anon)
   ```

Reason it falls through:

- `apps/web/.env.local` is the Next.js one (loaded by `next dev`);
  the maintainer keeps it lean because the Vercel preview/prod
  envs fill in everything else.
- Root `.env.local` is the **scripts** one (loaded by
  `loadDotenv({ path: '../../../../.env.local' })` from the
  pipelines — see Rule 7).
- These two never share state. MCP-only DB usage means root
  `.env.local` stays empty until the first pipeline run, which
  then fails surprisingly.

Alternative escape hatch (defer if you can): rewrite the pipeline
to emit a `UPDATE ... SET factual_summary_fr=...` SQL file that's
applied via the Supabase MCP `execute_sql`. Avoids ever putting
the service_role key on a developer machine, at the cost of 30
min of plumbing per pipeline. Tracked as future improvement when
we move pipelines to GitHub Actions / Vercel Cron.

Reference incident: 2026-05-25 session — the maintainer had pushed
itinerary content via SQL seeds + Supabase MCP for weeks; only
when the next written-content chantier (factual_summary re-run)
came up did the missing root creds surface.

## Rule 9 bis — `spawn` + `shell:true` on Windows mangles `&|<>` even when quoted

PowerShell + pnpm.ps1 + cmd.exe form a **three-layer wrapper** that fights any
attempt at caret-escaping shell metachars. A hotel named `"Le Roch Hotel & Spa"`
in argv silently truncates to `"Le Roch Hotel"` when spawned via
`spawn('pnpm', args, { shell: true })` — and the subsequent `--city Paris`
gets misinterpreted, so build-brief-manual fails with "Missing --city".

The caret-escape pattern (`arg.replace(/([&|<>])/gu, '^$1')`) does NOT work
in practice because PowerShell strips the carets before cmd sees them.

**The robust fix is to bypass the wrapper entirely**: invoke `node` + `tsx`
directly with `shell: false`, so the args flow as a native argv array and
no shell touches them.

```ts
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const localRequire = createRequire(import.meta.url);

// tsx ships a `bin` entry but `dist/cli.mjs` isn't in exports — resolve via
// the package.json then walk to the cli.
const tsxBin = resolve(localRequire.resolve('tsx/package.json'), '..', 'dist', 'cli.mjs');

spawn('node', [tsxBin, 'src/some-script.ts', '--name', 'Hôtel & Spa'], {
  shell: false, // ← critical: no PowerShell/cmd interpretation
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,
});
```

The reference repair lives in
[`scripts/editorial-pilot/src/phaseC/build-yonder-briefs.ts`](../../../scripts/editorial-pilot/src/phaseC/build-yonder-briefs.ts)
(commit on `feat/editorial-corpus-quality-convergence`, May 2026).

Failure mode to spot: child process exit code 1 with stderr "Missing --city"
when the original hotel name contained `&`, `|`, `<`, or `>`. Always test the
fix against an `&`-containing argument before declaring it solved.

## Rule 9 ter — `git commit -m` mangles messages with `>`, `&`, `|`, `<`, `\n` on PowerShell

PowerShell interprets `>`, `&`, `|`, `<` as redirection/pipeline operators **before** the `git` binary ever sees the arguments, and newlines inside double-quoted heredocs are flattened to a single line. The typical breakage:

```powershell
# ❌ WRONG — "Palaces & Hotels > Par type" becomes:
#    - PowerShell pipes "Palaces" into git
#    - git complains about "Hotels" as a pathspec
#    - the part after ">" is interpreted as a file redirect
git commit -m "feat(nav): refonte > Palaces & Hotels"
# fatal: pathspec 'Hotels' did not match any file(s) known to git
```

Heredoc-style `$(cat <<'EOF' … EOF)` recommended in many guides **does not work** in PowerShell either — it's bash syntax.

**The robust pattern is to write the message to a temp file and use `git commit -F`:**

```powershell
# ✅ Right — write the multi-line, special-char-rich message to a file
@'
feat(nav): refonte navigation v2

Hard rules:
- Palaces & Hotels > Par type
- Pipe characters | are fine here
- Newlines are preserved verbatim
'@ | Set-Content -Encoding utf8 .git-msg.tmp

git commit -F .git-msg.tmp
Remove-Item .git-msg.tmp -Force
```

For one-line commit messages without special characters, plain `git commit -m "feat: short message"` is fine — only switch to the file pattern when the message contains `>`, `<`, `&`, `|`, backticks, or multiple lines.

Reference incident: PR #71 navigation v2 commit (May 2026) — the commit message contained `Palaces & Hotels > Par type` in a bullet list and consistently failed for ~15 minutes before switching to `-F`.

## Rule 9 quater — "Mystery commit" on local `main` recovery (Cursor agent leakage)

Cursor's background agents and pre-commit hooks occasionally land a commit on the local `main` branch that the human never authored and that does not exist on `origin/main`. Typical clue: `git log` shows a commit you don't recognise, `git status` flags untracked files matching the commit's scope (often `scripts/editorial-pilot/output/**`).

**Do NOT just `git reset --hard origin/main`** — that destroys the work the agent did, even if it was off-topic for the current task. The reusable recovery pattern that ships the work to a side branch without polluting the current task:

```powershell
# 1. Identify the mystery commit (anything between origin/main and HEAD)
git fetch origin --quiet
git log --oneline origin/main..HEAD

# 2. Save the unwanted commit on a dedicated branch (no PR yet)
git branch feat/<short-name-of-the-work> HEAD
git push origin feat/<short-name-of-the-work>

# 3. Rewind local main to origin/main WITHOUT losing the worktree
#    (--mixed unstages but keeps files; --soft would keep them staged)
git reset --mixed origin/main

# 4. The work files now appear as untracked in your worktree.
#    Either commit them to a feature branch you actually own, or
#    `git clean -fd` them if they're test outputs (e.g. /output/**).
```

The critical invariant: **never `git push --force` to `origin/main`**. The mystery commit only lived locally, so a non-force rewind is safe.

Reference incident: editorial-pilot `description-from-wiki` files (commit `49953e2`, May 2026) — saved on `feat/hotel-description-from-wikipedia` and rewound from local `main` before the four PR series #68–#71 was split.

## Rule 10 — `@t3-oss/env-nextjs` `skipValidation` does NOT cover the client bundle

`packages/config/src/env-web.ts` uses `createEnv` from `@t3-oss/env-nextjs`. The `skipValidation` flag reads `process.env.SKIP_ENV_VALIDATION`, which is **server-only** — it is not inlined into the client bundle (only `NEXT_PUBLIC_*` vars are). So:

- Setting `SKIP_ENV_VALIDATION=true` skips server validation only.
- The browser **still** runs the Zod schema against the client vars and throws "Invalid environment variables" if any required `NEXT_PUBLIC_*` is missing/empty.

The repo's `env-web.ts` has two safeguards for this:

1. An `onValidationError` callback that logs the actual fields that failed (no more `[object Object]`).
2. A `NEXT_PUBLIC_SKIP_ENV_VALIDATION` escape hatch (use **only** when you knowingly want to bypass client-side validation in dev).

When validation fails in the browser, the React Dev Overlay surfaces a red error. The page itself usually still renders fine (Server Component output is unaffected) — it's the client `createEnv()` call that throws. To diagnose, open DevTools console and look for `[env-web] Environment validation failed:` followed by the JSON of fields with errors.

Reference: `packages/config/src/env-web.ts`.

## Rule 11 — Cursor Cloud PRs may auto-close when you push a manual conflict resolution

When a Cursor Cloud-spawned PR (head ref `cursor/<slug>-78ae`) is conflicting with `main`, the natural fix is to check the branch out locally, merge `main`, resolve, and push back to the same head ref. **Sometimes the Cursor Cloud backend detects this as a foreign push and closes the PR + clears its head ref** (`gh pr view N --json headRefName,baseRefName` returns `null` for both, even though the remote branch still exists).

Symptoms:

- `.merge-pr.ps1` (or `gh pr merge N`) reports `[SKIP] closed` immediately after a successful push.
- `gh pr reopen N` fails with `GraphQL: Could not open the pull request. (reopenPullRequest)`.
- `git ls-remote origin <branch>` still resolves — the **branch survived**, only the PR object was torched.

**Recovery pattern** (used for #92 → #103 and #95 → #104 in the May 2026 deployment wave):

```powershell
# The remote branch still exists; just re-open it as a new PR.
gh pr create `
  --head cursor/<original-slug>-78ae `
  --base main `
  --title "<original PR title>" `
  --body "Reopens #<N> (Cursor Cloud auto-closed). <one-line summary of conflict resolution>."

# Then merge the new PR (e.g. #103) with the existing flow — it inherits the
# pushed merge commit and runs CI immediately.
```

The CI duration is the same as the original PR (the workflow is keyed off the head ref, not the PR number), so the only cost is the PR number bump and a brief comment in the new PR body pointing back to the closed predecessor for audit trail.

**When this can be avoided:** if the Cursor Cloud agent owning the PR is still alive, ask it to rebase its branch itself via its own dialog rather than pushing manually. The auto-close is triggered by _unexpected_ foreign pushes, not by agent-driven updates.

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
