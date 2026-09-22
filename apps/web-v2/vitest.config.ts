import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**'],
    passWithNoTests: true,
    setupFiles: [path.resolve(__dirname, 'src/test/env-stub.ts')],
    alias: {
      'server-only': path.resolve(__dirname, 'src/test/server-only-stub.ts'),
      '@': path.resolve(__dirname, 'src'),
      '@mch/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
    },
  },
});
