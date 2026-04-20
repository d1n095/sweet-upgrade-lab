/**
 * CAMPAIGN EVENT CALENDAR
 *
 * Deterministic scheduler for promotional events. Pure function — same input → same output.
 *
 * Sources:   manual | seasonal | recurring | inventory_triggered
 * Types:     BLACK_FRIDAY | WEEKEND_SALE | CLEARANCE_WEEK | PRODUCT_LAUNCH | STOCK_LIQUIDATION
 *
 * Rules:
 *   active event   → emits triggered_campaign with associated discount rule
 *   ended event    → reverts (no campaign emitted; logged as reverted)
 *   scheduled event→ listed in scheduled_events, no campaign yet
 */

export type CampaignType =
  | "BLACK_FRIDAY"
  | "WEEKEND_SALE"
  | "CLEARANCE_WEEK"
  | "PRODUCT_LAUNCH"
  | "STOCK_LIQUIDATION";

export type CampaignSource = "manual" | "seasonal" | "recurring" | "inventory_triggered";

export type RecurrenceRule =
  | { readonly kind: "weekly"; readonly weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; readonly duration_hours: number }
  | { readonly kind: "monthly"; readonly day_of_month: number; readonly duration_hours: number };

export interface CampaignEventInput {
  readonly id: string;
  readonly type: CampaignType;
  readonly source: CampaignSource;
  readonly name: string;
  /** ISO date strings; ignored when recurrence is provided */
  readonly start_at?: string;
  readonly end_at?: string;
  readonly recurrence?: RecurrenceRule;
  /** Inventory trigger metadata; only meaningful for inventory_triggered source */
  readonly inventory_trigger?: {
    readonly product_id: string;
    readonly stock_threshold: number;
    readonly current_stock: number;
    readonly duration_hours: number;
  };
  /** Discount percentage in [0..1] applied while active */
  readonly discount_pct: number;
  /** Higher number wins when overlapping */
  readonly priority: number;
  /** Optional product scope; empty = global */
  readonly product_ids?: ReadonlyArray<string>;
}

export interface CampaignCalendarInput {
  readonly now: string;
  readonly events: ReadonlyArray<CampaignEventInput>;
  /** Look-ahead window for scheduled events, hours; default 720 (30 days) */
  readonly horizon_hours?: number;
}

export interface ResolvedWindow {
  readonly start_at: string;
  readonly end_at: string;
}

export interface ActiveEvent {
  readonly id: string;
  readonly type: CampaignType;
  readonly source: CampaignSource;
  readonly name: string;
  readonly window: ResolvedWindow;
  readonly priority: number;
  readonly discount_pct: number;
  readonly product_ids: ReadonlyArray<string>;
}

export interface ScheduledEvent {
  readonly id: string;
  readonly type: CampaignType;
  readonly source: CampaignSource;
  readonly name: string;
  readonly window: ResolvedWindow;
  readonly starts_in_hours: number;
}

export interface TriggeredCampaign {
  readonly campaign_id: string;
  readonly event_id: string;
  readonly type: CampaignType;
  readonly discount_rule: {
    readonly discount_pct: number;
    readonly applies_to: "global" | "products";
    readonly product_ids: ReadonlyArray<string>;
  };
  readonly priority: number;
  readonly suppressed_by?: string;
  readonly status: "applied" | "suppressed";
}

export interface RevertedEvent {
  readonly id: string;
  readonly type: CampaignType;
  readonly ended_at: string;
}

export interface CampaignCalendarReport {
  readonly evaluated_at: string;
  readonly active_events: ReadonlyArray<ActiveEvent>;
  readonly scheduled_events: ReadonlyArray<ScheduledEvent>;
  readonly triggered_campaigns: ReadonlyArray<TriggeredCampaign>;
  readonly reverted_events: ReadonlyArray<RevertedEvent>;
  readonly summary: {
    readonly total_events: number;
    readonly active_count: number;
    readonly scheduled_count: number;
    readonly reverted_count: number;
    readonly triggered_count: number;
    readonly horizon_hours: number;
  };
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function toMs(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`invalid date: ${iso}`);
  return t;
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Resolve concrete time window for an event relative to `nowMs`.
 * Returns null if event has no resolvable window (e.g. inventory trigger not firing).
 */
function resolveWindow(ev: CampaignEventInput, nowMs: number): ResolvedWindow | null {
  if (ev.recurrence) {
    const r = ev.recurrence;
    const duration = Math.max(1, r.duration_hours) * HOUR_MS;
    const now = new Date(nowMs);

    if (r.kind === "weekly") {
      const cur = now.getUTCDay();
      const delta = (r.weekday - cur + 7) % 7;
      const startDay = new Date(now);
      startDay.setUTCHours(0, 0, 0, 0);
      const startMs = startDay.getTime() + delta * DAY_MS;
      // If today and window already passed, jump 7 days
      if (delta === 0 && nowMs >= startMs + duration) {
        return { start_at: toIso(startMs + 7 * DAY_MS), end_at: toIso(startMs + 7 * DAY_MS + duration) };
      }
      return { start_at: toIso(startMs), end_at: toIso(startMs + duration) };
    }

    // monthly
    const day = Math.max(1, Math.min(28, r.day_of_month));
    const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, 0, 0, 0));
    let startMs = candidate.getTime();
    if (nowMs >= startMs + duration) {
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, day, 0, 0, 0));
      startMs = next.getTime();
    }
    return { start_at: toIso(startMs), end_at: toIso(startMs + duration) };
  }

  if (ev.source === "inventory_triggered") {
    const t = ev.inventory_trigger;
    if (!t) return null;
    if (t.current_stock > t.stock_threshold) return null; // not firing
    const duration = Math.max(1, t.duration_hours) * HOUR_MS;
    return { start_at: toIso(nowMs), end_at: toIso(nowMs + duration) };
  }

  if (ev.start_at && ev.end_at) {
    return { start_at: ev.start_at, end_at: ev.end_at };
  }
  return null;
}

