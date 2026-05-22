// Ambient declaration for Next.js's `server-only` package.
// We are a workspace library (not bundled by Next), so the package's
// own types — which live behind a Next.js-specific bundler resolution —
// aren't reachable here. TS 6 elevated unresolved side-effect imports
// to errors, hence this stub.
declare module 'server-only';
