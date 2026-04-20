/**
 * AUTONOMOUS COMPANY STACK
 * ────────────────────────────────────────────────────────────────────────────
 * Connects architecture intelligence (stability, complexity, resilience,
 * cluster health) to business value (revenue model, pricing, growth loops,
 * packaging opportunities).
 *
 * RULES
 *   • Pure & deterministic — same input → same output, no Date.now / Math.random.
 *   • No I/O. Inputs are plain objects; outputs are frozen reports.
 *   • No coupling to other layers — callers pass in already-collected metrics
 *     from systemStateRegistry / marketLayer / clusterIntelligence / etc.
 *
 * LAYERS
 *   1. ProductValueEngine        health → business value mapping
 *   2. UsageTracker              normalize feature/load/bottleneck signals
 *   3. PricingOptimizationEngine dynamic price multipliers
 *   4. GrowthLoop                detect → identify → optimize → upsell
 *   5. AutomatedPackaging        stable feature-sets → new modules / tiers
 */

/* -------------------------------------------------------------------------- */
/*  Inputs                                                                    */
/* -------------------------------------------------------------------------- */

export interface SystemHealthInput {
  /** 0-100, higher = more stable */
  stability_score: number;
  /** 0-100, higher = more complex (BAD) */
  complexity_score: number;
  /** 0-100, higher = more resilient */
  resilience_score: number;
  /** 0-100, optional integrity score from blackbox/registry */
  integrity_score?: number;
}

export interface FeatureUsageRecord {
  feature_id: string;
  /** invocations in the observation window */
  invocations: number;
  /** unique users / sessions touched */
  unique_users: number;
  /** average latency in ms (proxy for system load) */
  avg_latency_ms: number;
  /** 0-1 share of sessions where this feature blocked progress */
  bottleneck_rate: number;
  /** cluster this feature belongs to (used for packaging) */
  cluster: string;
  /** how many other features depend on this one */
  dependency_depth: number;
}

export interface UserActionRecord {
  action_id: string;
  count: number;
  /** 0-1 conversion contribution (e.g. checkout = 1.0, browse = 0.1) */
  value_weight: number;
}

export interface CompanyStackInput {
  health: SystemHealthInput;
  features: ReadonlyArray<FeatureUsageRecord>;
  user_actions: ReadonlyArray<UserActionRecord>;
  /** existing pricing tiers (USD/month). Order: low → high. */
  base_tiers: ReadonlyArray<{ tier: string; monthly_price_usd: number }>;
}

/* -------------------------------------------------------------------------- */
/*  Outputs                                                                   */
/* -------------------------------------------------------------------------- */

export interface RevenueModel {
  retention_index: number;        // 0-100
  cost_index: number;             // 0-100 (lower = cheaper to operate)
  premium_eligibility: boolean;   // true if resilience qualifies for top tier
  projected_arpu_multiplier: number; // 0.5–1.5 vs baseline
  rationale: ReadonlyArray<string>;
}

export interface UsageReport {
  total_invocations: number;
  total_unique_users: number;
  top_features: ReadonlyArray<{ feature_id: string; invocations: number }>;
  bottlenecks: ReadonlyArray<{ feature_id: string; bottleneck_rate: number }>;
  high_value_clusters: ReadonlyArray<{ cluster: string; value_score: number }>;
}

export interface PricingRecommendation {
  tier: string;
  current_price_usd: number;
  recommended_price_usd: number;
  delta_pct: number;
  drivers: ReadonlyArray<string>;
}

export interface GrowthLoopReport {
  detected_patterns: ReadonlyArray<string>;
  high_value_clusters: ReadonlyArray<string>;
  ux_optimizations: ReadonlyArray<string>;
  upsell_points: ReadonlyArray<{ from_tier: string; to_tier: string; trigger: string }>;
}

export interface ProductOpportunity {
  proposed_module: string;
  cluster: string;
  feature_count: number;
  stability_estimate: number;     // 0-100
  suggested_tier: string;
  rationale: string;
}

