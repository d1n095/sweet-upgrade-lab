import { useState, useCallback } from 'react';
import InteractionDebugMode from './InteractionDebugMode';
import ResponsiveLayoutDetector from './ResponsiveLayoutDetector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { usePipelineStore } from '@/stores/pipelineStore';
import {
  Activity, AlertTriangle, CheckCircle, XCircle, Loader2,
  Play, Trash2, MousePointer, Database, Layers, ScrollText,
  ChevronDown, ChevronUp, Eye, Ghost, Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type CheckVerdict = 'working' | 'fake_done' | 'partially_working' | 'broken' | 'auto_fixed';
type CheckCategory = 'buttons' | 'data' | 'modals' | 'scroll' | 'forms' | 'navigation' | 'layout';
type LayoutFixType = 'no_scroll' | 'content_cut' | 'overflow_hidden_horiz' | 'modal_overflow' | 'modal_blocked_scroll' | 'layout_conflict' | 'overlay_block' | 'overflow_chain' | null;

interface UICheck {
  id: string;
  category: CheckCategory;
  element: string;
  selector: string;
  verdict: CheckVerdict;
  detail: string;
  checkedAt: string;
  fixType?: LayoutFixType;
  fixTarget?: HTMLElement;
}

type ScanStatus = 'idle' | 'running' | 'done';

const verdictConfig: Record<CheckVerdict, { label: string; color: string; icon: React.ElementType }> = {
  working: { label: 'Fungerar', color: 'text-green-500', icon: CheckCircle },
  auto_fixed: { label: 'Auto-fixad', color: 'text-blue-500', icon: Wrench },
  fake_done: { label: 'Fejkad', color: 'text-purple-500', icon: Ghost },
  partially_working: { label: 'Delvis', color: 'text-orange-500', icon: AlertTriangle },
  broken: { label: 'Trasig', color: 'text-destructive', icon: XCircle },
};

const categoryConfig: Record<CheckCategory, { label: string; icon: React.ElementType }> = {
  buttons: { label: 'Knappar', icon: MousePointer },
  data: { label: 'Data', icon: Database },
  modals: { label: 'Modaler', icon: Layers },
  scroll: { label: 'Scroll', icon: ScrollText },
  forms: { label: 'Formulär', icon: Activity },
  navigation: { label: 'Navigation', icon: Eye },
  layout: { label: 'Layout', icon: Layers },
};

const CheckCard = ({ check, onFix }: { check: UICheck; onFix?: (check: UICheck) => void }) => {
  const [expanded, setExpanded] = useState(false);
  const v = verdictConfig[check.verdict];
  const c = categoryConfig[check.category];
  const VIcon = v.icon;
  const canFix = check.fixType && check.fixTarget && check.verdict !== 'auto_fixed' && check.verdict !== 'working';

  return (
    <div className={cn(
      'border rounded-lg p-3 space-y-1',
      check.verdict === 'working' ? 'border-green-500/20 bg-green-500/5' :
      check.verdict === 'auto_fixed' ? 'border-blue-500/20 bg-blue-500/5' :
      check.verdict === 'fake_done' ? 'border-purple-500/30 bg-purple-500/5' :
      check.verdict === 'partially_working' ? 'border-orange-500/30 bg-orange-500/5' :
      'border-destructive/30 bg-destructive/5'
    )}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <VIcon className={cn('w-4 h-4 shrink-0', v.color)} />
            <span className="text-sm font-medium truncate">{check.element}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {canFix && (
              <Button
                size="sm"
                variant="outline"
                className="h-5 px-1.5 text-[10px] gap-0.5"
                onClick={(e) => { e.stopPropagation(); onFix?.(check); }}
              >
                <Wrench className="w-2.5 h-2.5" />Fixa
              </Button>
            )}
            <Badge variant="outline" className="text-[10px]">
              <c.icon className="w-2.5 h-2.5 mr-0.5" />{c.label}
            </Badge>
            <Badge variant="outline" className={cn('text-[10px]', v.color)}>
              {v.label}
            </Badge>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="pt-2 border-t border-border/50 mt-1 space-y-1">
          <p className="text-xs text-foreground">{check.detail}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{check.selector}</p>
          <p className="text-[10px] text-muted-foreground/60">{new Date(check.checkedAt).toLocaleString('sv-SE')}</p>
        </div>
      )}
    </div>
  );
};

