/**
 * MARKET LAYER
 *
 * Productizes the internal architecture system into a sellable offering:
 *   - 5 productized components (Core / Intelligence / Control / Simulation / Safety)
 *   - 3 pricing tiers (FREE / PRO / ENTERPRISE)
 *   - 4 packaging modes (CLI / SDK / SaaS / Plugin)
 *   - 3 deployment models (LOCAL / CLOUD / HYBRID)
 *
 * Pure deterministic mapping — no AI, no randomness, no external calls.
 * Same input always produces the same offering.
 */

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type ComponentKey =
  | "core_engine"
  | "intelligence_layer"
  | "control_layer"
  | "simulation_layer"
  | "safety_layer";

export type Tier = "FREE" | "PRO" | "ENTERPRISE";
export type Packaging = "CLI" | "SDK" | "SAAS" | "PLUGIN";
export type Deployment = "LOCAL" | "CLOUD" | "HYBRID";

export interface ProductComponent {
  key: ComponentKey;
  name: string;
  description: string;
  includes: ReadonlyArray<string>;
}

export interface TierSpec {
  tier: Tier;
  display_name: string;
  monthly_price_usd: number;
  included_components: ReadonlyArray<ComponentKey>;
  feature_caps: {
    max_projects: number;
    max_scans_per_day: number;
    visualization: "basic" | "full" | "advanced";
  };
  highlights: ReadonlyArray<string>;
}

export interface PackagingSpec {
  mode: Packaging;
  display_name: string;
  description: string;
  best_for: ReadonlyArray<string>;
}

export interface DeploymentSpec {
  mode: Deployment;
  display_name: string;
  description: string;
  data_residency: "client" | "cloud" | "split";
}

export interface ProductCatalog {
  generated_at: string;
  components: ReadonlyArray<ProductComponent>;
}

export interface PricingModel {
  generated_at: string;
  tiers: ReadonlyArray<TierSpec>;
}

export interface PackagingStrategy {
  generated_at: string;
  packaging_modes: ReadonlyArray<PackagingSpec>;
  deployment_models: ReadonlyArray<DeploymentSpec>;
}

export interface ResolvedOffering {
  generated_at: string;
  tier: Tier;
  packaging: Packaging;
  deployment: Deployment;
  active_components: ReadonlyArray<ComponentKey>;
  monthly_price_usd: number;
  description: string;
}

/* -------------------------------------------------------------------------- */
/*  Static catalogs (frozen, deterministic)                                   */
/* -------------------------------------------------------------------------- */

const COMPONENTS: ReadonlyArray<ProductComponent> = Object.freeze([
  Object.freeze({
    key: "core_engine",
    name: "Core Engine",
    description: "Pipeline + Truth System. Deterministic dependency scan and structure map.",
    includes: Object.freeze([
      "execution_controller",
      "truth_layer",
      "dependency_engine",
      "rule_engine",
    ]),
  }),
  Object.freeze({
    key: "intelligence_layer",
    name: "Intelligence Layer",
    description: "Pattern memory, evolution engine and adaptive thresholds for self-improving architecture.",
    includes: Object.freeze([
      "pattern_memory",
      "evolution_engine",
      "adaptive_thresholds",
      "autonomous_refactor",
    ]),
  }),
  Object.freeze({
    key: "control_layer",
    name: "Control Layer",
    description: "Command Layer + God Mode Overlay. Single dispatch path with full visibility.",
    includes: Object.freeze([
      "command_layer",
      "god_overlay",
      "stealth_mode",
      "meta_control",
    ]),
  }),
  Object.freeze({
    key: "simulation_layer",
    name: "Simulation Layer",
    description: "Synthetic Universe + failure simulation. Test architectures before they exist.",
    includes: Object.freeze([
      "synthetic_universe",
      "failure_simulation",
      "pre_failure_detection",
      "experiment_mode",
    ]),
  }),
  Object.freeze({
    key: "safety_layer",
    name: "Safety Layer",
    description: "Blackbox hardening + Protocol layer. Tamper-proof state and compliance enforcement.",
    includes: Object.freeze([
      "blackbox_hardening",
      "protocol_layer",
      "drift_lock",
      "tamper_trace_log",
    ]),
  }),
]);

