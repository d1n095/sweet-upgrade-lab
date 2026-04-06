import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImpactBadgeProps {
  score: number;
}

export function ImpactBadge({ score }: ImpactBadgeProps) {
  const color =
    score >= 70 ? 'text-red-700 bg-red-50 border-red-300' :
    score >= 40 ? 'text-yellow-700 bg-yellow-50 border-yellow-300' :
                  'text-slate-600 bg-slate-50 border-slate-300';
  return (
    <span
      title="Impact score — higher means more urgent"
      className={cn('inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-semibold', color)}
    >
      <Activity className="h-2.5 w-2.5" />
      {score}
    </span>
  );
}
