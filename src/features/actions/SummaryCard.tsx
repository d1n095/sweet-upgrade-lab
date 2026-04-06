import { useState } from 'react';
import type { SummaryItem, ExplainBlock } from './summaryTypes';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Tag,
  Wrench,
  Database,
  Monitor,
  Layers,
} from 'lucide-react';
import { ImpactBadge } from './ImpactBadge';

// ── Helpers ───────────────────────────────────────────────────────────────────

function CategoryIcon({ category }: { category: SummaryItem['category'] }) {
  if (category === 'UI problem')  return <Monitor  className="h-4 w-4 text-blue-500"   />;
  if (category === 'Data issue')  return <Database className="h-4 w-4 text-purple-500" />;
  if (category === 'Config issue') return <Layers  className="h-4 w-4 text-orange-500" />;
  return <Wrench className="h-4 w-4 text-slate-500" />;
}

function FlowTagList({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600"
        >
          <Tag className="h-2.5 w-2.5" />
          {tag}
        </span>
      ))}
    </div>
  );
}

function ExplainPanel({ explain }: { explain: ExplainBlock }) {
  return (
    <div className="rounded-md border border-blue-100 bg-blue-50/60 dark:bg-blue-950/20 p-3 space-y-2 text-xs">
      <p className="font-semibold text-blue-700 text-[11px] uppercase tracking-wide">Why this happens</p>
      <p className="text-blue-900 dark:text-blue-200 leading-snug">{explain.why}</p>
      <div className="flex flex-wrap gap-3 pt-1">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Detected by</p>
          <p className="text-blue-800 dark:text-blue-300">{explain.scanStep}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Affected part</p>
          <p className="text-blue-800 dark:text-blue-300">{explain.affectedPart}</p>
        </div>
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface SummaryCardProps {
  item: SummaryItem;
}

export function SummaryCard({ item }: SummaryCardProps) {
  const [expanded,    setExpanded]    = useState(false);
  const [showExplain, setShowExplain] = useState(false);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Default view */}
        <button
          type="button"
          className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/40 transition-colors"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <CategoryIcon category={item.category} />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-medium leading-tight">{item.title}</p>
            <p className="text-xs text-muted-foreground leading-snug">{item.description}</p>
            <FlowTagList tags={item.flowTags} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ImpactBadge score={item.impactScore} />
            <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
            {expanded
              ? <ChevronDown  className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t px-4 py-3 space-y-3 text-xs bg-muted/20">
            {/* Consequence block */}
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
              <p className="font-semibold text-amber-700 text-[10px] uppercase tracking-wide mb-0.5">
                If ignored:
              </p>
              <p className="text-amber-900 dark:text-amber-200 leading-snug">{item.consequence}</p>
            </div>

            <div>
              <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Suggested fix</p>
              <p>{item.suggestedFix}</p>
            </div>

            {/* Explain toggle */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={() => setShowExplain((v) => !v)}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                {showExplain ? 'Hide explanation' : 'Explain'}
              </Button>
              {showExplain && <ExplainPanel explain={item.explain} />}
            </div>

            {/* Raw technical data */}
            <details className="mt-1">
              <summary className="cursor-pointer text-[10px] text-muted-foreground hover:text-foreground select-none">
                Technical details
              </summary>
              <pre className="mt-2 rounded bg-background border p-2 text-[10px] overflow-x-auto whitespace-pre-wrap font-mono">
                {JSON.stringify(item._raw, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
