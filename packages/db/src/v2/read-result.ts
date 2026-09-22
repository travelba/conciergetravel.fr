/** Discriminated read result for v2 Supabase readers (ADR-0033). */
export type V2ReadError =
  | { readonly kind: 'not_found' }
  | { readonly kind: 'query_error'; readonly message: string }
  | { readonly kind: 'parse_error'; readonly issues: string };

export type V2ReadResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: V2ReadError };

export const v2ReadOk = <T>(value: T): V2ReadResult<T> => ({ ok: true, value });

export const v2ReadErr = <T>(error: V2ReadError): V2ReadResult<T> => ({
  ok: false,
  error,
});

export const formatZodIssues = (issues: ReadonlyArray<{ message: string }>): string =>
  issues.map((issue) => issue.message).join('; ');
