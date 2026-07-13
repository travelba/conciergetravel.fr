/**
 * Web-only layout — imports `@mch/ui-v2/tokens.css` for expo-router web builds.
 * Native uses `app/_layout.tsx` + `lib/theme.ts`.
 */
import '@mch/ui-v2/tokens.css';

export { default } from './_layout';
