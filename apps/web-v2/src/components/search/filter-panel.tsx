'use client';

import { useMemo, useState } from 'react';
import { FilterSidebar, type FilterGroupId } from '@mch/ui-v2';

import { getDemoFilterGroups } from '@/lib/demo-data';

export function SearchFilterPanel() {
  const groups = useMemo(() => getDemoFilterGroups(), []);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());

  const handleToggle = (optionId: string, _groupId: FilterGroupId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.add(optionId);
      }
      return next;
    });
  };

  return (
    <FilterSidebar
      groups={groups}
      selectedOptionIds={selected}
      onToggleOption={handleToggle}
      onClearAll={() => setSelected(new Set())}
    />
  );
}
