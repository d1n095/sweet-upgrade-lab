import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Crosshair, X, Trash2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClickLog {
  id: string;
  timestamp: string;
  clickedEl: string;
  clickedTag: string;
  blockedBy: string | null;
  blockReason: string | null;
  pointerEvents: string;
  zIndex: string;
  overlaysAbove: number;
  path: string[];
}

function describeEl(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = el.className && typeof el.className === 'string'
    ? '.' + el.className.split(' ').filter(c => c && c.length < 25 && !c.startsWith('__')).slice(0, 2).join('.')
    : '';
  const text = el.textContent?.trim().slice(0, 20) || '';
  return `${tag}${id}${cls}${text ? ` "${text}"` : ''}`;
}

function getBlockingInfo(el: HTMLElement): { blockedBy: string | null; blockReason: string | null; overlaysAbove: number } {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  // What's actually at this point?
  const topEl = document.elementFromPoint(cx, cy) as HTMLElement | null;
  let overlaysAbove = 0;

  if (!topEl) return { blockedBy: null, blockReason: 'Inget element vid klickpunkt', overlaysAbove: 0 };

  // If the top element is not the clicked element or a descendant, something is blocking
  if (topEl !== el && !el.contains(topEl) && !topEl.contains(el)) {
    // Check if it's an overlay
    const topStyle = getComputedStyle(topEl);
    const topZ = parseInt(topStyle.zIndex) || 0;
    const elStyle = getComputedStyle(el);
    const elZ = parseInt(elStyle.zIndex) || 0;

    let reason = `Element "${describeEl(topEl).slice(0, 40)}" ligger ovanpå (z-index: ${topZ} vs ${elZ})`;

    if (topStyle.position === 'fixed' || topStyle.position === 'absolute') {
      reason += `, position: ${topStyle.position}`;
    }
    if (topStyle.pointerEvents === 'auto' || topStyle.pointerEvents === '') {
      reason += ', fångar klick';
    }

    return { blockedBy: describeEl(topEl), blockReason: reason, overlaysAbove: 1 };
  }

  // Check for pointer-events: none on the element itself
  const style = getComputedStyle(el);
  if (style.pointerEvents === 'none') {
    return { blockedBy: 'self', blockReason: 'pointer-events: none på elementet', overlaysAbove: 0 };
  }

  // Check ancestors for pointer-events: none
  let parent = el.parentElement;
  while (parent && parent !== document.body) {
    const ps = getComputedStyle(parent);
    if (ps.pointerEvents === 'none') {
      return {
        blockedBy: describeEl(parent),
        blockReason: `Förälder har pointer-events: none`,
        overlaysAbove: 0,
      };
    }
    parent = parent.parentElement;
  }

  // Count fixed/absolute overlays above this element
  const allFixed = document.querySelectorAll('[style*="position: fixed"], [style*="position: absolute"]');
  allFixed.forEach(overlay => {
    const oel = overlay as HTMLElement;
    const oRect = oel.getBoundingClientRect();
    const oStyle = getComputedStyle(oel);
    const oZ = parseInt(oStyle.zIndex) || 0;
    if (
      oRect.left < cx && oRect.right > cx &&
      oRect.top < cy && oRect.bottom > cy &&
      oZ > (parseInt(style.zIndex) || 0) &&
      oel !== el && !el.contains(oel)
    ) {
      overlaysAbove++;
    }
  });

  return { blockedBy: null, blockReason: null, overlaysAbove };
}

