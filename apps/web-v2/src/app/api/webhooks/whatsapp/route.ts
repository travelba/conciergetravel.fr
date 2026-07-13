import { createHmac, timingSafeEqual } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';

import {
  WhatsAppWebhookPayloadSchema,
  WhatsAppWebhookVerifyQuerySchema,
  extractInboundText,
  isWhatsAppOptOut,
} from '@mch/integrations/whatsapp';

import { classifyInboundWhatsApp } from '@/server/whatsapp/orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERIFY_TOKEN = process.env['WHATSAPP_WEBHOOK_VERIFY_TOKEN'] ?? '';
const APP_SECRET = process.env['WHATSAPP_APP_SECRET'] ?? '';

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (APP_SECRET.length === 0 || signatureHeader === null) return false;
  const expected = createHmac('sha256', APP_SECRET).update(rawBody, 'utf8').digest('hex');
  const provided = signatureHeader.replace(/^sha256=/, '');
  if (expected.length !== provided.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    return false;
  }
}

/**
 * GET — Meta webhook verification (hub.challenge echo).
 */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = WhatsAppWebhookVerifyQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_verify_query' }, { status: 400 });
  }
  if (VERIFY_TOKEN.length === 0 || parsed.data['hub.verify_token'] !== VERIFY_TOKEN) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return new NextResponse(parsed.data['hub.challenge'], {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

/**
 * POST — inbound messages & delivery receipts.
 * Verifies X-Hub-Signature-256, parses payload, fast-acks 200, enqueues async work.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = WhatsAppWebhookPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 422 });
  }

  const inbound = extractInboundText(parsed.data);

  if (inbound !== null) {
    const action = classifyInboundWhatsApp({
      body: inbound.body,
      isOptOut: isWhatsAppOptOut(inbound.body),
      bookingRef: null,
      waMessageId: inbound.messageId,
    });

    // Async worker hook — queue to Redis/QStash in Phase 8bis wiring.
    // Fast-ack: Meta retries on non-2xx; never block on downstream I/O here.
    void Promise.resolve().then(() => enqueueWhatsAppInbound(action, inbound));
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

/** Placeholder async enqueue — replace with QStash / worker when infra lands. */
function enqueueWhatsAppInbound(
  _action: ReturnType<typeof classifyInboundWhatsApp>,
  _inbound: NonNullable<ReturnType<typeof extractInboundText>>,
): void {
  // Worker wiring: QStash publish / Redis queue — must not block webhook ack.
}
