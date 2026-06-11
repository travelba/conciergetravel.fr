import { runKitWaveRoomResource } from './resource-kit-wave-rooms-shared.js';

const dryRun = process.argv.includes('--dry-run');
runKitWaveRoomResource('le-bristol-paris', dryRun).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
