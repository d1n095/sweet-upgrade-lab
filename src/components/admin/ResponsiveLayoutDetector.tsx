import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Monitor, Tablet, Smartphone, AlertTriangle, CheckCircle, XCircle,
  Loader2, Play, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type IssueType = 'layout_break' | 'overflow_x' | 'grid_failure' | 'sidebar_conflict' | 'element_overlap' | 'clipped_content';
type IssueSeverity = 'warning' | 'error' | 'critical';
type Breakpoint = 'desktop' | 'tablet' | 'mobile';
type ScanStatus = 'idle' | 'running' | 'done';

interface ResponsiveIssue {
  id: string;
  type: IssueType;
  severity: IssueSeverity;
  breakpoint: Breakpoint;
  element: string;
  detail: string;
  selector: string;
  detectedAt: string;
}

const BREAKPOINTS: { key: Breakpoint; width: number; label: string; icon: React.ElementType }[] = [
  { key: 'desktop', width: 1280, label: 'Desktop (1280px)', icon: Monitor },
  { key: 'tablet', width: 768, label: 'Tablet (768px)', icon: Tablet },
  { key: 'mobile', width: 375, label: 'Mobil (375px)', icon: Smartphone },
];

const issueTypeLabels: Record<IssueType, string> = {
  layout_break: 'Layout-brott',
  overflow_x: 'Horisontell overflow',
  grid_failure: 'Grid-fel',
  sidebar_conflict: 'Sidopanel-konflikt',
  element_overlap: 'Element-överlapp',
  clipped_content: 'Klippt innehåll',
};

const severityConfig: Record<IssueSeverity, { label: string; color: string; icon: React.ElementType }> = {
  warning: { label: 'Varning', color: 'text-orange-500', icon: AlertTriangle },
  error: { label: 'Fel', color: 'text-destructive', icon: XCircle },
  critical: { label: 'Kritiskt', color: 'text-red-600', icon: XCircle },
};

const breakpointConfig: Record<Breakpoint, { color: string; icon: React.ElementType }> = {
  desktop: { color: 'text-blue-500', icon: Monitor },
  tablet: { color: 'text-purple-500', icon: Tablet },
  mobile: { color: 'text-orange-500', icon: Smartphone },
};

function buildSelector(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = el.className && typeof el.className === 'string'
    ? '.' + el.className.split(' ').filter(c => c && !c.startsWith('__') && c.length < 30).slice(0, 2).join('.')
    : '';
  const text = el.textContent?.trim().slice(0, 20) || '';
  return `${tag}${id}${cls}${text ? ` "${text}"` : ''}`;
}

