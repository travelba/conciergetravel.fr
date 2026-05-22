// Ambient declaration for Payload CMS's side-effect CSS entrypoint.
// `@payloadcms/next/css` only ships CSS (no JS types), so TS 6 (which
// errors on unresolved side-effect imports) can't find a typing source.
declare module '@payloadcms/next/css';
