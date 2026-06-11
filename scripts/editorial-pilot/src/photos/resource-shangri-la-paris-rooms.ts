import { runKitWaveRoomResource } from './resource-kit-wave-rooms-shared.js';

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');
runKitWaveRoomResource('shangri-la-paris', dryRun, force).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