const UiRealityCheck = () => {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [checks, setChecks] = useState<UICheck[]>([]);
  const [progress, setProgress] = useState(0);
  const { pushToPipeline } = usePipelineStore();

  const makeCheck = (
    category: CheckCategory,
    element: string,
    selector: string,
    verdict: CheckVerdict,
    detail: string
  ): UICheck => ({
    id: `${category}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category, element, selector, verdict, detail,
    checkedAt: new Date().toISOString(),
  });

  const runScan = useCallback(async () => {
    setStatus('running');
    setChecks([]);
    setProgress(0);
    const results: UICheck[] = [];

    await new Promise(r => setTimeout(r, 100));

    // ─── 1. BUTTONS ───
    setProgress(10);
    const buttons = document.querySelectorAll('button, [role="button"], a[href]');
    let deadButtons = 0;
    let totalButtons = 0;

    buttons.forEach((btn) => {
      const el = btn as HTMLElement;
      // Skip tiny/invisible/icon-only buttons
      if (el.offsetWidth < 5 || el.offsetHeight < 5) return;
      if (getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden') return;
      totalButtons++;

      const hasClick = !!(el as any)._reactEvents || !!(el as any).__reactEvents$ || !!(el as any).__reactProps$;
      const hasHref = el.tagName === 'A' && el.getAttribute('href');
      const isDisabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
      const hasOnClick = el.getAttribute('onclick') !== null;

      // Check React internal event handlers
      const reactPropsKey = Object.keys(el).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEvents$'));
      const reactProps = reactPropsKey ? (el as any)[reactPropsKey] : null;
      const hasReactClick = reactProps?.onClick || reactProps?.onPointerDown || reactProps?.onMouseDown;

      if (!hasClick && !hasHref && !hasOnClick && !hasReactClick && !isDisabled) {
        const text = el.textContent?.trim().slice(0, 40) || el.getAttribute('aria-label') || 'Unnamed';
        if (text.length > 1) {
          deadButtons++;
          results.push(makeCheck(
            'buttons', `Knapp: "${text}"`,
            buildSelector(el),
            'fake_done',
            'Knappen har ingen click-handler registrerad — den gör ingenting vid klick.'
          ));
        }
      }
    });

    if (deadButtons === 0 && totalButtons > 0) {
      results.push(makeCheck('buttons', 'Alla knappar', `${totalButtons} knappar`, 'working', `${totalButtons} knappar har registrerade handlers.`));
    }

    // ─── 2. DATA LOADING ───
    setProgress(30);
    const dataContainers = document.querySelectorAll('[data-loading], [data-empty], .animate-pulse, [class*="skeleton"]');
    let skeletonCount = 0;

    dataContainers.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.offsetWidth < 5) return;
      if (getComputedStyle(htmlEl).display === 'none') return;

      const isVisible = htmlEl.getBoundingClientRect().top < window.innerHeight + 200;
      if (!isVisible) return;

      // Check if skeleton is "stuck" (visible > timeout)
      if (htmlEl.classList.contains('animate-pulse') || htmlEl.className.includes('skeleton')) {
        skeletonCount++;
      }
    });

    if (skeletonCount > 3) {
      results.push(makeCheck(
        'data', `${skeletonCount} skeleton-laddare`,
        '.animate-pulse, [class*="skeleton"]',
        'partially_working',
        `${skeletonCount} skeleton/laddnings-element synliga. Data kan ha fastnat i laddningsläge.`
      ));
    } else if (skeletonCount > 0) {
      results.push(makeCheck('data', `${skeletonCount} skeleton-element`, '.animate-pulse', 'working', 'Normalt antal laddningsindikatorer.'));
    }

    // Check for "empty state" patterns that might indicate missing data
    const emptyIndicators = document.querySelectorAll('[data-empty], .empty-state');
    const emptyTexts = ['inga resultat', 'no data', 'tom', 'empty', 'ingenting att visa', 'nothing to show'];
    let emptyStateCount = 0;

    document.querySelectorAll('p, span, div').forEach((el) => {
      const text = (el as HTMLElement).textContent?.toLowerCase().trim() || '';
      if (text.length < 50 && emptyTexts.some(et => text.includes(et))) {
        const parent = el.parentElement;
        if (parent && parent.children.length <= 3) {
          emptyStateCount++;
        }
      }
    });

    if (emptyStateCount > 2) {
      results.push(makeCheck(
        'data', `${emptyStateCount} tomma sektioner`,
        'text-match',
        'partially_working',
        'Flera sektioner visar "tom"-meddelanden. Data kanske inte laddas korrekt.'
      ));
    }

    // ─── 3. MODALS / DIALOGS ───
    setProgress(50);
    const dialogTriggers = document.querySelectorAll('[data-state], [aria-haspopup="dialog"], [aria-haspopup="true"]');
    let modalTriggersFound = 0;

    dialogTriggers.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.offsetWidth < 5) return;
      modalTriggersFound++;
    });

    // Check for orphan overlay/backdrop elements stuck open
    const openOverlays = document.querySelectorAll('[data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"]');
    if (openOverlays.length > 0) {
      results.push(makeCheck(
        'modals', `${openOverlays.length} öppna dialoger`,
        '[data-state="open"][role="dialog"]',
        'partially_working',
        'Dialoger som är öppna utan tydlig användarinteraktion kan indikera fastkört tillstånd.'
      ));
    }

    // Check for backdrop/overlay elements that might block interaction
    const backdrops = document.querySelectorAll('[data-state="open"][data-overlay], [class*="overlay"][style*="pointer-events"]');
    if (backdrops.length > 0) {
      results.push(makeCheck(
        'modals', 'Blockerade overlays',
        '[data-state="open"]',
        'broken',
        'Overlay-element blockerar möjligen interaktion med sidan.'
      ));
    }

    if (modalTriggersFound > 0 && openOverlays.length === 0 && backdrops.length === 0) {
      results.push(makeCheck('modals', `${modalTriggersFound} dialog-triggers`, '[aria-haspopup]', 'working', 'Dialog-triggers registrerade utan fastkörda tillstånd.'));
    }

    // ─── 4. SCROLL ───
    setProgress(65);
    const scrollContainers = document.querySelectorAll('[data-radix-scroll-area-viewport], [class*="overflow-y-auto"], [class*="overflow-auto"], [style*="overflow"]');
    let brokenScrollCount = 0;

    scrollContainers.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.offsetWidth < 20 || htmlEl.offsetHeight < 20) return;
      const isScrollable = htmlEl.scrollHeight > htmlEl.clientHeight + 5;
      const hasOverflowHidden = getComputedStyle(htmlEl).overflow === 'hidden' || getComputedStyle(htmlEl).overflowY === 'hidden';

      if (isScrollable && hasOverflowHidden) {
        brokenScrollCount++;
        results.push(makeCheck(
          'scroll', 'Dold scroll',
          buildSelector(htmlEl),
          'broken',
          `Elementet har mer innehåll (${htmlEl.scrollHeight}px) än sin höjd (${htmlEl.clientHeight}px) men overflow:hidden döljer det.`
        ));
      }

      // Content clipping: scrollable container where last child is cut off
      if (isScrollable && !hasOverflowHidden) {
        const lastChild = htmlEl.lastElementChild as HTMLElement;
        if (lastChild) {
          const containerRect = htmlEl.getBoundingClientRect();
          const childRect = lastChild.getBoundingClientRect();
          const isCutOff = childRect.bottom > containerRect.bottom + 100 && htmlEl.scrollTop === 0;
          // Only flag if a LOT is hidden and not scrolled
          if (isCutOff && (childRect.bottom - containerRect.bottom) > containerRect.height) {
            // This is normal for long lists, skip
          }
        }
      }
    });

    if (brokenScrollCount === 0 && scrollContainers.length > 0) {
      results.push(makeCheck('scroll', `${scrollContainers.length} scrollbara containrar`, 'overflow-auto', 'working', 'Alla scrollbara containrar fungerar korrekt.'));
    }

    // ─── 5. FORMS ───
    setProgress(80);
    const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
    let disabledInputCount = 0;
    let readonlyCount = 0;

    inputs.forEach((el) => {
      const htmlEl = el as HTMLInputElement;
      if (htmlEl.offsetWidth < 5) return;
      if (htmlEl.disabled) disabledInputCount++;
      if (htmlEl.readOnly) readonlyCount++;
    });

    if (inputs.length > 0) {
      const totalVisible = Array.from(inputs).filter(el => (el as HTMLElement).offsetWidth > 5).length;
      if (disabledInputCount > totalVisible * 0.5 && totalVisible > 3) {
        results.push(makeCheck(
          'forms', `${disabledInputCount}/${totalVisible} inaktiva fält`,
          'input:disabled',
          'partially_working',
          'Mer än hälften av synliga formulärfält är inaktiverade. Formuläret kan vara delvis icke-funktionellt.'
        ));
      } else {
        results.push(makeCheck('forms', `${totalVisible} formulärfält`, 'input, textarea, select', 'working', `${totalVisible} fält aktiva, ${disabledInputCount} inaktiverade.`));
      }
    }

    // ─── 6. NAVIGATION / LINKS ───
    setProgress(90);
    const links = document.querySelectorAll('a[href]');
    let deadLinks = 0;

    links.forEach((el) => {
      const href = el.getAttribute('href');
      const htmlEl = el as HTMLElement;
      if (htmlEl.offsetWidth < 5) return;
      if (!href || href === '#' || href === 'javascript:void(0)' || href === 'javascript:;') {
        const text = htmlEl.textContent?.trim().slice(0, 30) || '';
        if (text.length > 1) {
          deadLinks++;
        }
      }
    });

    if (deadLinks > 0) {
      results.push(makeCheck(
        'navigation', `${deadLinks} döda länkar`,
        'a[href="#"]',
        'fake_done',
        `${deadLinks} länkar pekar på "#" eller void — de navigerar ingenstans.`
      ));
    }

    const allLinks = Array.from(links).filter(el => (el as HTMLElement).offsetWidth > 5);
    if (deadLinks === 0 && allLinks.length > 0) {
      results.push(makeCheck('navigation', `${allLinks.length} länkar`, 'a[href]', 'working', 'Alla synliga länkar har giltiga destinationer.'));
    }

    // ─── 7. LAYOUT BUG DETECTION ───
    setProgress(95);

    // 7a. Content overflow / no-scroll detection
    const allContainers = document.querySelectorAll('div, section, main, aside, article, [role="tabpanel"]');
    allContainers.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.offsetWidth < 30 || htmlEl.offsetHeight < 30) return;
      const style = getComputedStyle(htmlEl);
      if (style.display === 'none' || style.visibility === 'hidden') return;

      const overflowY = style.overflowY;
      const overflowX = style.overflowX;
      const contentH = htmlEl.scrollHeight;
      const containerH = htmlEl.clientHeight;
      const contentW = htmlEl.scrollWidth;
      const containerW = htmlEl.clientWidth;
      const overflow = contentH - containerH;
      const overflowHoriz = contentW - containerW;

      // no_scroll: content overflows vertically but overflow is hidden and not scrollable
      if (overflow > 20 && overflowY === 'hidden' && containerH > 50 && containerH < 2000) {
        // Skip if parent is a known scroll container
        const parentScrollable = htmlEl.closest('[data-radix-scroll-area-viewport], [class*="overflow-y-auto"], [class*="overflow-auto"]');
        if (!parentScrollable) {
          const check = makeCheck(
            'layout',
            `no_scroll: ${buildSelector(htmlEl).slice(0, 50)}`,
            buildSelector(htmlEl),
            'broken',
            `Innehåll (${contentH}px) överstiger container (${containerH}px) med ${overflow}px men overflow-y:hidden blockerar scroll. Fix: ändra till overflow-y:auto och lägg till min-height:0 på flex-förälder.`
          );
          check.fixType = 'no_scroll';
          check.fixTarget = htmlEl;
          results.push(check);
        }
      }

      // content_cut: fixed height with overflow hidden and significant content clipped
      const hasFixedH = style.height !== 'auto' && !style.height.includes('%') && style.maxHeight !== 'none';
      if (hasFixedH && overflow > 50 && (overflowY === 'hidden' || overflowY === 'visible') && containerH > 40) {
        const isInsideScrollArea = !!htmlEl.closest('[data-radix-scroll-area-viewport]');
        if (!isInsideScrollArea) {
          const check = makeCheck(
            'layout',
            `content_cut: ${buildSelector(htmlEl).slice(0, 50)}`,
            buildSelector(htmlEl),
            'broken',
            `Container har fast höjd (${containerH}px) men innehållet är ${contentH}px — ${overflow}px klipps bort. Fix: ta bort fixed height eller lägg till overflow-y:auto.`
          );
          check.fixType = 'content_cut';
          check.fixTarget = htmlEl;
          results.push(check);
        }
      }

      // overflow_hidden_issue: horizontal content clipped
      if (overflowHoriz > 30 && overflowX === 'hidden' && containerW > 50) {
        const isTable = !!htmlEl.closest('table') || htmlEl.querySelector('table');
        if (!isTable) {
          const check = makeCheck(
            'layout',
            `overflow_hidden_issue (horiz): ${buildSelector(htmlEl).slice(0, 50)}`,
            buildSelector(htmlEl),
            'partially_working',
            `Horisontellt innehåll (${contentW}px) klipps i container (${containerW}px). ${overflowHoriz}px dolt. Fix: overflow-x:auto eller bredda containern.`
          );
          check.fixType = 'overflow_hidden_horiz';
          check.fixTarget = htmlEl;
          results.push(check);
        }
      }
    });

    // 7b. modal_overflow_bug: open dialogs/sheets with clipped content
    const openModals = document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
    openModals.forEach((modal) => {
      const htmlModal = modal as HTMLElement;
      const innerScrollable = htmlModal.querySelector('[data-radix-scroll-area-viewport], [class*="overflow-y-auto"], [class*="overflow-auto"]');

      if (!innerScrollable) {
        const mContentH = htmlModal.scrollHeight;
        const mContainerH = htmlModal.clientHeight;
        if (mContentH > mContainerH + 30) {
          const check = makeCheck(
            'layout',
            `modal_overflow_bug: ${buildSelector(htmlModal).slice(0, 50)}`,
            buildSelector(htmlModal),
            'broken',
            `Öppen modal har ${mContentH}px innehåll i ${mContainerH}px container utan scroll-wrapper. Fix: wrappa innehållet i ScrollArea eller lägg till overflow-y:auto med flex-1 min-h-0.`
          );
          check.fixType = 'modal_overflow';
          check.fixTarget = htmlModal;
          results.push(check);
        }
      } else {
        const scrollEl = innerScrollable as HTMLElement;
        if (scrollEl.scrollHeight > scrollEl.clientHeight + 20 && getComputedStyle(scrollEl).overflowY === 'hidden') {
          const check = makeCheck(
            'layout',
            `modal_overflow_bug (blocked scroll): ${buildSelector(htmlModal).slice(0, 50)}`,
            buildSelector(htmlModal),
            'broken',
            `Modal har ScrollArea men overflow-y:hidden blockerar scroll. Fix: kontrollera flex-chain — säkerställ min-height:0 på alla flex-föräldrar.`
          );
          check.fixType = 'modal_blocked_scroll';
          check.fixTarget = htmlModal;
          results.push(check);
        }
      }
    });

    // ─── 8. LAYOUT HIERARCHY VALIDATION ───

    // 8a. layout_conflict: flex containers where children have conflicting sizing
    const flexContainers = document.querySelectorAll('div, section, main, aside');
    flexContainers.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const style = getComputedStyle(htmlEl);
      if (style.display !== 'flex' && style.display !== 'inline-flex') return;
      if (htmlEl.offsetWidth < 30 || htmlEl.offsetHeight < 30) return;
      if (style.visibility === 'hidden') return;

      const children = Array.from(htmlEl.children) as HTMLElement[];
      if (children.length < 2) return;

      const isColumn = style.flexDirection === 'column' || style.flexDirection === 'column-reverse';
      const containerSize = isColumn ? htmlEl.clientHeight : htmlEl.clientWidth;

      // Check: children total size exceeds container without scroll or wrap
      let totalChildSize = 0;
      children.forEach(child => {
        if (getComputedStyle(child).position === 'absolute' || getComputedStyle(child).position === 'fixed') return;
        totalChildSize += isColumn ? child.offsetHeight : child.offsetWidth;
      });

      const overflow = totalChildSize - containerSize;
      if (overflow > 30 && style.flexWrap === 'nowrap' && style.overflow !== 'auto' && style.overflow !== 'scroll') {
        const overflowProp = isColumn ? style.overflowY : style.overflowX;
        if (overflowProp === 'hidden' || overflowProp === 'visible') {
          // Check if this is a flex-1 container missing min-height:0 / min-width:0
          const needsMinH0 = isColumn && style.minHeight !== '0px' && style.minHeight !== '0' && style.flex.includes('1');
          const needsMinW0 = !isColumn && style.minWidth !== '0px' && style.minWidth !== '0' && style.flex.includes('1');

          const check = makeCheck(
            'layout',
            `layout_conflict: ${buildSelector(htmlEl).slice(0, 50)}`,
            buildSelector(htmlEl),
            'broken',
            `Flex-container (${isColumn ? 'column' : 'row'}) har barn (${totalChildSize}px totalt) som överstiger containerns ${containerSize}px med ${overflow}px. flex-wrap:nowrap och ingen scroll. Fix: ${needsMinH0 || needsMinW0 ? 'lägg till min-height:0 (eller min-width:0) på flex-föräldern' : 'lägg till overflow-y:auto eller flex-wrap:wrap'}.`
          );
          check.fixType = 'layout_conflict';
          check.fixTarget = htmlEl;
          results.push(check);
        }
      }
    });

    // 8b. overlay_block: fixed/absolute elements with high z-index blocking clicks
    const allElements = document.querySelectorAll('*');
    const highZElements: { el: HTMLElement; z: number; rect: DOMRect }[] = [];

    allElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const style = getComputedStyle(htmlEl);
      if (style.position !== 'fixed' && style.position !== 'absolute' && style.position !== 'sticky') return;
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
      if (htmlEl.offsetWidth < 10 || htmlEl.offsetHeight < 10) return;

      const z = parseInt(style.zIndex, 10);
      if (isNaN(z) || z < 10) return;

      // Skip known safe elements (modals with data-state="closed", tooltips, etc.)
      const isClosed = htmlEl.closest('[data-state="closed"]');
      if (isClosed) return;
      const isRadixOverlay = htmlEl.hasAttribute('data-radix-popper-content-wrapper');
      if (isRadixOverlay) return;

      highZElements.push({ el: htmlEl, z, rect: htmlEl.getBoundingClientRect() });
    });

    // Check if any high-z element covers interactive elements beneath it
    const interactiveBelow = document.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select, textarea, [role="button"]');

    highZElements.forEach(({ el: overlay, z, rect: overlayRect }) => {
      // Skip if the overlay is a Sheet/Dialog (expected behavior)
      if (overlay.closest('[role="dialog"]') || overlay.closest('[role="alertdialog"]') || overlay.closest('[role="sheet"]')) return;
      // Skip tiny overlays (badges, tooltips)
      if (overlayRect.width < 100 && overlayRect.height < 100) return;

      let blockedCount = 0;
      interactiveBelow.forEach((btn) => {
        const btnEl = btn as HTMLElement;
        if (overlay.contains(btnEl)) return; // skip children of overlay itself
        const btnRect = btnEl.getBoundingClientRect();
        if (btnEl.offsetWidth < 5) return;

        // Check overlap
        const overlapX = Math.max(0, Math.min(overlayRect.right, btnRect.right) - Math.max(overlayRect.left, btnRect.left));
        const overlapY = Math.max(0, Math.min(overlayRect.bottom, btnRect.bottom) - Math.max(overlayRect.top, btnRect.top));
        if (overlapX > 5 && overlapY > 5) {
          // Verify the overlay is actually on top via elementFromPoint
          const centerX = btnRect.left + btnRect.width / 2;
          const centerY = btnRect.top + btnRect.height / 2;
          const topEl = document.elementFromPoint(centerX, centerY);
          if (topEl && !btnEl.contains(topEl) && (overlay.contains(topEl) || topEl === overlay)) {
            blockedCount++;
          }
        }
      });

      if (blockedCount > 0) {
        const check = makeCheck(
          'layout',
          `overlay_block: ${buildSelector(overlay).slice(0, 50)}`,
          buildSelector(overlay),
          'broken',
          `Element (z-index:${z}, ${Math.round(overlayRect.width)}×${Math.round(overlayRect.height)}px) blockerar ${blockedCount} interaktiva element bakom sig. Fix: ta bort overlay, sänk z-index, lägg till pointer-events:none, eller flytta till layout-flow.`
        );
        check.fixType = 'overlay_block';
        check.fixTarget = overlay;
        results.push(check);
      }
    });

    // 8c. overflow_chain_error: broken flex→scroll chain (missing min-height:0)
    const scrollables = document.querySelectorAll('[class*="overflow-y-auto"], [class*="overflow-auto"], [style*="overflow-y: auto"], [style*="overflow: auto"]');
    scrollables.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.offsetWidth < 20 || htmlEl.offsetHeight < 20) return;
      const style = getComputedStyle(htmlEl);
      if (style.display === 'none') return;

      // Walk up flex chain looking for broken min-height
      let parent = htmlEl.parentElement;
      let depth = 0;
      const chainBreaks: string[] = [];

      while (parent && depth < 8) {
        const ps = getComputedStyle(parent);
        const isFlex = ps.display === 'flex' || ps.display === 'inline-flex';
        const isFlexCol = isFlex && (ps.flexDirection === 'column' || ps.flexDirection === 'column-reverse');

        if (isFlexCol) {
          const hasMinH0 = ps.minHeight === '0px' || ps.minHeight === '0';
          const hasFlex1 = ps.flexGrow === '1' || ps.flex.startsWith('1');

          if (hasFlex1 && !hasMinH0 && parent.scrollHeight > parent.clientHeight + 20) {
            chainBreaks.push(buildSelector(parent).slice(0, 40));
          }
        }

        // Stop if we hit a scroll container or fixed-position element
        if (ps.overflow === 'auto' || ps.overflow === 'scroll' || ps.overflowY === 'auto' || ps.overflowY === 'scroll') break;
        if (ps.position === 'fixed' || ps.position === 'absolute') break;

        parent = parent.parentElement;
        depth++;
      }

      if (chainBreaks.length > 0) {
        const check = makeCheck(
          'layout',
          `overflow_chain_error: ${buildSelector(htmlEl).slice(0, 40)}`,
          buildSelector(htmlEl),
          'broken',
          `Scroll-container har trasig flex-kedja. ${chainBreaks.length} förälder(ar) saknar min-height:0: [${chainBreaks.join(' → ')}]. Fix: lägg till min-h-0 (min-height:0) på varje flex-1 förälder i kedjan.`
        );
        check.fixType = 'overflow_chain';
        check.fixTarget = htmlEl;
        results.push(check);
      }
    });

    setProgress(100);

    // Sort: issues first
    const order: Record<CheckVerdict, number> = { broken: 0, fake_done: 1, partially_working: 2, auto_fixed: 3, working: 4 };
    results.sort((a, b) => order[a.verdict] - order[b.verdict]);

    setChecks(results);
    setStatus('done');

    const issues = results.filter(c => c.verdict !== 'working');
    if (issues.length > 0) {
      toast.warning(`UI Reality Check: ${issues.length} problem hittade`);
      pushToPipeline(issues.map(c => ({
        file: c.selector || c.element || 'ui',
        message: `[${c.category}] ${c.detail}`,
        severity: c.verdict === 'broken' ? 'high' : 'medium',
      })));
    } else {
      toast.success('UI Reality Check: Allt fungerar!');
    }
  }, []);

  const applyFix = useCallback((check: UICheck) => {
    const el = check.fixTarget;
    if (!el || !check.fixType) return false;

    try {
      switch (check.fixType) {
        case 'no_scroll': {
          el.style.overflowY = 'auto';
          // Fix flex parent chain
          let parent = el.parentElement;
          let depth = 0;
          while (parent && depth < 5) {
            const ps = getComputedStyle(parent);
            if (ps.display === 'flex' || ps.display === 'inline-flex') {
              if (ps.minHeight !== '0px' && ps.minHeight !== '0') {
                parent.style.minHeight = '0';
              }
            }
            parent = parent.parentElement;
            depth++;
          }
          return true;
        }
        case 'content_cut': {
          el.style.overflowY = 'auto';
          // If parent is flex, ensure min-height:0
          const flexParent = el.parentElement;
          if (flexParent) {
            const fps = getComputedStyle(flexParent);
            if (fps.display === 'flex' || fps.display === 'inline-flex') {
              el.style.minHeight = '0';
            }
          }
          return true;
        }
        case 'overflow_hidden_horiz': {
          el.style.overflowX = 'auto';
          return true;
        }
        case 'modal_overflow': {
          el.style.display = 'flex';
          el.style.flexDirection = 'column';
          el.style.minHeight = '0';
          // Find the main content child (skip close buttons etc)
          const children = Array.from(el.children) as HTMLElement[];
          const contentChild = children.find(c => c.scrollHeight > 100) || children[children.length - 1];
          if (contentChild) {
            contentChild.style.overflowY = 'auto';
            contentChild.style.flex = '1';
            contentChild.style.minHeight = '0';
          }
          return true;
        }
        case 'modal_blocked_scroll': {
          const scrollViewport = el.querySelector('[data-radix-scroll-area-viewport], [class*="overflow-y-auto"], [class*="overflow-auto"]') as HTMLElement;
          if (scrollViewport) {
            scrollViewport.style.overflowY = 'auto';
          }
          // Fix flex chain inside modal
          let node = scrollViewport?.parentElement || el;
          let d = 0;
          while (node && node !== el && d < 5) {
            const ns = getComputedStyle(node);
            if (ns.display === 'flex' || ns.display === 'inline-flex') {
              node.style.minHeight = '0';
            }
            node = node.parentElement!;
            d++;
          }
          return true;
        }
        case 'layout_conflict': {
          // Add min-height:0 and overflow-y:auto
          const s = getComputedStyle(el);
          const isCol = s.flexDirection === 'column' || s.flexDirection === 'column-reverse';
          if (isCol) {
            el.style.minHeight = '0';
            el.style.overflowY = 'auto';
          } else {
            el.style.minWidth = '0';
            el.style.overflowX = 'auto';
          }
          return true;
        }
        case 'overlay_block': {
          el.style.pointerEvents = 'none';
          return true;
        }
        case 'overflow_chain': {
          // Walk up flex chain and fix min-height:0
          let p = el.parentElement;
          let d2 = 0;
          while (p && d2 < 8) {
            const ps = getComputedStyle(p);
            const isFlex = ps.display === 'flex' || ps.display === 'inline-flex';
            const isFlexCol = isFlex && (ps.flexDirection === 'column' || ps.flexDirection === 'column-reverse');
            if (isFlexCol && ps.flexGrow === '1' && ps.minHeight !== '0px') {
              p.style.minHeight = '0';
            }
            if (ps.overflow === 'auto' || ps.overflowY === 'auto') break;
            p = p.parentElement;
            d2++;
          }
          return true;
        }
        default:
          return false;
      }
    } catch {
      return false;
    }
  }, []);

  const handleFixOne = useCallback((check: UICheck) => {
    const success = applyFix(check);
    if (success) {
      setChecks(prev => prev.map(c =>
        c.id === check.id
          ? { ...c, verdict: 'auto_fixed' as CheckVerdict, detail: `✅ Auto-fixad: ${c.detail}` }
          : c
      ));
      toast.success(`Layout-fix applicerad: ${check.element.slice(0, 40)}`);
    } else {
      toast.error('Kunde inte applicera fix');
    }
  }, [applyFix]);

  const handleFixAll = useCallback(() => {
    const fixable = checks.filter(c => c.fixType && c.fixTarget && c.verdict !== 'auto_fixed' && c.verdict !== 'working');
    let fixed = 0;
    const updated = checks.map(c => {
      if (c.fixType && c.fixTarget && c.verdict !== 'auto_fixed' && c.verdict !== 'working') {
        const success = applyFix(c);
        if (success) {
          fixed++;
          return { ...c, verdict: 'auto_fixed' as CheckVerdict, detail: `✅ Auto-fixad: ${c.detail}` };
        }
      }
      return c;
    });
    setChecks(updated);
    if (fixed > 0) {
      toast.success(`${fixed}/${fixable.length} layout-problem auto-fixade`);
    } else {
      toast.info('Inga fixbara layout-problem hittades');
    }
  }, [checks, applyFix]);

  const fixableCount = checks.filter(c => c.fixType && c.fixTarget && c.verdict !== 'auto_fixed' && c.verdict !== 'working').length;
  const autoFixedCount = checks.filter(c => c.verdict === 'auto_fixed').length;

  const stats = {
    total: checks.length,
    working: checks.filter(c => c.verdict === 'working').length,
    auto_fixed: autoFixedCount,
    fake_done: checks.filter(c => c.verdict === 'fake_done').length,
    partially_working: checks.filter(c => c.verdict === 'partially_working').length,
    broken: checks.filter(c => c.verdict === 'broken').length,
  };

  const issues = checks.filter(c => c.verdict !== 'working' && c.verdict !== 'auto_fixed');
  const okChecks = checks.filter(c => c.verdict === 'working' || c.verdict === 'auto_fixed');

  return (
    <div className="space-y-4">
      {/* Stats */}
      {status === 'done' && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {([
            { key: 'total', label: 'Totalt', count: stats.total, color: 'text-foreground', icon: Activity },
            { key: 'working', label: 'Fungerar', count: stats.working, color: 'text-green-500', icon: CheckCircle },
            { key: 'auto_fixed', label: 'Auto-fixade', count: stats.auto_fixed, color: 'text-blue-500', icon: Wrench },
            { key: 'fake_done', label: 'Fejkade', count: stats.fake_done, color: 'text-purple-500', icon: Ghost },
            { key: 'partial', label: 'Delvis', count: stats.partially_working, color: 'text-orange-500', icon: AlertTriangle },
            { key: 'broken', label: 'Trasiga', count: stats.broken, color: 'text-destructive', icon: XCircle },
          ] as const).map(s => (
            <Card key={s.key}>
              <CardContent className="p-3 flex items-center gap-2">
                <s.icon className={cn('w-4 h-4', s.color)} />
                <div>
                  <p className="text-lg font-bold leading-none">{s.count}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Progress */}
      {status === 'running' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Skannar UI-element…
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant={status === 'idle' ? 'default' : 'outline'}
          onClick={runScan}
          disabled={status === 'running'}
          className="gap-1.5 text-xs"
        >
          {status === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {status === 'idle' ? 'Kör Reality Check' : 'Kör igen'}
        </Button>
        {checks.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => { setChecks([]); setStatus('idle'); }} className="gap-1.5 text-xs">
            <Trash2 className="w-3.5 h-3.5" />
            Rensa
          </Button>
        )}
        {fixableCount > 0 && (
          <Button size="sm" variant="default" onClick={handleFixAll} className="gap-1.5 text-xs">
            <Wrench className="w-3.5 h-3.5" />
            Auto-fixa alla ({fixableCount})
          </Button>
        )}
        <div className="ml-auto text-[10px] text-muted-foreground">
          Kontrollerar: knappar · data · modaler · scroll · formulär · navigation · layout
        </div>
      </div>

      {/* Responsive Layout Detection */}
      <ResponsiveLayoutDetector />

      {/* Interaction Debug Mode */}
      <InteractionDebugMode />

      {/* Issues */}
      {issues.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <Ghost className="w-4 h-4" />
              Problem ({issues.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[45vh]">
              <div className="space-y-2 pr-2">
                {issues.map(c => <CheckCard key={c.id} check={c} onFix={handleFixOne} />)}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* OK checks */}
      {okChecks.length > 0 && (
        <Card className="border-green-500/20">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              Fungerar ({okChecks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[30vh]">
              <div className="space-y-2 pr-2">
                {okChecks.map(c => <CheckCard key={c.id} check={c} />)}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {status === 'idle' && checks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Ghost className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">UI Reality Check</p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-md mx-auto">
              Skannar alla synliga UI-element i realtid. Hittar döda knappar, fejkade funktioner,
              fastkörda laddare, brutna scroll-containrar och tomma formulär.
            </p>
            <Button size="sm" onClick={runScan} className="mt-4 gap-1.5 text-xs">
              <Play className="w-3.5 h-3.5" />
              Starta Reality Check
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
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

export default UiRealityCheck;
