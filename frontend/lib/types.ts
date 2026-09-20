// Warrant Type Definitions for Enterprise Research Verification UI
// Inspired by Meykiio Devtool & Enterprise Systems

export interface EvidenceSpan {
  id: string;
  doc_title: string;
  text: string;
  char_start: number;
  char_end: number;
  retrieval_hop: number;
  score: number;
}

export type GuardStatus = "PASSED" | "FAILED_NUMERICAL" | "FAILED_ENTITY" | "FAILED_ZERO_SPANS";
export type NLILabel = "ENTAILMENT" | "NEUTRAL" | "CONTRADICTION";
export type ClaimVerificationStatus = "VERIFIED" | "REFUTED" | "UNVERIFIABLE";
export type PolicyDecision = "FULL_PASS" | "PARTIAL_PASS" | "ABSTAIN";

export interface AtomicClaim {
  claim_id: string;
  text: string;
  cited_spans: string[];
  guard_status: GuardStatus;
  guard_reasons: string[];
  nli_label: NLILabel;
  nli_entailment_prob: number;
  nli_neutral_prob: number;
  nli_contradiction_prob: number;
  nli_inference_latency_ms: number;
  verification_status: ClaimVerificationStatus;
}

export interface WarrantState {
  query: string;
  current_hop: number;
  max_hops: number;
  retrieved_spans: EvidenceSpan[];
  synthetic_claims: AtomicClaim[];
  verified_claims: AtomicClaim[];
  refuted_claims: AtomicClaim[];
  unverifiable_claims: AtomicClaim[];
  policy_decision: PolicyDecision;
  policy_reason: string;
  final_answer: string;
  iteration: number;
  retry_count: number;
}

export interface SSEEventPayload {
  event_type:
    | "query_started"
    | "hop_completed"
    | "claims_synthesized"
    | "claims_verified"
    | "policy_evaluated"
    | "answer_assembled"
    | "complete"
    | "error";
  node_name?: string;
  timestamp: string;
  data: Record<string, unknown>;
  state_delta?: Partial<WarrantState>;
  telemetry?: {
    node?: string;
    step_duration_ms?: number;
    total_latency_ms?: number;
    device?: string;
    vram_used_mb?: number;
  };
}

export interface PresetTrajectory {
  id: string;
  title: string;
  query: string;
  badge: string;
  hopsRequired: number;
  expectedDecision: PolicyDecision;
  description: string;
  // Full simulated or recorded state for 100% offline interactive demo mode
  mockState: WarrantState;
}

export interface BenchmarkMetrics {
  name: string;
  hallucination_rate: number;
  precision: number;
  verification_latency_ms: number;
  gpu_vram_mb: number;
  notes: string;
}