export interface CompanyStackReport {
  revenue_model: RevenueModel;
  usage: UsageReport;
  pricing_recommendations: ReadonlyArray<PricingRecommendation>;
  growth_loops: GrowthLoopReport;
  product_opportunities: ReadonlyArray<ProductOpportunity>;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const r2 = (n: number) => Math.round(n * 100) / 100;

/* -------------------------------------------------------------------------- */
/*  1. Product Value Engine                                                   */
/* -------------------------------------------------------------------------- */

export function computeRevenueModel(health: SystemHealthInput): RevenueModel {
  const stability = clamp(health.stability_score);
  const complexity = clamp(health.complexity_score);
  const resilience = clamp(health.resilience_score);
  const integrity = clamp(health.integrity_score ?? 100);

  // stability ↑ → retention ↑   (also rewarded by integrity)
  const retention_index = clamp(stability * 0.7 + integrity * 0.3);
  // complexity ↓ → cost ↓       (cost_index: lower is better)
  const cost_index = clamp(complexity * 0.8 + (100 - resilience) * 0.2);
  // resilience ≥ 80 + integrity ≥ 80 → premium eligible
  const premium_eligibility = resilience >= 80 && integrity >= 80;

  // ARPU multiplier: 1.0 baseline, ±0.5
  const arpu =
    1 +
    ((retention_index - 50) / 100) * 0.4 +    // good retention lifts ARPU
    ((50 - cost_index) / 100) * 0.3 +         // low cost gives margin to upsell
    (premium_eligibility ? 0.1 : 0);

  const rationale: string[] = [];
  rationale.push(`stability ${stability} → retention ${Math.round(retention_index)}`);
  rationale.push(`complexity ${complexity} → cost ${Math.round(cost_index)}`);
  rationale.push(
    premium_eligibility
      ? `resilience ${resilience} ≥ 80 → premium tier unlocked`
      : `resilience ${resilience} < 80 → premium locked`,
  );

  return Object.freeze({
    retention_index: Math.round(retention_index),
    cost_index: Math.round(cost_index),
    premium_eligibility,
    projected_arpu_multiplier: r2(clamp(arpu, 0.5, 1.5)),
    rationale: Object.freeze(rationale),
  });
}

/* -------------------------------------------------------------------------- */
/*  2. Usage Tracker                                                          */
/* -------------------------------------------------------------------------- */

export function buildUsageReport(
  features: ReadonlyArray<FeatureUsageRecord>,
  actions: ReadonlyArray<UserActionRecord>,
): UsageReport {
  const total_invocations = features.reduce((s, f) => s + f.invocations, 0);
  const total_unique_users = features.reduce((s, f) => s + f.unique_users, 0);

  const top_features = [...features]
    .sort((a, b) => b.invocations - a.invocations)
    .slice(0, 5)
    .map((f) => ({ feature_id: f.feature_id, invocations: f.invocations }));

  const bottlenecks = features
    .filter((f) => f.bottleneck_rate >= 0.15)
    .sort((a, b) => b.bottleneck_rate - a.bottleneck_rate)
    .slice(0, 5)
    .map((f) => ({ feature_id: f.feature_id, bottleneck_rate: r2(f.bottleneck_rate) }));

  // value per cluster = Σ(invocations × action value-weight proxy)
  const action_weight = actions.reduce((s, a) => s + a.count * a.value_weight, 0);
  const norm = action_weight === 0 ? 1 : action_weight;
  const cluster_map = new Map<string, number>();
  for (const f of features) {
    const v = (f.invocations * (1 + f.dependency_depth * 0.1) * 100) / norm;
    cluster_map.set(f.cluster, (cluster_map.get(f.cluster) ?? 0) + v);
  }
  const high_value_clusters = [...cluster_map.entries()]
    .map(([cluster, value_score]) => ({ cluster, value_score: r2(value_score) }))
    .sort((a, b) => b.value_score - a.value_score)
    .slice(0, 5);

  return Object.freeze({
    total_invocations,
    total_unique_users,
    top_features: Object.freeze(top_features),
    bottlenecks: Object.freeze(bottlenecks),
    high_value_clusters: Object.freeze(high_value_clusters),
  });
}

/* -------------------------------------------------------------------------- */
/*  3. Pricing Optimization                                                   */
/* -------------------------------------------------------------------------- */

export function recommendPricing(
  base_tiers: ReadonlyArray<{ tier: string; monthly_price_usd: number }>,
  features: ReadonlyArray<FeatureUsageRecord>,
  health: SystemHealthInput,
): ReadonlyArray<PricingRecommendation> {
  // resource usage proxy: avg latency × invocations
  const totalLoad = features.reduce((s, f) => s + f.avg_latency_ms * f.invocations, 0);
  const avgLoad = features.length === 0 ? 0 : totalLoad / features.length;
  const loadFactor = clamp(avgLoad / 5000, 0, 1); // 5000 ms·calls saturates

  const avgDepth =
    features.length === 0
      ? 0
      : features.reduce((s, f) => s + f.dependency_depth, 0) / features.length;
  const depthFactor = clamp(avgDepth / 6, 0, 1); // depth 6+ saturates

  const clusterCount = new Set(features.map((f) => f.cluster)).size;
  const complexityFactor = clamp(clusterCount / 12, 0, 1);

  const resilienceBonus = (clamp(health.resilience_score) - 50) / 200; // ±0.25

  return base_tiers.map((t) => {
    // delta in ±25 % range
    const delta =
      loadFactor * 0.10 +        // resource cost
      depthFactor * 0.08 +       // dependency depth = stickier value
      complexityFactor * 0.07 +  // surface area
      resilienceBonus;           // can charge more if very resilient

    const recommended = Math.max(0, t.monthly_price_usd * (1 + delta));
    const drivers: string[] = [];
    if (loadFactor > 0.3) drivers.push(`high resource usage (load factor ${r2(loadFactor)})`);
    if (depthFactor > 0.3) drivers.push(`deep feature dependencies (avg depth ${r2(avgDepth)})`);
    if (complexityFactor > 0.3) drivers.push(`broad cluster surface (${clusterCount} clusters)`);
    if (resilienceBonus > 0.05) drivers.push(`premium resilience (${health.resilience_score})`);
    if (drivers.length === 0) drivers.push("baseline pricing — no strong drivers");

    return Object.freeze({
      tier: t.tier,
      current_price_usd: r2(t.monthly_price_usd),
      recommended_price_usd: r2(recommended),
      delta_pct: r2(delta * 100),
      drivers: Object.freeze(drivers),
    });
  });
}

/* -------------------------------------------------------------------------- */
/*  4. Growth Loop                                                            */
/* -------------------------------------------------------------------------- */

export function buildGrowthLoop(
  usage: UsageReport,
  base_tiers: ReadonlyArray<{ tier: string; monthly_price_usd: number }>,
): GrowthLoopReport {
  const detected_patterns: string[] = [];
  if (usage.top_features.length > 0) {
    detected_patterns.push(`top driver: ${usage.top_features[0].feature_id}`);
  }
  if (usage.bottlenecks.length > 0) {
    detected_patterns.push(`${usage.bottlenecks.length} bottleneck features detected`);
  }
  if (usage.high_value_clusters.length > 0) {
    detected_patterns.push(
      `${usage.high_value_clusters.length} high-value clusters generating revenue`,
    );
  }

  const high_value_clusters = usage.high_value_clusters.map((c) => c.cluster);

  const ux_optimizations: string[] = [];
  for (const b of usage.bottlenecks) {
    ux_optimizations.push(`reduce friction in ${b.feature_id} (block rate ${b.bottleneck_rate})`);
  }
  for (const t of usage.top_features.slice(0, 2)) {
    ux_optimizations.push(`promote ${t.feature_id} earlier in onboarding`);
  }

  // Upsell points: deterministic ladder through tiers triggered by high-value clusters.
  const sortedTiers = [...base_tiers].sort((a, b) => a.monthly_price_usd - b.monthly_price_usd);
  const upsell_points: Array<{ from_tier: string; to_tier: string; trigger: string }> = [];
  for (let i = 0; i < sortedTiers.length - 1; i++) {
    const trigger =
      high_value_clusters[i] ??
      usage.top_features[i]?.feature_id ??
      "sustained usage";
    upsell_points.push({
      from_tier: sortedTiers[i].tier,
      to_tier: sortedTiers[i + 1].tier,
      trigger: `${trigger} drives ${sortedTiers[i + 1].tier} upgrade`,
    });
  }

  return Object.freeze({
    detected_patterns: Object.freeze(detected_patterns),
    high_value_clusters: Object.freeze(high_value_clusters),
    ux_optimizations: Object.freeze(ux_optimizations),
    upsell_points: Object.freeze(upsell_points),
  });
}

/* -------------------------------------------------------------------------- */
/*  5. Automated Packaging                                                    */
/* -------------------------------------------------------------------------- */

export function detectProductOpportunities(
  features: ReadonlyArray<FeatureUsageRecord>,
  health: SystemHealthInput,
  base_tiers: ReadonlyArray<{ tier: string; monthly_price_usd: number }>,
): ReadonlyArray<ProductOpportunity> {
  const byCluster = new Map<string, FeatureUsageRecord[]>();
  for (const f of features) {
    if (!byCluster.has(f.cluster)) byCluster.set(f.cluster, []);
    byCluster.get(f.cluster)!.push(f);
  }

  const sortedTiers = [...base_tiers].sort((a, b) => a.monthly_price_usd - b.monthly_price_usd);
  const opportunities: ProductOpportunity[] = [];

  for (const [cluster, group] of byCluster) {
    if (group.length < 2) continue; // need ≥2 features to package
    const avgBottleneck = group.reduce((s, f) => s + f.bottleneck_rate, 0) / group.length;
    const stability_estimate = clamp(
      health.stability_score * 0.6 + (1 - avgBottleneck) * 100 * 0.4,
    );
    if (stability_estimate < 60) continue; // unstable → don't package yet

    const usageTotal = group.reduce((s, f) => s + f.invocations, 0);
    // Map usage volume to tier deterministically.
    const tierIndex =
      usageTotal > 10_000
        ? Math.min(sortedTiers.length - 1, 2)
        : usageTotal > 1_000
        ? Math.min(sortedTiers.length - 1, 1)
        : 0;
    const suggested_tier = sortedTiers[tierIndex]?.tier ?? "FREE";

    opportunities.push(
      Object.freeze({
        proposed_module: `${cluster}-bundle`,
        cluster,
        feature_count: group.length,
        stability_estimate: Math.round(stability_estimate),
        suggested_tier,
        rationale: `${group.length} stable features in "${cluster}" with ${usageTotal.toLocaleString()} invocations → package as ${suggested_tier} module`,
      }),
    );
  }

  return Object.freeze(
    opportunities.sort((a, b) => b.stability_estimate - a.stability_estimate),
  );
}

/* -------------------------------------------------------------------------- */
/*  Top-level orchestrator                                                    */
/* -------------------------------------------------------------------------- */

export function buildCompanyStackReport(input: CompanyStackInput): CompanyStackReport {
  const revenue_model = computeRevenueModel(input.health);
  const usage = buildUsageReport(input.features, input.user_actions);
  const pricing_recommendations = recommendPricing(input.base_tiers, input.features, input.health);
  const growth_loops = buildGrowthLoop(usage, input.base_tiers);
  const product_opportunities = detectProductOpportunities(
    input.features,
    input.health,
    input.base_tiers,
  );

  return Object.freeze({
    revenue_model,
    usage,
    pricing_recommendations,
    growth_loops,
    product_opportunities,
  });
}
