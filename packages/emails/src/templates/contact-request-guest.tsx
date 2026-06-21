import { Body, Container, Head, Heading, Html, Preview, Section, Text } from 'react-email';
import type { JSX } from 'react';

export interface ContactRequestGuestProps {
  readonly locale: 'fr' | 'en';
  readonly name: string;
  readonly subject: string;
  readonly requestRef: string;
}

const colors = {
  fg: '#111111',
  muted: '#555555',
  border: '#e5e5e5',
  bg: '#ffffff',
} as const;

const body = {
  backgroundColor: colors.bg,
  color: colors.fg,
  fontFamily: 'Inter,system-ui,sans-serif',
};
const container = { maxWidth: 560, margin: '0 auto', padding: 24 };
const heading = { fontSize: 20, marginBottom: 16, color: colors.fg };
const para = { fontSize: 14, lineHeight: '1.6', color: colors.fg, marginBottom: 12 };
const refBox = {
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  padding: 12,
  fontFamily: 'ui-monospace,SFMono-Regular,monospace',
  fontSize: 13,
  letterSpacing: 1,
  marginTop: 8,
  color: colors.fg,
};
const footer = { fontSize: 12, color: colors.muted, marginTop: 24 };

const copy = {
  fr: {
    preview: 'Votre message est entre les mains de votre concierge.',
    title: 'Message reçu',
    hello: (n: string) => `Bonjour ${n},`,
    body: (s: string) =>
      `Merci pour votre message « ${s} ». Votre concierge l'a bien reçu et le traite personnellement.`,
    sla: 'Nous revenons vers vous sous 24 heures ouvrées.',
    refLabel: 'Référence :',
    sign: '— Votre Concierge MyConciergeHotel',
  },
  en: {
    preview: "Your message is in your concierge's hands.",
    title: 'Message received',
    hello: (n: string) => `Hello ${n},`,
    body: (s: string) =>
      `Thank you for your message "${s}". Your concierge has received it and is handling it personally.`,
    sla: 'We will get back to you within 24 business hours.',
    refLabel: 'Reference:',
    sign: '— Your MyConciergeHotel Concierge',
  },
} as const;

export default function ContactRequestGuest(props: ContactRequestGuestProps): JSX.Element {
  const c = copy[props.locale];
  return (
    <Html lang={props.locale}>
      <Head />
      <Preview>{c.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading as="h1" style={heading}>
            {c.title}
          </Heading>
          <Text style={para}>{c.hello(props.name)}</Text>
          <Text style={para}>{c.body(props.subject)}</Text>
          <Text style={para}>{c.sla}</Text>
          <Section style={refBox}>
            {c.refLabel} <strong>{props.requestRef}</strong>
          </Section>
          <Text style={footer}>{c.sign}</Text>
        </Container>
      </Body>
    </Html>
  );
}
