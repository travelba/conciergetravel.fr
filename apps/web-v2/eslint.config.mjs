import next from '@mch/config/eslint/next';

/**
 * v2 design system boundary — @mch/ui (v1) and apps/web components are
 * forbidden. All UI must come from @mch/ui-v2.
 */
const config = [
  ...next,
  {
    ignores: ['.next/**', 'node_modules/**', '.turbo/**', 'public/**', 'next-env.d.ts'],
  },
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@mch/ui',
              message: 'Use @mch/ui-v2 in apps/web-v2 — @mch/ui is the v1 design system.',
            },
          ],
          patterns: [
            {
              group: ['@mch/ui/*'],
              message: 'Use @mch/ui-v2 in apps/web-v2 — @mch/ui is the v1 design system.',
            },
            {
              group: ['../../web/*', '../../../web/*'],
              message: 'Do not import from apps/web — compose shared logic via packages/*.',
            },
          ],
        },
      ],
    },
  },
];

export default config;