function classify(window: ResolvedWindow, nowMs: number): "active" | "scheduled" | "ended" {
  const s = toMs(window.start_at);
  const e = toMs(window.end_at);
  if (e <= nowMs) return "ended";
  if (s > nowMs) return "scheduled";
  return "active";
}

export function runCampaignCalendar(input: CampaignCalendarInput): CampaignCalendarReport {
  const nowMs = toMs(input.now);
  const horizonHours = input.horizon_hours ?? 720;
  const horizonMs = nowMs + horizonHours * HOUR_MS;

  const active: ActiveEvent[] = [];
  const scheduled: ScheduledEvent[] = [];
  const reverted: RevertedEvent[] = [];

  for (const ev of input.events) {
    const win = resolveWindow(ev, nowMs);
    if (!win) {
      // non-firing inventory trigger / malformed — silently skip
      continue;
    }
    const status = classify(win, nowMs);
    const productIds = ev.product_ids ?? [];

    if (status === "active") {
      active.push({
        id: ev.id,
        type: ev.type,
        source: ev.source,
        name: ev.name,
        window: win,
        priority: ev.priority,
        discount_pct: clamp01(ev.discount_pct),
        product_ids: productIds,
      });
    } else if (status === "scheduled") {
      const startMs = toMs(win.start_at);
      if (startMs > horizonMs) continue;
      scheduled.push({
        id: ev.id,
        type: ev.type,
        source: ev.source,
        name: ev.name,
        window: win,
        starts_in_hours: Math.round(((startMs - nowMs) / HOUR_MS) * 10) / 10,
      });
    } else {
      // ended within last 24h → emit revert signal
      const endMs = toMs(win.end_at);
      if (nowMs - endMs <= DAY_MS) {
        reverted.push({ id: ev.id, type: ev.type, ended_at: win.end_at });
      }
    }
  }

  // Resolve overlap: per (scope key) keep highest priority, suppress rest
  const triggered: TriggeredCampaign[] = [];
  const scopeWinners = new Map<string, ActiveEvent>();

  // Sort active by priority desc, then id asc for determinism
  const sortedActive = [...active].sort((a, b) =>
    b.priority - a.priority || a.id.localeCompare(b.id),
  );

  for (const ev of sortedActive) {
    const scopes = ev.product_ids.length === 0 ? ["__global__"] : [...ev.product_ids];
    for (const scope of scopes) {
      const winner = scopeWinners.get(scope);
      if (!winner) {
        scopeWinners.set(scope, ev);
      }
    }
  }

  for (const ev of sortedActive) {
    const scopes = ev.product_ids.length === 0 ? ["__global__"] : [...ev.product_ids];
    const blocking = scopes
      .map((s) => scopeWinners.get(s))
      .filter((w): w is ActiveEvent => !!w && w.id !== ev.id);
    const isWinner = scopes.every((s) => scopeWinners.get(s)?.id === ev.id);
    triggered.push({
      campaign_id: `camp_${ev.id}`,
      event_id: ev.id,
      type: ev.type,
      discount_rule: {
        discount_pct: ev.discount_pct,
        applies_to: ev.product_ids.length === 0 ? "global" : "products",
        product_ids: ev.product_ids,
      },
      priority: ev.priority,
      status: isWinner ? "applied" : "suppressed",
      suppressed_by: isWinner ? undefined : blocking[0]?.id,
    });
  }

  // Deterministic ordering for outputs
  active.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  scheduled.sort((a, b) => a.starts_in_hours - b.starts_in_hours || a.id.localeCompare(b.id));
  reverted.sort((a, b) => a.ended_at.localeCompare(b.ended_at) || a.id.localeCompare(b.id));
  triggered.sort((a, b) => b.priority - a.priority || a.event_id.localeCompare(b.event_id));

  return Object.freeze({
    evaluated_at: input.now,
    active_events: Object.freeze(active),
    scheduled_events: Object.freeze(scheduled),
    triggered_campaigns: Object.freeze(triggered),
    reverted_events: Object.freeze(reverted),
    summary: Object.freeze({
      total_events: input.events.length,
      active_count: active.length,
      scheduled_count: scheduled.length,
      reverted_count: reverted.length,
      triggered_count: triggered.length,
      horizon_hours: horizonHours,
    }),
  });
}
