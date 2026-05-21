/**
 * @mch/emails — Brevo transactional email templates (React Email).
 * Each template lives in `src/templates/<slug>.tsx` and is rendered to HTML
 * by `packages/integrations/brevo` before sending (skill: email-workflow-automation).
 */
export const EMAILS_PACKAGE_VERSION = '0.0.1' as const;

export { renderEmailHtml, renderEmailText } from './render';

export { default as EmailRequestGuest } from './templates/email-request-guest';
export type { EmailRequestGuestProps } from './templates/email-request-guest';

export { default as EmailRequestOps } from './templates/email-request-ops';
export type { EmailRequestOpsProps } from './templates/email-request-ops';

export { default as BookingConfirmationGuest } from './templates/booking-confirmation-guest';
export type { BookingConfirmationGuestProps } from './templates/booking-confirmation-guest';
