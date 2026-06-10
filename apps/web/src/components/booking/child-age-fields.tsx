'use client';

import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { clampChildAge, MAX_CHILD_AGE, MIN_CHILD_AGE } from '@/lib/booking/hotel-stay';

export interface ChildAgeFieldsProps {
  readonly childAges: readonly number[];
  readonly onChange: (ages: readonly number[]) => void;
  /** `panel` = search bar dropdown; `rail` = fiche booking `.rf-field` stack. */
  readonly variant?: 'panel' | 'rail';
}

/**
 * One age `<select>` per child (0–17). Shared by the homepage search bar
 * and the hotel fiche booking widget.
 */
export function ChildAgeFields({
  childAges,
  onChange,
  variant = 'panel',
}: ChildAgeFieldsProps): ReactElement | null {
  const t = useTranslations('hotelSearchBar');

  if (childAges.length === 0) return null;

  const ageOptions: number[] = [];
  for (let age = MIN_CHILD_AGE; age <= MAX_CHILD_AGE; age += 1) {
    ageOptions.push(age);
  }

  return (
    <div
      className={
        variant === 'rail'
          ? 'flex flex-col gap-2 border-t border-[color:var(--ligne)] pt-3'
          : 'mt-2 flex flex-col gap-2 border-t border-[rgba(43,39,34,0.12)] pt-3'
      }
      role="group"
      aria-label={t('childAgesGroupLabel')}
    >
      {childAges.map((age, index) => {
        const fieldId = `child-age-${index}`;
        return (
          <label
            key={fieldId}
            htmlFor={fieldId}
            className={
              variant === 'rail'
                ? 'rf-field cursor-default hover:border-[color:var(--ligne)]'
                : 'flex items-center justify-between gap-3 py-1'
            }
          >
            <span className={variant === 'rail' ? undefined : 'text-sm text-[color:var(--texte)]'}>
              {t('childAgeLabel', { index: index + 1 })}
            </span>
            <select
              id={fieldId}
              value={age}
              aria-label={t('childAgeSelectAria', { index: index + 1 })}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                if (!Number.isFinite(parsed)) return;
                const next = childAges.map((current, i) =>
                  i === index ? clampChildAge(parsed) : current,
                );
                onChange(next);
              }}
              className={
                variant === 'rail'
                  ? 'rf-val cursor-pointer border-0 bg-transparent p-0'
                  : 'rounded-md border border-[rgba(43,39,34,0.2)] bg-white px-2 py-1 text-sm'
              }
            >
              {ageOptions.map((optionAge) => (
                <option key={optionAge} value={optionAge}>
                  {t('childAgeYears', { age: optionAge })}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