function detectIssuesAtSize(
  width: number,
  breakpoint: Breakpoint,
  makeIssue: (type: IssueType, severity: IssueSeverity, bp: Breakpoint, element: string, detail: string, selector: string) => ResponsiveIssue
): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];

  const docWidth = document.documentElement.scrollWidth;
  const viewWidth = document.documentElement.clientWidth;
  if (docWidth > viewWidth + 5) {
    issues.push(makeIssue(
      'overflow_x', 'error', breakpoint,
      `Sidan (${docWidth}px > ${viewWidth}px)`,
      `Horisontell overflow: sidan är ${docWidth - viewWidth}px bredare än viewporten (${viewWidth}px). Orsakar sidoscroll.`,
      'html'
    ));
  }

  const containers = document.querySelectorAll('div, section, main, aside, article, nav, header, footer');
  containers.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetWidth < 20 || htmlEl.offsetHeight < 20) return;
    const style = getComputedStyle(htmlEl);
    if (style.display === 'none' || style.visibility === 'hidden') return;

    const contentW = htmlEl.scrollWidth;
    const containerW = htmlEl.clientWidth;
    const overflowX = contentW - containerW;

    if (overflowX > 10 && style.overflowX !== 'hidden' && style.overflowX !== 'auto' && style.overflowX !== 'scroll') {
      const rect = htmlEl.getBoundingClientRect();
      if (rect.right > viewWidth + 5) {
        issues.push(makeIssue(
          'overflow_x', 'warning', breakpoint,
          buildSelector(htmlEl).slice(0, 60),
          `Element har ${contentW}px bredd i ${containerW}px container → ${overflowX}px overflow. Bidrar till sidoscroll.`,
          buildSelector(htmlEl)
        ));
      }
    }
  });

  const gridContainers = document.querySelectorAll('[class*="grid"]');
  gridContainers.forEach((el) => {
    const htmlEl = el as HTMLElement;
    const style = getComputedStyle(htmlEl);
    if (style.display !== 'grid' && style.display !== 'inline-grid') return;
    if (htmlEl.offsetWidth < 20) return;

    const children = Array.from(htmlEl.children) as HTMLElement[];
    if (children.length === 0) return;

    const containerRect = htmlEl.getBoundingClientRect();

    let overflowingChildren = 0;
    children.forEach((child) => {
      const childRect = child.getBoundingClientRect();
      if (childRect.right > containerRect.right + 5 || childRect.left < containerRect.left - 5) {
        overflowingChildren++;
      }
    });

    if (overflowingChildren > 0) {
      issues.push(makeIssue(
        'grid_failure', 'error', breakpoint,
        buildSelector(htmlEl).slice(0, 60),
        `Grid har ${overflowingChildren}/${children.length} barn som svämmar över containern vid ${width}px. Kolumndefinitionen är troligen för bred.`,
        buildSelector(htmlEl)
      ));
    }

    const cols = style.gridTemplateColumns.split(' ').filter(c => c !== '');
    if (cols.length > 1) {
      const narrowChildren = children.filter(c => c.offsetWidth < 200 && c.offsetWidth > 0);
      if (narrowChildren.length > children.length * 0.5 && children.length >= 3) {
        issues.push(makeIssue(
          'grid_failure', 'warning', breakpoint,
          buildSelector(htmlEl).slice(0, 60),
          `Grid har ${cols.length} kolumner vid ${width}px men ${narrowChildren.length}/${children.length} barn är under 200px breda. Överväg färre kolumner vid denna breakpoint.`,
          buildSelector(htmlEl)
        ));
      }
    }
  });

  const interactiveEls = document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]');
  const rects: { el: HTMLElement; rect: DOMRect }[] = [];

  interactiveEls.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetWidth < 5 || htmlEl.offsetHeight < 5) return;
    const style = getComputedStyle(htmlEl);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
    rects.push({ el: htmlEl, rect: htmlEl.getBoundingClientRect() });
  });

  for (let i = 0; i < rects.length && i < 200; i++) {
    for (let j = i + 1; j < rects.length && j < 200; j++) {
      const a = rects[i];
      const b = rects[j];

      if (Math.abs(a.rect.top - b.rect.top) > 100) continue;

      const overlapX = Math.max(0, Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left));
      const overlapY = Math.max(0, Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top));

      if (overlapX > 10 && overlapY > 10) {
        if (!a.el.contains(b.el) && !b.el.contains(a.el)) {
          const overlapArea = overlapX * overlapY;
          const smallerArea = Math.min(
            a.rect.width * a.rect.height,
            b.rect.width * b.rect.height
          );
          if (smallerArea > 0 && overlapArea / smallerArea > 0.3) {
            issues.push(makeIssue(
              'element_overlap', 'error', breakpoint,
              `${buildSelector(a.el).slice(0, 30)} ↔ ${buildSelector(b.el).slice(0, 30)}`,
              `Interaktiva element överlappar med ${Math.round(overlapArea)}px² (${Math.round(overlapArea / smallerArea * 100)}% av mindre element). Klick kan nå fel element.`,
              buildSelector(a.el)
            ));
            break;
          }
        }
      }
    }
  }

  const fixedEls = Array.from(document.querySelectorAll('aside, nav, [class*="sidebar"], [class*="drawer"]'))
    .filter((el) => {
      const style = getComputedStyle(el as HTMLElement);
      return style.position === 'fixed' || style.position === 'absolute' || style.position === 'sticky';
    }) as HTMLElement[];

  const mainContent = document.querySelector('main, [role="main"], [class*="content"]') as HTMLElement;
  if (mainContent && fixedEls.length > 0) {
    const mainRect = mainContent.getBoundingClientRect();
    fixedEls.forEach((sideEl) => {
      const sideRect = sideEl.getBoundingClientRect();
      const sideStyle = getComputedStyle(sideEl);
      if (sideStyle.display === 'none' || sideStyle.visibility === 'hidden') return;
      if (sideRect.width < 10) return;

      const overlapX = Math.max(0, Math.min(sideRect.right, mainRect.right) - Math.max(sideRect.left, mainRect.left));
      if (overlapX > 20 && sideRect.width > 50) {
        issues.push(makeIssue(
          'sidebar_conflict', 'error', breakpoint,
          buildSelector(sideEl).slice(0, 60),
          `Sidopanel (${Math.round(sideRect.width)}px) överlappar huvudinnehåll med ${Math.round(overlapX)}px vid ${width}px viewport. Innehållet döljs bakom sidopanelen.`,
          buildSelector(sideEl)
        ));
      }
    });
  }

  const visibleEls = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, button, a, label');
  let clippedCount = 0;
  visibleEls.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetWidth < 5) return;
    const rect = htmlEl.getBoundingClientRect();
    if (rect.right > viewWidth + 10 && rect.left < viewWidth && htmlEl.textContent?.trim()) {
      clippedCount++;
    }
  });

  if (clippedCount > 0) {
    issues.push(makeIssue(
      'clipped_content', clippedCount > 5 ? 'error' : 'warning', breakpoint,
      `${clippedCount} element`,
      `${clippedCount} synliga text/knappelement klipps av vid höger kant vid ${width}px viewport.`,
      'viewport-overflow'
    ));
  }

  return issues;
}

