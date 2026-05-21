/**
 * Brevo transactional email client (skill: email-workflow-automation).
 */
export const BREVO_INTEGRATION_VERSION = '0.0.1' as const;

export type { BrevoError } from './errors';
export {
  brevoConfigFromSharedEnv,
  sendBrevoTransactionalEmail,
  type BrevoClientConfig,
} from './client';
export {
  BrevoSendEmailInputSchema,
  BrevoSendEmailResponseSchema,
  type BrevoSendEmailInput,
  type BrevoSendEmailResponse,
} from './types';
