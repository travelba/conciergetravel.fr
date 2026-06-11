import { runKitWaveRoomResource } from './resource-kit-wave-rooms-shared.js';

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');
runKitWaveRoomResource('les-pres-deugenie', dryRun, force).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
