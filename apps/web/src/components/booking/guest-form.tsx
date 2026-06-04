'use client';

import { useState, type FormEvent, type ReactElement } from 'react';

export interface GuestFormMessages {
  readonly legend: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly specialRequests: string;
  readonly specialRequestsHint: string;
  readonly specialRequestsPlaceholder: string;
  readonly consent: string;
  readonly submit: string;
  readonly vRequired: string;
  readonly vEmail: string;
  readonly vPhone: string;
  readonly vConsent: string;
}

interface GuestFormProps {
  readonly action: (formData: FormData) => void | Promise<void>;
  readonly messages: GuestFormMessages;
  /** Résumé d'erreur côté serveur (offre expirée, état invalide…). */
  readonly serverError?: string;
}

type TextField = 'firstName' | 'lastName' | 'email' | 'phone';
type FieldErrors = Partial<Record<TextField | 'consent', string>>;

// Validation volontairement permissive (le domaine `parseGuest` reste l'autorité) :
// on bloque seulement les saisies manifestement invalides côté client pour un
// retour immédiat, sans diverger du schéma Zod serveur.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function GuestForm({ action, messages, serverError }: GuestFormProps): ReactElement {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [consent, setConsent] = useState(false);

  const validateText = (field: TextField, value: string): string | undefined => {
    const v = value.trim();
    if (v.length === 0) return messages.vRequired;
    if (field === 'email' && !EMAIL_RE.test(v)) return messages.vEmail;
    if (field === 'phone' && v.length < 5) return messages.vPhone;
    return undefined;
  };

  const setFieldError = (field: TextField | 'consent', msg: string | undefined): void => {
    setErrors((prev) => {
      const next = { ...prev };
      if (msg === undefined) delete next[field];
      else next[field] = msg;
      return next;
    });
  };

  const onBlur = (field: TextField) => (e: React.FocusEvent<HTMLInputElement>) => {
    setFieldError(field, validateText(field, e.target.value));
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>): void => {
    const form = e.currentTarget;
    const next: FieldErrors = {};
    for (const field of ['firstName', 'lastName', 'email', 'phone'] as const) {
      const input = form.elements.namedItem(field);
      const value = input instanceof HTMLInputElement ? input.value : '';
      const msg = validateText(field, value);
      if (msg !== undefined) next[field] = msg;
    }
    if (!consent) next.consent = messages.vConsent;

    if (Object.keys(next).length > 0) {
      e.preventDefault();
      setErrors(next);
      const firstInvalid = (Object.keys(next) as Array<keyof FieldErrors>)[0];
      if (firstInvalid !== undefined) {
        const el = form.elements.namedItem(firstInvalid);
        if (el instanceof HTMLElement) el.focus();
      }
    }
  };

  const fieldClass = (field: TextField): string =>
    [
      'rounded-md border bg-bg text-fg px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring',
      errors[field] !== undefined ? 'border-red-400' : 'border-border',
    ].join(' ');

  const errorNote = (field: TextField | 'consent'): ReactElement | null =>
    errors[field] !== undefined ? (
      <span id={`${field}-error`} role="alert" className="text-xs text-red-700">
        {errors[field]}
      </span>
    ) : null;

  return (
    <form
      action={action}
      onSubmit={onSubmit}
      className="border-border bg-bg shadow-card flex flex-col gap-5 rounded-2xl border p-6"
      noValidate
    >
      <fieldset className="flex flex-col gap-4">
        <legend className="text-fg mb-1 font-serif text-lg">{messages.legend}</legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg font-medium">{messages.firstName}</span>
            <input
              type="text"
              name="firstName"
              required
              autoComplete="given-name"
              maxLength={60}
              aria-invalid={errors.firstName !== undefined}
              aria-describedby={errors.firstName !== undefined ? 'firstName-error' : undefined}
              onBlur={onBlur('firstName')}
              className={fieldClass('firstName')}
            />
            {errorNote('firstName')}
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg font-medium">{messages.lastName}</span>
            <input
              type="text"
              name="lastName"
              required
              autoComplete="family-name"
              maxLength={60}
              aria-invalid={errors.lastName !== undefined}
              aria-describedby={errors.lastName !== undefined ? 'lastName-error' : undefined}
              onBlur={onBlur('lastName')}
              className={fieldClass('lastName')}
            />
            {errorNote('lastName')}
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg font-medium">{messages.email}</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              maxLength={254}
              aria-invalid={errors.email !== undefined}
              aria-describedby={errors.email !== undefined ? 'email-error' : undefined}
              onBlur={onBlur('email')}
              className={fieldClass('email')}
            />
            {errorNote('email')}
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg font-medium">{messages.phone}</span>
            <input
              type="tel"
              name="phone"
              required
              autoComplete="tel"
              maxLength={30}
              aria-invalid={errors.phone !== undefined}
              aria-describedby={errors.phone !== undefined ? 'phone-error' : undefined}
              onBlur={onBlur('phone')}
              className={fieldClass('phone')}
            />
            {errorNote('phone')}
          </label>
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg font-medium">{messages.specialRequests}</span>
          <textarea
            name="specialRequests"
            rows={3}
            maxLength={500}
            placeholder={messages.specialRequestsPlaceholder}
            className="border-border bg-bg text-fg focus-visible:ring-ring resize-y rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
          />
          <span className="text-muted text-xs">{messages.specialRequestsHint}</span>
        </label>
      </fieldset>

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="consent"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            setFieldError('consent', undefined);
          }}
          aria-invalid={errors.consent !== undefined}
          aria-describedby={errors.consent !== undefined ? 'consent-error' : undefined}
          className="accent-gold mt-0.5 h-4 w-4"
        />
        <span className="text-fg">{messages.consent}</span>
      </label>
      {errorNote('consent')}

      {serverError !== undefined ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
        >
          {serverError}
        </p>
      ) : null}

      <button
        type="submit"
        className="bg-gold text-charcoal hover:bg-gold-600 focus-visible:ring-ring mt-1 self-start rounded-md px-6 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2"
      >
        {messages.submit}
      </button>
    </form>
  );
}
