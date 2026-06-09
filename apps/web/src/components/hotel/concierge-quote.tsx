import type { ReactElement } from 'react';

interface ConciergeQuoteProps {
  readonly text: string;
  readonly signature: string;
}

/**
 * Kit `.concierge-quote` — « Le mot du Concierge » on hotel fiches
 * (`les-airelles-gordes.html` § #apropos).
 */
export function ConciergeQuote({ text, signature }: ConciergeQuoteProps): ReactElement {
  return (
    <figure className="mch-kit concierge-quote">
      <span className="cq-mark" aria-hidden>
        “
      </span>
      <p className="cq-text">{text}</p>
      <figcaption className="cq-sign">
        <span className="cq-name">{signature}</span>
      </figcaption>
    </figure>
  );
}
