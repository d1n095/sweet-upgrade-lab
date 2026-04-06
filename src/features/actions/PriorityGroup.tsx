import { useState } from 'react';
import type { SummaryItem } from './summaryTypes';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SummaryCard } from './SummaryCard';

interface PriorityGroupProps {
  label: string;
  icon: React.ReactNode;
  items: SummaryItem[];
  defaultOpen?: boolean;
}

export function PriorityGroup({ label, icon, items, defaultOpen = false }: PriorityGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (items.length === 0) return null;

  // Sort within group by impact score descending
  const sorted = [...items].sort((a, b) => b.impactScore - a.impactScore);

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex items-center gap-2 text-sm font-semibold w-full hover:opacity-80 transition-opacity"
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        <span>{label}</span>
        <Badge variant="secondary" className="ml-1 text-[10px]">{items.length}</Badge>
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="space-y-2 pl-1">
          {sorted.map((item) => <SummaryCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}
