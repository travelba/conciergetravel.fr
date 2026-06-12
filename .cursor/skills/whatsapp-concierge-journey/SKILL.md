---
name: whatsapp-concierge-journey
description: Proactive WhatsApp Business concierge journey for MyConciergeHotel.com — every guest who booked on the site is accompanied before/during/after the stay like a real hotel concierge. Covers opt-in & GDPR, template (HSM) strategy, the 24h window, journey triggers tied to the booking lifecycle, LLM-grounded replies, human escalation, and the boundary with the Prestige 24/7 perk. Use when building or modifying anything WhatsApp-related.
---

# WhatsApp concierge journey — MyConciergeHotel.com

**This is the product's core ambition**: a guest who books on the site is
accompanied on WhatsApp Business like by a proactive palace concierge —
anticipating needs before arrival, present during the stay, attentive after.
Not a support channel: a relationship.

## Triggers

Invoke when:

- Building or modifying any WhatsApp integration (sends, webhooks, templates).
- Touching the booking lifecycle (`booking_requests_email`, future Amadeus
  bookings) — every state change is a potential journey trigger.
- Working on guest messaging, notification preferences, or opt-in UX.
- Touching the Concierge Club WhatsApp perk (`whatsapp_concierge_24_7`).

## Two distinct offers — never conflate them

| Offer                           | Audience                  | Nature                                          | Status                                |
| ------------------------------- | ------------------------- | ----------------------------------------------- | ------------------------------------- |
| **Concierge journey** (this)    | Every guest who booked    | Proactive, automated, event-driven, LLM-assisted | The site's ambition — to build        |
| `whatsapp_concierge_24_7` perk  | Prestige members only     | On-demand 24/7 human concierge                  | ADR-0019 D4: Prestige-only, zero-ops  |

The journey is automation-first, so it scales without breaking ADR-0019's
**zero-ops** constraint. The Prestige perk adds a human SLA on top. A PR that
gives free-tier guests an on-demand human channel violates D4 — refuse it.

## Non-negotiable rules

### Opt-in, GDPR, opt-out

