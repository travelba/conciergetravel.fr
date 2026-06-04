'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';

interface SubmitButtonProps {
  readonly children: ReactNode;
  /** Label shown while the form submission / navigation is pending. */
  readonly pendingLabel: string;
  readonly className: string;
  readonly ariaLabel?: string;
}

/**
 * Submit button wired to `useFormStatus` so any `<form>` (server action OR a
 * plain navigation form) gets a disabled + spinner pending state for free.
 * The Travelport sandbox flow issues multi-second upstream calls on submit;
 * without this the user has no feedback and can double-submit.
 *
 * MUST be rendered inside a `<form>` (the hook reads the enclosing form's
 * pending state).
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  ariaLabel,
}: SubmitButtonProps): ReactNode {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      {...(ariaLabel !== undefined ? { 'aria-label': ariaLabel } : {})}
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
            />
          </svg>
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
