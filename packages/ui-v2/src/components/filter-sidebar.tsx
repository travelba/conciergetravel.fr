'use client';

import * as React from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import * as Collapsible from '@radix-ui/react-collapsible';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '../lib/cn';

/** Booking SRP filter order (CDC §6.3). */
export const FILTER_GROUP_ORDER = [
  'budget',
  'popular',
  'stars',
  'rating',
  'amenities',
  'district',
] as const;

export type FilterGroupId = (typeof FILTER_GROUP_ORDER)[number];

export type FilterOption = {
  id: string;
  label: string;
  count?: number;
};

export type FilterGroup = {
  id: FilterGroupId;
  title: string;
  options: FilterOption[];
  defaultOpen?: boolean;
};

export type FilterSidebarProps = {
  groups: FilterGroup[];
  selectedOptionIds: ReadonlySet<string>;
  onToggleOption: (optionId: string, groupId: FilterGroupId) => void;
  onClearAll?: () => void;
  className?: string;
};

type FilterGroupSectionProps = {
  group: FilterGroup;
  selectedOptionIds: ReadonlySet<string>;
  onToggleOption: (optionId: string, groupId: FilterGroupId) => void;
};

function FilterGroupSection({ group, selectedOptionIds, onToggleOption }: FilterGroupSectionProps) {
  const [open, setOpen] = React.useState(group.defaultOpen ?? true);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="border-b border-[var(--color-border)]"
    >
      <Collapsible.Trigger className="flex w-full items-center justify-between py-3 text-left text-sm font-semibold text-[var(--color-fg)] hover:text-[var(--color-accent-gold)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]">
        {group.title}
        <ChevronDown
          className={cn(
            'size-4 shrink-0 transition-transform duration-[var(--motion-base)]',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </Collapsible.Trigger>
      <Collapsible.Content className="pb-3">
        <ul className="flex flex-col gap-2">
          {group.options.map((option) => {
            const checked = selectedOptionIds.has(option.id);
            const checkboxId = `filter-${group.id}-${option.id}`;

            return (
              <li key={option.id}>
                <label
                  htmlFor={checkboxId}
                  className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-fg)]"
                >
                  <Checkbox.Root
                    id={checkboxId}
                    checked={checked}
                    onCheckedChange={() => onToggleOption(option.id, group.id)}
                    className="flex size-4 shrink-0 items-center justify-center rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] data-[state=checked]:border-[var(--color-action)] data-[state=checked]:bg-[var(--color-action)]"
                  >
                    <Checkbox.Indicator>
                      <Check className="size-3 text-[var(--color-action-on)]" aria-hidden />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  <span className="flex-1">{option.label}</span>
                  {option.count !== undefined ? (
                    <span className="text-xs text-[var(--color-muted)]">{option.count}</span>
                  ) : null}
                </label>
              </li>
            );
          })}
        </ul>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export function FilterSidebar({
  groups,
  selectedOptionIds,
  onToggleOption,
  onClearAll,
  className,
}: FilterSidebarProps) {
  const orderedGroups = FILTER_GROUP_ORDER.flatMap((id) => {
    const group = groups.find((entry) => entry.id === id);
    return group !== undefined ? [group] : [];
  });

  const extraGroups = groups.filter((group) => !FILTER_GROUP_ORDER.includes(group.id));

  return (
    <aside
      className={cn(
        'w-full max-w-[var(--filter-sidebar-width)] shrink-0 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] p-4',
        className,
      )}
      aria-label="Filtres de recherche"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[var(--color-fg)]">Filtrer par</h2>
        {onClearAll !== undefined && selectedOptionIds.size > 0 ? (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-medium text-[var(--color-action)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
          >
            Effacer
          </button>
        ) : null}
      </div>

      <div className="flex flex-col">
        {[...orderedGroups, ...extraGroups].map((group) => (
          <FilterGroupSection
            key={group.id}
            group={group}
            selectedOptionIds={selectedOptionIds}
            onToggleOption={onToggleOption}
          />
        ))}
      </div>
    </aside>
  );
}