const TIERS: ReadonlyArray<TierSpec> = Object.freeze([
  Object.freeze({
    tier: "FREE",
    display_name: "Free",
    monthly_price_usd: 0,
    included_components: Object.freeze<ComponentKey[]>(["core_engine"]),
    feature_caps: Object.freeze({
      max_projects: 1,
      max_scans_per_day: 5,
      visualization: "basic" as const,
    }),
    highlights: Object.freeze([
      "Basic dependency scan",
      "Limited visualization",
      "Single project",
    ]),
  }),
  Object.freeze({
    tier: "PRO",
    display_name: "Pro",
    monthly_price_usd: 49,
    included_components: Object.freeze<ComponentKey[]>([
      "core_engine",
      "intelligence_layer",
      "control_layer",
    ]),
    feature_caps: Object.freeze({
      max_projects: 10,
      max_scans_per_day: 200,
      visualization: "full" as const,
    }),
    highlights: Object.freeze([
      "Full pipeline",
      "Cluster intelligence",
      "Evolution system",
      "Command layer + overlay",
    ]),
  }),
  Object.freeze({
    tier: "ENTERPRISE",
    display_name: "Enterprise",
    monthly_price_usd: 499,
    included_components: Object.freeze<ComponentKey[]>([
      "core_engine",
      "intelligence_layer",
      "control_layer",
      "simulation_layer",
      "safety_layer",
    ]),
    feature_caps: Object.freeze({
      max_projects: 1000,
      max_scans_per_day: 10000,
      visualization: "advanced" as const,
    }),
    highlights: Object.freeze([
      "Multi-project consciousness",
      "Synthetic universe",
      "Failure simulation",
      "Blackbox hardening + protocol enforcement",
    ]),
  }),
]);

const PACKAGING_MODES: ReadonlyArray<PackagingSpec> = Object.freeze([
  Object.freeze({
    mode: "CLI" as const,
    display_name: "CLI Tool",
    description: "Command-line binary for CI/CD pipelines and local scans.",
    best_for: Object.freeze(["CI integration", "scripting", "headless servers"]),
  }),
  Object.freeze({
    mode: "SDK" as const,
    display_name: "JS/TS SDK",
    description: "Programmatic API for embedding in build tooling and frameworks.",
    best_for: Object.freeze(["custom tooling", "framework authors", "library integration"]),
  }),
  Object.freeze({
    mode: "SAAS" as const,
    display_name: "SaaS Dashboard",
    description: "Hosted web dashboard with real-time visualization and team collaboration.",
    best_for: Object.freeze(["teams", "non-developers", "executive reporting"]),
  }),
  Object.freeze({
    mode: "PLUGIN" as const,
    display_name: "Embedded Dev Tool",
    description: "IDE / browser-devtool plugin that runs alongside the developer's workflow.",
    best_for: Object.freeze(["VS Code users", "browser devtools", "live debugging"]),
  }),
]);

const DEPLOYMENT_MODELS: ReadonlyArray<DeploymentSpec> = Object.freeze([
  Object.freeze({
    mode: "LOCAL" as const,
    display_name: "Local Runtime",
    description: "Runs entirely on the user's machine. No data leaves the client.",
    data_residency: "client" as const,
  }),
  Object.freeze({
    mode: "CLOUD" as const,
    display_name: "Cloud Runtime",
    description: "Fully managed cloud execution. Zero local setup.",
    data_residency: "cloud" as const,
  }),
  Object.freeze({
    mode: "HYBRID" as const,
    display_name: "Hybrid Sync",
    description: "Local execution with cloud sync for cross-team visibility.",
    data_residency: "split" as const,
  }),
]);

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

export function getProductCatalog(): ProductCatalog {
  return Object.freeze({
    generated_at: new Date().toISOString(),
    components: COMPONENTS,
  });
}

export function getPricingModel(): PricingModel {
  return Object.freeze({
    generated_at: new Date().toISOString(),
    tiers: TIERS,
  });
}

export function getPackagingStrategy(): PackagingStrategy {
  return Object.freeze({
    generated_at: new Date().toISOString(),
    packaging_modes: PACKAGING_MODES,
    deployment_models: DEPLOYMENT_MODELS,
  });
}

/**
 * Resolve the active offering for a given (tier, packaging, deployment) tuple.
 * Pure deterministic — same input always returns the same output.
 */
export function resolveOffering(
  tier: Tier,
  packaging: Packaging,
  deployment: Deployment
): ResolvedOffering {
  const tierSpec = TIERS.find((t) => t.tier === tier);
  if (!tierSpec) throw new Error(`unknown tier "${tier}"`);
  const pkgSpec = PACKAGING_MODES.find((p) => p.mode === packaging);
  if (!pkgSpec) throw new Error(`unknown packaging "${packaging}"`);
  const depSpec = DEPLOYMENT_MODELS.find((d) => d.mode === deployment);
  if (!depSpec) throw new Error(`unknown deployment "${deployment}"`);

  return Object.freeze({
    generated_at: new Date().toISOString(),
    tier,
    packaging,
    deployment,
    active_components: tierSpec.included_components,
    monthly_price_usd: tierSpec.monthly_price_usd,
    description: `${tierSpec.display_name} via ${pkgSpec.display_name} on ${depSpec.display_name}`,
  });
}

export const MARKET_TIERS: ReadonlyArray<Tier> = Object.freeze(["FREE", "PRO", "ENTERPRISE"]);
export const MARKET_PACKAGING: ReadonlyArray<Packaging> = Object.freeze(["CLI", "SDK", "SAAS", "PLUGIN"]);
export const MARKET_DEPLOYMENT: ReadonlyArray<Deployment> = Object.freeze(["LOCAL", "CLOUD", "HYBRID"]);