// Highlight style injected as a data attribute
const HIGHLIGHT_ATTR = 'data-debug-highlight';
const STYLE_ID = 'interaction-debug-style';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    [${HIGHLIGHT_ATTR}="overlay"] {
      outline: 3px dashed rgba(239, 68, 68, 0.8) !important;
      outline-offset: -2px;
      box-shadow: inset 0 0 0 9999px rgba(239, 68, 68, 0.08) !important;
    }
    [${HIGHLIGHT_ATTR}="blocked"] {
      outline: 3px dashed rgba(249, 115, 22, 0.8) !important;
      outline-offset: -2px;
      box-shadow: inset 0 0 0 9999px rgba(249, 115, 22, 0.08) !important;
    }
    [${HIGHLIGHT_ATTR}="clicked"] {
      outline: 3px solid rgba(34, 197, 94, 0.9) !important;
      outline-offset: -1px;
    }
    .interaction-debug-tooltip {
      position: fixed;
      z-index: 99999;
      pointer-events: none;
      background: hsl(var(--popover));
      color: hsl(var(--popover-foreground));
      border: 1px solid hsl(var(--border));
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 11px;
      max-width: 320px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
  `;
  document.head.appendChild(style);
}

function removeStyles() {
  document.getElementById(STYLE_ID)?.remove();
  document.querySelectorAll(`[${HIGHLIGHT_ATTR}]`).forEach(el => {
    el.removeAttribute(HIGHLIGHT_ATTR);
  });
}

function highlightOverlays() {
  // Find all fixed/absolute positioned elements that could block interaction
  const candidates = document.querySelectorAll('*');
  let count = 0;
  candidates.forEach(el => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetWidth < 10 || htmlEl.offsetHeight < 10) return;
    const style = getComputedStyle(htmlEl);
    if (style.display === 'none' || style.visibility === 'hidden') return;

    const isOverlay = (
      (style.position === 'fixed' || style.position === 'absolute') &&
      parseInt(style.zIndex) >= 40 &&
      htmlEl.offsetWidth > window.innerWidth * 0.5 &&
      htmlEl.offsetHeight > window.innerHeight * 0.3
    );

    if (isOverlay) {
      htmlEl.setAttribute(HIGHLIGHT_ATTR, 'overlay');
      count++;
    }

    // Detect pointer-events blocking
    if (style.pointerEvents === 'none' && htmlEl.offsetWidth > 50 && htmlEl.children.length > 0) {
      htmlEl.setAttribute(HIGHLIGHT_ATTR, 'blocked');
      count++;
    }
  });
  return count;
}

const InteractionDebugMode = () => {
  const [active, setActive] = useState(false);
  const [logs, setLogs] = useState<ClickLog[]>([]);
  const [overlayCount, setOverlayCount] = useState(0);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const handleClick = useCallback((e: MouseEvent) => {
    const el = e.target as HTMLElement;
    if (!el) return;

    // Don't log clicks on the debug panel itself
    if (el.closest('[data-debug-panel]')) return;

    const { blockedBy, blockReason, overlaysAbove } = getBlockingInfo(el);
    const style = getComputedStyle(el);

    // Build ancestor path (up to 5 levels)
    const path: string[] = [];
    let node: HTMLElement | null = el;
    let depth = 0;
    while (node && depth < 5) {
      path.push(describeEl(node).slice(0, 50));
      node = node.parentElement;
      depth++;
    }

    const log: ClickLog = {
      id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      timestamp: new Date().toISOString(),
      clickedEl: describeEl(el),
      clickedTag: el.tagName.toLowerCase(),
      blockedBy,
      blockReason,
      pointerEvents: style.pointerEvents,
      zIndex: style.zIndex || 'auto',
      overlaysAbove,
      path,
    };

    setLogs(prev => [log, ...prev].slice(0, 50));

    // Flash highlight on clicked element
    el.setAttribute(HIGHLIGHT_ATTR, 'clicked');
    setTimeout(() => el.removeAttribute(HIGHLIGHT_ATTR), 1500);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!tooltipRef.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (!el || el.closest('[data-debug-panel]')) {
      tooltipRef.current.style.display = 'none';
      return;
    }

    const style = getComputedStyle(el);
    const pe = style.pointerEvents;
    const z = style.zIndex || 'auto';
    const pos = style.position;

    tooltipRef.current.innerHTML = `
      <div style="font-weight:600;margin-bottom:2px">${describeEl(el).slice(0, 50)}</div>
      <div>z-index: <b>${z}</b> · position: <b>${pos}</b> · pointer-events: <b>${pe}</b></div>
    `;
    tooltipRef.current.style.display = 'block';
    tooltipRef.current.style.left = `${Math.min(e.clientX + 12, window.innerWidth - 340)}px`;
    tooltipRef.current.style.top = `${Math.min(e.clientY + 12, window.innerHeight - 60)}px`;
  }, []);

  useEffect(() => {
    if (active) {
      injectStyles();
      const count = highlightOverlays();
      setOverlayCount(count);
      document.addEventListener('click', handleClick, true);
      document.addEventListener('mousemove', handleMouseMove, true);

      // Create tooltip element
      const tooltip = document.createElement('div');
      tooltip.className = 'interaction-debug-tooltip';
      tooltip.style.display = 'none';
      document.body.appendChild(tooltip);
      tooltipRef.current = tooltip;
    } else {
      removeStyles();
      setOverlayCount(0);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('mousemove', handleMouseMove, true);
      if (tooltipRef.current) {
        tooltipRef.current.remove();
        tooltipRef.current = null;
      }
    }

    return () => {
      removeStyles();
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('mousemove', handleMouseMove, true);
      if (tooltipRef.current) {
        tooltipRef.current.remove();
        tooltipRef.current = null;
      }
    };
  }, [active, handleClick, handleMouseMove]);

  const blockedLogs = logs.filter(l => l.blockedBy);

  return (
    <div data-debug-panel className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant={active ? 'destructive' : 'outline'}
          onClick={() => setActive(!active)}
          className="gap-1.5 text-xs"
        >
          {active ? <X className="w-3.5 h-3.5" /> : <Crosshair className="w-3.5 h-3.5" />}
          {active ? 'Stäng Debug Mode' : 'Interaction Debug'}
        </Button>
        {active && overlayCount > 0 && (
          <Badge variant="destructive" className="text-[10px]">
            {overlayCount} overlay(s) markerade
          </Badge>
        )}
        {active && logs.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setLogs([])} className="gap-1 text-xs h-7">
            <Trash2 className="w-3 h-3" /> Rensa
          </Button>
        )}
      </div>

      {active && logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Klicklogg ({logs.length})
              {blockedLogs.length > 0 && (
                <Badge variant="destructive" className="text-[10px] ml-1">
                  {blockedLogs.length} blockerade
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[40vh]">
              <div className="space-y-1.5 pr-2">
                {logs.map(log => (
                  <div
                    key={log.id}
                    className={cn(
                      'border rounded p-2 text-xs space-y-0.5',
                      log.blockedBy
                        ? 'border-destructive/30 bg-destructive/5'
                        : 'border-border bg-muted/30'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{log.clickedEl.slice(0, 50)}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString('sv-SE')}
                      </span>
                    </div>
                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                      <span>z: {log.zIndex}</span>
                      <span>pe: {log.pointerEvents}</span>
                      {log.overlaysAbove > 0 && (
                        <span className="text-destructive">{log.overlaysAbove} overlay(s)</span>
                      )}
                    </div>
                    {log.blockedBy && (
                      <div className="text-[10px] text-destructive font-medium mt-0.5">
                        ⛔ Blockerad av: {log.blockedBy.slice(0, 60)}
                        {log.blockReason && <span className="font-normal text-muted-foreground ml-1">— {log.blockReason}</span>}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground/60 font-mono truncate">
                      {log.path.slice(0, 3).join(' → ')}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {active && logs.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Klicka var som helst för att logga interaktion. Overlays markeras med röd streckad ram.
        </p>
      )}
    </div>
  );
};

export default InteractionDebugMode;
