import { cn } from '../lib/cn';

export type FooterLink = {
  id: string;
  label: string;
  href: string;
};

export type FooterColumn = {
  id: string;
  title: string;
  links: FooterLink[];
};

export type FooterV2Props = {
  columns: FooterColumn[];
  brandName?: string;
  tagline?: string;
  legalLinks?: FooterLink[];
  className?: string;
};

const DEFAULT_LEGAL_LINKS: FooterLink[] = [
  { id: 'legal', label: 'Mentions légales', href: '/mentions-legales' },
  { id: 'privacy', label: 'Confidentialité', href: '/confidentialite' },
  { id: 'terms', label: 'CGV', href: '/cgv' },
  { id: 'cookies', label: 'Cookies', href: '/cookies' },
  { id: 'sitemap', label: 'Sitemap', href: '/sitemap.xml' },
  { id: 'llms', label: 'llms.txt', href: '/llms.txt' },
  { id: 'agents', label: 'agent-skills.json', href: '/agent-skills.json' },
];

export function FooterV2({
  columns,
  brandName = 'MyConciergeHotel.com',
  tagline = 'La sélection du Concierge',
  legalLinks = DEFAULT_LEGAL_LINKS,
  className,
}: FooterV2Props) {
  return (
    <footer
      className={cn(
        'border-t border-[var(--color-border)] bg-[var(--color-surface-container-high)] text-sm text-[var(--color-fg)]',
        className,
      )}
    >
      <div className="ui-v2-container grid gap-8 py-10 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <div className="md:col-span-2 lg:col-span-1">
          <p className="font-serif text-lg text-[var(--color-fg)]">{brandName}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">{tagline}</p>
        </div>

        {columns.map((column) => (
          <div key={column.id}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              {column.title}
            </h2>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.href}
                    className="text-[var(--color-fg)] hover:text-[var(--color-action)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--color-border)]">
        <div className="ui-v2-container flex flex-wrap items-center gap-x-4 gap-y-2 py-4 text-xs text-[var(--color-muted)]">
          {legalLinks.map((link) => (
            <a
              key={link.id}
              href={link.href}
              className="hover:text-[var(--color-fg)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
            >
              {link.label}
            </a>
          ))}
          <span className="ml-auto">
            © {new Date().getFullYear()} {brandName}
          </span>
        </div>
      </div>
    </footer>
  );
}