- WhatsApp accompaniment requires **explicit opt-in at booking** (unchecked
  checkbox, dedicated wording: "Votre concierge vous accompagne sur
  WhatsApp"), stored with timestamp + booking ref in Supabase. No opt-in,
  no message — ever.
- `STOP`/`stop` (fr + en) halts the journey immediately (flag in DB, webhook
  handler short-circuit), confirmation message, then silence.
- Phone numbers are PII: never logged (`security-engineering` §PII), RLS on
  all conversation tables, retention aligned with booking data, erasure on
  GDPR request cascades to conversation history.

### Platform mechanics (WhatsApp Business Platform)

- All sends go through a **provider adapter** in `packages/integrations`
  (Cloud API or Twilio behind one interface — vendor swap must not touch
  domain code; `api-integration` conventions: Zod on payloads, retries,
  error envelope).
- **24h customer-service window**: free-form replies (including LLM ones) are
  only allowed within 24h of the guest's last message. Outside the window,
  **only pre-approved template messages (HSM)** may be sent. Every proactive
  journey touchpoint is therefore a template.
- Templates: `utility` category for booking-related touchpoints (cheaper,
  better approval odds), `marketing` only for post-stay Club upsell. Submit
  for approval ≥ 1 week before a release depends on them; keep fr + en
  variants with the same name + locale suffix.
- Protect the **quality rating**: max 1 proactive message per day per guest,
  journey caps (≤ 6 touchpoints per stay), instant honoring of opt-out.
  A dropped quality rating throttles the whole number — it is a production
  incident (`observability-monitoring` alert).

### The journey (proactive concierge choreography)

Event-driven on the booking lifecycle — never cron-blasted marketing:

| Trigger                  | Touchpoint (template)                                              |
| ------------------------ | ------------------------------------------------------------------ |
| Booking confirmed        | Welcome + concierge introduction + what to expect                  |
| J-7 before check-in      | Préparation: transferts, restaurants à réserver, météo, demandes spéciales |
| J-1                      | Infos check-in, horaires, coordonnées hôtel, "souhaitez-vous quelque chose à l'arrivée ?" |
| Arrival day              | Welcome + "votre concierge reste joignable ici"                    |
| Mid-stay (stays ≥ 3 nights) | Discreet check-in: "tout se passe-t-il comme vous le souhaitiez ?" |
| J+1 after check-out      | Remerciement + demande d'avis                                      |
| J+7                      | Post-stay: Club Prestige invitation (marketing template, separate opt-in) |

- Touchpoint content is grounded in the hotel fiche (concierge_advice,
  F&B, POI — same data as the site): the message must feel like it comes
  from someone who knows the hotel. Voice = `editorial-voice.mdc` +
  `concierge-voice-pipeline` (vouvoiement, sobre, précis, jamais obséquieux).
- Scheduler: booking events enqueue future sends (Supabase table
  `whatsapp_journey_steps` with `send_after`, processed by a cron/queue
  worker); idempotency key per (booking, step) in Redis (`redis-caching`)
  — a retried worker must never double-send.

### Inbound: LLM concierge with human escalation

- Webhook route in `apps/web` (`runtime nodejs`), **signature verification
  mandatory**, rate-limited, fast-ack (process async).
- Within the 24h window an LLM agent may answer, but only **grounded on
  domain data** (same functions as the site/MCP: `getHotelBySlug`, FAQ,
  concierge_advice — one domain, N surfaces, see `mcp-server-development`).
  It must never invent availability, prices, or commitments on behalf of
  the hotel (`llm-output-robustness` guardrails).
- Hard escalation triggers → human (ops inbox + WhatsApp handoff template):
  payment issues, complaints, medical/safety topics, anything the LLM scores
  uncertain, and any Prestige member request (their SLA is human).
- Full conversation state in Supabase (`whatsapp_conversations`,
  `whatsapp_messages`, RLS service-role only), linked to booking ref —
  the concierge must remember context across the stay.

### Sync with the rest of the product

- Email (Brevo, `email-workflow-automation`) and WhatsApp are siblings:
  same lifecycle events, one orchestration layer decides the channel
  (WhatsApp if opted-in, else email) — never both for the same touchpoint.
- Journey touchpoints and templates are documented per locale; adding a
  touchpoint requires updating this skill + the orchestration map.

## Anti-patterns to refuse

- Free-form (non-template) proactive sends outside the 24h window.
- Marketing content in `utility` templates (Meta rejection + rating risk).
- LLM answering from its own knowledge instead of domain data.
- Phone numbers in logs, analytics, or Sentry events.
- A second WhatsApp client implementation outside the `packages/integrations`
  adapter.
- On-demand human concierge offered outside Prestige (ADR-0019 D4).
- Journey messages sent without checking the opt-out flag at send time.

## References

- ADR-0019 `docs/adr/0019-le-concierge-club-architecture.md` — D4 zero-ops,
  Prestige perk boundary.
- [`loyalty-program`](../loyalty-program/SKILL.md) — `whatsapp_concierge_24_7`
  perk code, benefit catalogue.
- [`email-workflow-automation`](../email-workflow-automation/SKILL.md) —
  sibling lifecycle channel (Brevo), shared orchestration logic.
- [`booking-engine`](../booking-engine/SKILL.md) — booking lifecycle events
  that drive the journey.
- [`concierge-voice-pipeline`](../concierge-voice-pipeline/SKILL.md) — the
  concierge voice every message must carry.
- [`api-integration`](../api-integration/SKILL.md) — provider adapter
  conventions (Zod, retries, error envelope).
- [`mcp-server-development`](../mcp-server-development/SKILL.md) — same
  domain-grounding contract for agent-facing surfaces.
- [`llm-output-robustness`](../llm-output-robustness/SKILL.md) — guardrails
  for LLM replies.
- [`security-engineering`](../security-engineering/SKILL.md) — PII, webhook
  signatures, secrets.
- [`supabase-postgres-rls`](../supabase-postgres-rls/SKILL.md),
  [`redis-caching`](../redis-caching/SKILL.md),
  [`observability-monitoring`](../observability-monitoring/SKILL.md).
