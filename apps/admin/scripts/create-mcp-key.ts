/**
 * Creates (or rotates) the "Cursor" MCP API key and, on Windows, registers it
 * as the user-level environment variable `PAYLOAD_MCP_API_KEY` so the
 * `payload-cms` MCP server in `.cursor/mcp.json` can authenticate.
 *
 * Usage (from the repo root):
 *   pnpm --filter @mch/admin mcp:key
 *
 * The script:
 *   1. Boots the Payload Local API (direct DB access — the dev server does
 *      NOT need to be running). `payload run` loads .env.local/.env itself,
 *      with the exact same algorithm as Next.js.
 *   2. Deletes any previous key labelled "Cursor" (DB-level, hook-free, so
 *      rows encrypted with another PAYLOAD_SECRET can't crash the run).
 *   3. Creates a fresh key attached to the first admin user.
 *   4. On Windows, runs `setx PAYLOAD_MCP_API_KEY <key>` automatically.
 *
 * Idempotent: re-running simply rotates the key.
 */
/* eslint-disable no-console -- CLI script: console output is the deliverable */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

import { getPayload } from 'payload';

import config from '../src/payload.config';

const KEY_LABEL = 'Cursor';

async function main(): Promise<void> {
  const payload = await getPayload({ config });

  // 1. Find an admin user to attach the key to.
  const admins = await payload.find({
    collection: 'users',
    where: { role: { equals: 'admin' } },
    limit: 1,
    overrideAccess: true,
  });
  const admin = admins.docs[0];
  if (!admin) {
    throw new Error('No admin user found in cms.users — create one in the admin panel first.');
  }

  // 2. Drop any previous "Cursor" key at the DB layer (no afterRead hooks, so
  //    rows encrypted with a different PAYLOAD_SECRET cannot break decryption).
  await payload.db.deleteMany({
    collection: 'payload-mcp-api-keys',
    where: { label: { equals: KEY_LABEL } },
  });

  // 3. Create the new key. Payload encrypts `apiKey` with PAYLOAD_SECRET.
  const apiKey = crypto.randomUUID();
  await payload.create({
    collection: 'payload-mcp-api-keys',
    data: {
      user: admin.id,
      label: KEY_LABEL,
      description: 'Key used by the payload-cms MCP server in Cursor (.cursor/mcp.json).',
      enableAPIKey: true,
      apiKey,
    },
    overrideAccess: true,
  });

  payload.logger.info(`MCP API key "${KEY_LABEL}" created for ${admin['email']}.`);

  // 4. On Windows, persist it as a user-level env var for Cursor.
  if (process.platform === 'win32') {
    const result = spawnSync('setx', ['PAYLOAD_MCP_API_KEY', apiKey], {
      shell: true,
      stdio: 'inherit',
    });
    if (result.status === 0) {
      console.log('\n✅ PAYLOAD_MCP_API_KEY enregistrée dans Windows (setx).');
      console.log('   Ferme complètement Cursor puis rouvre-le pour que la variable soit prise en compte.');
    } else {
      console.log('\n⚠️ setx a échoué — enregistre la clé manuellement :');
      console.log(`   setx PAYLOAD_MCP_API_KEY "${apiKey}"`);
    }
  } else {
    console.log(`\nPAYLOAD_MCP_API_KEY=${apiKey}`);
    console.log('Export this variable in your shell/IDE environment.');
  }

  console.log(`\nClé API MCP : ${apiKey}\n`);

  // Close the DB pool so the process can exit naturally — calling
  // process.exit() here would truncate buffered stdout (piped output).
  await payload.destroy();
}

// Top-level await: `payload run` terminates the process as soon as module
// evaluation finishes, so main() must be awaited (not fire-and-forget).
try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
