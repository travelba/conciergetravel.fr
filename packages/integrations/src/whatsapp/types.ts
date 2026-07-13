import { z } from 'zod';

/**
 * WhatsApp Cloud API webhook payloads (Meta Graph API).
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 */

const WhatsAppProfileSchema = z.object({
  name: z.string(),
});

const WhatsAppContactSchema = z.object({
  profile: WhatsAppProfileSchema,
  wa_id: z.string().min(1),
});

const WhatsAppTextBodySchema = z.object({
  body: z.string(),
});

const WhatsAppMessageSchema = z.object({
  from: z.string().min(1),
  id: z.string().min(1),
  timestamp: z.string().min(1),
  type: z.enum(['text', 'image', 'audio', 'video', 'document', 'interactive', 'button', 'unknown']),
  text: WhatsAppTextBodySchema.optional(),
});

const WhatsAppMetadataSchema = z.object({
  display_phone_number: z.string(),
  phone_number_id: z.string().min(1),
});

const WhatsAppValueSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  metadata: WhatsAppMetadataSchema,
  contacts: z.array(WhatsAppContactSchema).optional(),
  messages: z.array(WhatsAppMessageSchema).optional(),
  statuses: z
    .array(
      z.object({
        id: z.string(),
        status: z.enum(['sent', 'delivered', 'read', 'failed']),
        timestamp: z.string(),
        recipient_id: z.string(),
      }),
    )
    .optional(),
});

const WhatsAppChangeSchema = z.object({
  value: WhatsAppValueSchema,
  field: z.literal('messages'),
});

const WhatsAppEntrySchema = z.object({
  id: z.string(),
  changes: z.array(WhatsAppChangeSchema).min(1),
});

/** Top-level webhook POST body from Meta. */
export const WhatsAppWebhookPayloadSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(WhatsAppEntrySchema).min(1),
});

export type WhatsAppWebhookPayload = z.infer<typeof WhatsAppWebhookPayloadSchema>;

/** GET verification query (hub.mode, hub.verify_token, hub.challenge). */
export const WhatsAppWebhookVerifyQuerySchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.verify_token': z.string().min(1),
  'hub.challenge': z.string().min(1),
});

export type WhatsAppWebhookVerifyQuery = z.infer<typeof WhatsAppWebhookVerifyQuerySchema>;

/** Normalised inbound text message extracted from a verified webhook. */
export const WhatsAppInboundTextSchema = z.object({
  messageId: z.string().min(1),
  fromWaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  body: z.string(),
  timestamp: z.string(),
  senderName: z.string().optional(),
});

export type WhatsAppInboundText = z.infer<typeof WhatsAppInboundTextSchema>;

/** Outbound template send (HSM) — provider adapter input shape. */
export const WhatsAppTemplateSendSchema = z.object({
  to: z.string().min(1),
  templateName: z.string().min(1),
  languageCode: z.enum(['fr', 'en']),
  components: z
    .array(
      z.object({
        type: z.enum(['body', 'header', 'button']),
        parameters: z.array(
          z.object({
            type: z.literal('text'),
            text: z.string(),
          }),
        ),
      }),
    )
    .optional(),
});

export type WhatsAppTemplateSend = z.infer<typeof WhatsAppTemplateSendSchema>;

/**
 * Extract the first inbound text message from a parsed webhook payload.
 * Returns `null` when the payload is a status-only delivery receipt.
 */
export function extractInboundText(payload: WhatsAppWebhookPayload): WhatsAppInboundText | null {
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const messages = change.value.messages;
      if (messages === undefined || messages.length === 0) continue;

      const message = messages[0];
      if (message === undefined) continue;
      if (message.type !== 'text' || message.text === undefined) continue;

      const contact = change.value.contacts?.[0];
      return {
        messageId: message.id,
        fromWaId: message.from,
        phoneNumberId: change.value.metadata.phone_number_id,
        body: message.text.body.trim(),
        timestamp: message.timestamp,
        ...(contact !== undefined ? { senderName: contact.profile.name } : {}),
      };
    }
  }
  return null;
}

/** Guest opt-out keywords (fr + en) — skill: whatsapp-concierge-journey. */
export const WHATSAPP_OPT_OUT_KEYWORDS = ['stop', 'STOP', 'arret', 'arrêt'] as const;

export function isWhatsAppOptOut(body: string): boolean {
  const normalised = body.trim();
  return (WHATSAPP_OPT_OUT_KEYWORDS as readonly string[]).includes(normalised);
}