const IssueCard = ({ issue }: { issue: ResponsiveIssue }) => {
  const [expanded, setExpanded] = useState(false);
  const sev = severityConfig[issue.severity];
  const bp = breakpointConfig[issue.breakpoint];
  const SevIcon = sev.icon;
  const BpIcon = bp.icon;

  return (
    <div className={cn(
      'border rounded-lg p-3 space-y-1',
      issue.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' :
      issue.severity === 'error' ? 'border-destructive/30 bg-destructive/5' :
      'border-orange-500/20 bg-orange-500/5'
    )}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <SevIcon className={cn('w-4 h-4 shrink-0', sev.color)} />
            <span className="text-sm font-medium truncate">{issue.element}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className="text-[10px] gap-0.5">
              <BpIcon className={cn('w-2.5 h-2.5', bp.color)} />
              {issue.breakpoint}
            </Badge>
            <Badge variant="outline" className={cn('text-[10px]', sev.color)}>
              {issueTypeLabels[issue.type]}
            </Badge>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="pt-2 border-t border-border/50 mt-1 space-y-1">
          <p className="text-xs text-foreground">{issue.detail}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{issue.selector}</p>
        </div>
      )}
    </div>
  );
};

const ResponsiveLayoutDetector = () => {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [issues, setIssues] = useState<ResponsiveIssue[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentBreakpoint, setCurrentBreakpoint] = useState<Breakpoint | null>(null);

  const makeIssue = (
    type: IssueType, severity: IssueSeverity, breakpoint: Breakpoint,
    element: string, detail: string, selector: string
  ): ResponsiveIssue => ({
    id: `${type}-${breakpoint}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type, severity, breakpoint, element, detail, selector,
    detectedAt: new Date().toISOString(),
  });

  const runScan = useCallback(async () => {
    setStatus('running');
    setIssues([]);
    setProgress(0);

    const allIssues: ResponsiveIssue[] = [];
    const originalWidth = window.innerWidth;

    for (let i = 0; i < BREAKPOINTS.length; i++) {
      const bp = BREAKPOINTS[i];
      setCurrentBreakpoint(bp.key);
      setProgress(Math.round(((i) / BREAKPOINTS.length) * 100));

      await new Promise(r => setTimeout(r, 150));

      if (Math.abs(originalWidth - bp.width) < 100) {
        const found = detectIssuesAtSize(bp.width, bp.key, makeIssue);
        allIssues.push(...found);
      } else {
        const predictedIssues = predictIssuesForBreakpoint(bp.width, bp.key, makeIssue);
        allIssues.push(...predictedIssues);
      }
    }

    setProgress(100);
    setCurrentBreakpoint(null);

    const seen = new Set<string>();
    const deduped = allIssues.filter(issue => {
      const key = `${issue.type}::${issue.breakpoint}::${issue.element.slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const sevOrder: Record<IssueSeverity, number> = { critical: 0, error: 1, warning: 2 };
    deduped.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

    setIssues(deduped);
    setStatus('done');

    if (deduped.length > 0) {
      toast.warning(`Responsiv Layout: ${deduped.length} problem hittade`);
    } else {
      toast.success('Responsiv Layout: Inga problem!');
    }
  }, []);

  const byBreakpoint = (bp: Breakpoint) => issues.filter(i => i.breakpoint === bp).length;
  const bySeverity = (s: IssueSeverity) => issues.filter(i => i.severity === s).length;
  const byType = (t: IssueType) => issues.filter(i => i.type === t).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant={status === 'idle' ? 'default' : 'outline'}
          onClick={runScan}
          disabled={status === 'running'}
          className="gap-1.5 text-xs"
        >
          {status === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {status === 'idle' ? 'Kör responsiv-check' : 'Kör igen'}
        </Button>
        {issues.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => { setIssues([]); setStatus('idle'); }} className="gap-1.5 text-xs">
            <Trash2 className="w-3.5 h-3.5" />
            Rensa
          </Button>
        )}
        <div className="ml-auto text-[10px] text-muted-foreground">
          Kontrollerar: overflow · överlapp · grid · sidopanel · klippt innehåll
        </div>
      </div>

      {status === 'running' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              {currentBreakpoint ? `Skannar ${currentBreakpoint}…` : 'Förbereder…'}
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {status === 'done' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {BREAKPOINTS.map(bp => {
            const count = byBreakpoint(bp.key);
            const BpIcon = bp.icon;
            return (
              <Card key={bp.key} className={cn(count > 0 ? 'border-destructive/20' : 'border-green-500/20')}>
                <CardContent className="p-3 flex items-center gap-3">
                  <BpIcon className={cn('w-5 h-5', count > 0 ? 'text-destructive' : 'text-green-500')} />
                  <div>
                    <p className="text-sm font-semibold">{bp.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {count === 0 ? 'Inga problem' : `${count} problem`}
                    </p>
                  </div>
                  {count === 0 && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
                  {count > 0 && <XCircle className="w-4 h-4 text-destructive ml-auto" />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {status === 'done' && issues.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(issueTypeLabels) as IssueType[]).map(type => {
            const count = byType(type);
            if (count === 0) return null;
            return (
              <Badge key={type} variant="outline" className="text-[10px]">
                {issueTypeLabels[type]}: {count}
              </Badge>
            );
          })}
          <Badge variant="outline" className={cn('text-[10px]', bySeverity('critical') > 0 ? 'text-red-600' : bySeverity('error') > 0 ? 'text-destructive' : 'text-orange-500')}>
            {bySeverity('critical')} kritiska · {bySeverity('error')} fel · {bySeverity('warning')} varningar
          </Badge>
        </div>
      )}

      {issues.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Responsiva problem ({issues.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-2 pr-2">
                {issues.map(issue => <IssueCard key={issue.id} issue={issue} />)}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {status === 'done' && issues.length === 0 && (
        <Card className="border-green-500/20">
          <CardContent className="py-8 text-center">
            <CheckCircle className="w-8 h-8 mx-auto text-green-500 mb-2" />
            <p className="text-sm font-medium text-green-600">Alla breakpoints OK</p>
            <p className="text-xs text-muted-foreground mt-1">
              Inga overflow-, överlapp- eller grid-problem hittades vid desktop, tablet eller mobil.
            </p>
          </CardContent>
        </Card>
      )}

      {status === 'idle' && issues.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <div className="flex items-center justify-center gap-2 mb-3 text-muted-foreground/40">
              <Monitor className="w-8 h-8" />
              <Tablet className="w-6 h-6" />
              <Smartphone className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Responsiv Layout-detektor</p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-md mx-auto">
              Simulerar desktop, tablet och mobil-layouter. Detekterar overflow, element-överlapp,
              trasiga grids, sidopanel-konflikter och klippt innehåll.
            </p>
            <Button size="sm" onClick={runScan} className="mt-4 gap-1.5 text-xs">
              <Play className="w-3.5 h-3.5" />
              Starta responsiv-check
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

function predictIssuesForBreakpoint(
  width: number,
  breakpoint: Breakpoint,
  makeIssue: (type: IssueType, severity: IssueSeverity, bp: Breakpoint, element: string, detail: string, selector: string) => ResponsiveIssue
): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];

  const gridEls = document.querySelectorAll('[class*="grid-cols"]');
  gridEls.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetWidth < 20) return;
    const className = htmlEl.className || '';

    const hasResponsiveGrid = /sm:grid-cols|md:grid-cols|lg:grid-cols|xl:grid-cols/.test(className);

    if (!hasResponsiveGrid) {
      const fixedColMatch = className.match(/\bgrid-cols-(\d+)\b/);
      if (fixedColMatch) {
        const cols = parseInt(fixedColMatch[1], 10);
        const estimatedColWidth = width / cols;
        if (cols > 2 && estimatedColWidth < 200 && breakpoint === 'mobile') {
          issues.push(makeIssue(
            'grid_failure', 'error', breakpoint,
            `Fast grid-cols-${cols}`,
            `Grid med ${cols} fasta kolumner → ~${Math.round(estimatedColWidth)}px per kolumn vid ${width}px. Saknar responsiva breakpoints (sm:/md:/lg:). Kolumner blir för smala.`,
            buildSelector(htmlEl)
          ));
        } else if (cols > 3 && estimatedColWidth < 250 && breakpoint === 'tablet') {
          issues.push(makeIssue(
            'grid_failure', 'warning', breakpoint,
            `Fast grid-cols-${cols}`,
            `Grid med ${cols} fasta kolumner → ~${Math.round(estimatedColWidth)}px per kolumn vid ${width}px. Kan vara för smalt på tablet.`,
            buildSelector(htmlEl)
          ));
        }
      }
    }
  });

  const fixedWidthEls = document.querySelectorAll('[class*="w-["], [style*="width"]');
  fixedWidthEls.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetWidth < 20) return;
    const actualWidth = htmlEl.offsetWidth;

    if (actualWidth > width * 0.95 && actualWidth > 300) {
      const style = getComputedStyle(htmlEl);
      if (style.display === 'none' || style.visibility === 'hidden') return;

      issues.push(makeIssue(
        'overflow_x', 'warning', breakpoint,
        buildSelector(htmlEl).slice(0, 60),
        `Element är ${actualWidth}px brett — nära eller över ${width}px viewport-bredd. Kan orsaka overflow.`,
        buildSelector(htmlEl)
      ));
    }
  });

  if (breakpoint === 'mobile' || breakpoint === 'tablet') {
    const sidebars = document.querySelectorAll('aside, [class*="sidebar"], [class*="Sidebar"]');
    sidebars.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const style = getComputedStyle(htmlEl);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      if (htmlEl.offsetWidth < 50) return;

      const isAlwaysVisible = !htmlEl.className.includes('hidden') &&
        !htmlEl.className.includes('md:flex') &&
        !htmlEl.className.includes('lg:flex') &&
        !htmlEl.className.includes('md:block') &&
        !htmlEl.className.includes('lg:block');

      if (isAlwaysVisible && htmlEl.offsetWidth > 200) {
        issues.push(makeIssue(
          'sidebar_conflict', 'warning', breakpoint,
          buildSelector(htmlEl).slice(0, 60),
          `Sidopanel (${htmlEl.offsetWidth}px) verkar synlig utan responsiv döljning vid ${width}px. Kan ta för mycket utrymme.`,
          buildSelector(htmlEl)
        ));
      }
    });
  }

  return issues;
}

export default ResponsiveLayoutDetector;
