import { Body, Container, Head, Heading, Html, Preview, Text } from 'react-email';
import type { JSX, ReactElement } from 'react';

export interface ContactRequestOpsProps {
  readonly requestRef: string;
  readonly name: string;
  readonly email: string;
  readonly phone?: string;
  readonly subject: string;
  readonly message: string;
  readonly locale: 'fr' | 'en';
  readonly source: string;
}

const body = {
  backgroundColor: '#ffffff',
  color: '#111',
  fontFamily: 'ui-monospace,SFMono-Regular,monospace',
};
const container = { maxWidth: 640, margin: '0 auto', padding: 24 };
const heading = { fontSize: 16, marginBottom: 12 };
const tableStyle = { borderCollapse: 'collapse' as const, fontSize: 13 };
const tdLabel = { color: '#555', padding: '6px 12px 6px 0', verticalAlign: 'top' as const };
const tdValue = { padding: '6px 0', verticalAlign: 'top' as const };

function row(label: string, value: string | undefined): ReactElement | null {
  if (value === undefined || value.length === 0) return null;
  return (
    <tr key={label}>
      <td style={tdLabel}>{label}</td>
      <td style={tdValue}>{value}</td>
    </tr>
  );
}

export default function ContactRequestOps(props: ContactRequestOpsProps): JSX.Element {
  const rows: Array<ReactElement | null> = [
    row('Reference', props.requestRef),
    row('Name', props.name),
    row('Email', props.email),
    row('Phone', props.phone),
    row('Subject', props.subject),
    row('Locale', props.locale),
    row('Source', props.source),
    row('Message', props.message),
  ];

  return (
    <Html lang="en">
      <Head />
      <Preview>New concierge contact request — {props.requestRef}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading as="h2" style={heading}>
            New concierge contact request — <strong>{props.requestRef}</strong>
          </Heading>
          <table cellPadding={0} cellSpacing={0} style={tableStyle}>
            <tbody>{rows.filter((r): r is ReactElement => r !== null)}</tbody>
          </table>
          <Text style={{ fontSize: 12, color: '#555', marginTop: 16 }}>
            Internal — do not forward externally. PII redacted in logs.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
