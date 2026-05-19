import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

const nav = createNavigation(routing);

export const { Link, usePathname, useRouter, getPathname } = nav;

/**
 * `redirect` is re-bound with a flat `(...args) => never` signature.
 *
 * `createNavigation`'s declared return type for `redirect` is `=> never`,
 * but the function-type expression is deeply parametric (heavy
 * conditional + `Omit & Partial` intersections — see
 * `node_modules/next-intl/.../navigation/{react-server,react-client}/createNavigation.d.ts`).
 * TypeScript's narrowing analyser refuses to treat such complex call
 * sites as terminating, so `if (x === null) redirect(...)` would leave
 * `x` typed as `T | null` afterwards.
 *
 * The flat alias preserves the parameter types via `Parameters<...>`
 * while giving TS a simple `(...args) => never` shape it *will* narrow
 * on. Same trick for `permanentRedirect`.
 */
type RedirectArgs = Parameters<typeof nav.redirect>;
type PermanentRedirectArgs = Parameters<typeof nav.permanentRedirect>;

export const redirect: (...args: RedirectArgs) => never = nav.redirect;
export const permanentRedirect: (...args: PermanentRedirectArgs) => never = nav.permanentRedirect;
