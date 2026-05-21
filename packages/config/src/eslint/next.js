// ESLint flat config for Next.js apps (apps/web + apps/admin).
//
// Inherits the workspace base config, then layers Next.js / React / a11y
// recommendations. `eslint-config-next` 16+ ships as a native ESLint v9
// flat config (array of config objects), so we import it directly — using
// `@eslint/eslintrc`'s `FlatCompat` here would re-validate already-flat
// configs and trip on circular `plugins.react` references inside its
// JSON-based schema validator.
//
// We strip the `next/typescript` block before consuming the array: it would
// re-declare the `@typescript-eslint` plugin already provided by our base via
// `typescript-eslint`'s flat exports (ESLint v9 forbids redeclaring a plugin
// across config objects in the same chain).

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import base from './base.js';

const nextConfigs = nextCoreWebVitals.filter((entry) => entry?.name !== 'next/typescript');

export default [
  ...base,
  ...nextConfigs,
  {
    // Rebind `@typescript-eslint/parser` so TS-aware rules from base
    // (no-unused-vars, no-explicit-any, …) see the correct AST when Next
    // would otherwise default to its Babel-based parser.
    languageOptions: {
      parser: tseslint.parser,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'react/no-unescaped-entities': 'off',
      'jsx-a11y/anchor-is-valid': 'error',
      '@next/next/no-html-link-for-pages': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../../*'],
              message: 'Use workspace path aliases (@mch/*) instead of deep relative imports.',
            },
          ],
        },
      ],
    },
  },
];
