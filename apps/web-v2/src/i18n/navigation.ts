import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

const nav = createNavigation(routing);

export const { Link, usePathname, useRouter, getPathname } = nav;

type RedirectArgs = Parameters<typeof nav.redirect>;
type PermanentRedirectArgs = Parameters<typeof nav.permanentRedirect>;

export const redirect: (...args: RedirectArgs) => never = nav.redirect;
export const permanentRedirect: (...args: PermanentRedirectArgs) => never = nav.permanentRedirect;
