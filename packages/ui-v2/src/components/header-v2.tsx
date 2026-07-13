'use client';

import * as React from 'react';
import { Globe, HelpCircle, UserCircle } from 'lucide-react';

import { cn } from '../lib/cn';

export type HeaderTab = {
  id: string;
  label: string;
  href: string;
  active?: boolean;
};

export type HeaderUtilityLink = {
  id: string;
  label: string;
  href: string;
};

export type HeaderV2Props = {
  logo: React.ReactNode;
  tabs: HeaderTab[];
  utilityLinks?: HeaderUtilityLink[];
  localeLabel?: string;
  currencyLabel?: string;
  onLocaleClick?: () => void;
  onCurrencyClick?: () => void;
  accountLabel?: string;
  accountHref?: string;
  helpHref?: string;
  className?: string;
};

export function HeaderV2({
  logo,
  tabs,
  utilityLinks = [],
  localeLabel = 'FR',
  currencyLabel = 'EUR',
  onLocaleClick,
  onCurrencyClick,
  accountLabel = 'Mon compte',
  accountHref = '/compte',
  helpHref = '/aide',
  className,
}: HeaderV2Props) {
  return (
    <header
      className={cn(
        'border-b border-[var(--color-border)] bg-[var(--color-surface-container-lowest)]',
        className,
      )}
    >
      <div className="ui-v2-container flex h-[var(--header-utilities-height)] items-center justify-end gap-4 text-xs text-[var(--color-muted)]">
        <button
          type="button"
          onClick={onCurrencyClick}
          className="inline-flex items-center gap-1 hover:text-[var(--color-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
        >
          {currencyLabel}
        </button>
        <button
          type="button"
          onClick={onLocaleClick}
          className="inline-flex items-center gap-1 hover:text-[var(--color-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
        >
          <Globe className="size-3.5" aria-hidden />
          {localeLabel}
        </button>
        {utilityLinks.map((link) => (
          <a
            key={link.id}
            href={link.href}
            className="hover:text-[var(--color-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
          >
            {link.label}
          </a>
        ))}
        <a
          href={helpHref}
          className="inline-flex items-center gap-1 hover:text-[var(--color-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
        >
          <HelpCircle className="size-3.5" aria-hidden />
          Aide
        </a>
        <a
          href={accountHref}
          className="inline-flex items-center gap-1 font-medium text-[var(--color-action)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
        >
          <UserCircle className="size-3.5" aria-hidden />
          {accountLabel}
        </a>
      </div>

      <div className="ui-v2-container flex h-[var(--header-tabs-height)] items-center gap-8">
        <div className="shrink-0">{logo}</div>
        <nav aria-label="Navigation principale" className="hidden min-w-0 flex-1 md:block">
          <ul className="flex items-center gap-1">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <a
                  href={tab.href}
                  aria-current={tab.active ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center rounded-sm px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]',
                    tab.active
                      ? 'border-b-2 border-[var(--color-action)] text-[var(--color-action)]'
                      : 'text-[var(--color-fg)] hover:bg-[var(--color-surface-container-low)] hover:text-[var(--color-accent-gold)]',
                  )}
                >
                  {tab.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
