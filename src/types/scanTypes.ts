// Shared scan result types — used by AdminAI and ScanProgress
// All data originates from the backend; frontend only reads and renders.

export type SystemStage = 'development' | 'staging' | 'production';

export interface FocusMemoryItem {
  focus_key: string;
  focus_type: string;
  label: string;
  issue_count: number;
  scan_count: number;
  severity: string;
  last_seen_at: string;
}

export interface PredictionItem {
  problem: string;
  area: string;
  confidence: number;
  reason: string;
  preventive_fixes: string[];
  type: 'prediction';
}

export interface AdaptiveScanMeta {
  iterations: number;
  new_issues_found: number;
  pattern_discoveries: any[];
  high_risk_areas: any[];
  systemic_issues: any[];
  coverage_score: number;
  iteration_results: any[];
  focus_memory?: FocusMemoryItem[];
  predictions?: PredictionItem[];
}

export interface IntegrityIssue {
  type: 'data_loss' | 'failed_insert' | 'stale_state' | 'incorrect_filtering' | 'scan_error';
  severity: string;
  entity: string;
  entity_id?: string;
  title: string;
  description?: string;
  step: string;
  root_cause: string;
}

export interface BehaviorFailure {
  chain: string;
  action: string;
  expected: string;
  actual: string;
  failure_type: 'action_failed' | 'partial_execution' | 'silent_failure' | 'lost_state' | 'stale_state';
  step: string;
  severity: string;
  entity_id?: string;
}

export interface UnifiedScanResult {
  blocker: any | null;
  broken_flows: any[];
  fake_features: any[];
  interaction_failures: any[];
  data_issues: any[];
  integrity_issues?: IntegrityIssue[];
  integrity_summary?: Record<string, number>;
  behavior_failures?: BehaviorFailure[];
  behavior_summary?: Record<string, number>;
  system_health_score: number;
  step_results: Record<string, any>;
  completed_at: string;
  total_duration_ms: number;
  adaptive_scan?: AdaptiveScanMeta;
  system_overview?: any;
  system_stage?: SystemStage;
}

/** Filter out dev-expected issues for count/display purposes */
export function filterRelevantIssues<T extends Record<string, any>>(issues: T[]): T[] {
  return issues.filter(i => !i._dev_expected);
}
