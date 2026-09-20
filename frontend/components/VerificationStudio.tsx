"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  ShieldX,
  Copy,
  Check,
  Search,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Layers,
  BookOpen,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { WarrantState, AtomicClaim, EvidenceSpan } from "../lib/types";

interface VerificationStudioProps {
  state: WarrantState | null;
  isLoading: boolean;
  viewMode: "executive" | "telemetry";
}

export const VerificationStudio: React.FC<VerificationStudioProps> = ({
  state,
  isLoading,
  viewMode,
}) => {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [hoveredClaimId, setHoveredClaimId] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  if (!state && !isLoading) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center text-slate-400">
        <p>No research inquiry active. Select a preset above or type a question to begin.</p>
      </div>
    );
  }

  const activeClaimId = hoveredClaimId || selectedClaimId || state?.synthetic_claims[0]?.claim_id;
  const activeClaim = state?.synthetic_claims.find((c) => c.claim_id === activeClaimId);
  const activeCitedSpans = new Set(activeClaim?.cited_spans || []);

  const handleCopy = () => {
    if (state?.final_answer) {
      navigator.clipboard.writeText(state.final_answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Group spans by document title
  const groupedSpans: Record<string, EvidenceSpan[]> = {};
  for (const span of state?.retrieved_spans || []) {
    if (!groupedSpans[span.doc_title]) {
      groupedSpans[span.doc_title] = [];
    }
    groupedSpans[span.doc_title].push(span);
  }

  // Contract Theme
  const getPolicyBanner = () => {
    switch (state?.policy_decision) {
      case "FULL_PASS":
        return {
          icon: ShieldCheck,
          title: "Attribution Verdict: FULL PASS",
          badge: "100% Verified & Attributed",
          bg: "bg-emerald-950/40 border-emerald-500/30 text-emerald-300",
          aura: "glow-emerald",
          description:
            "100% of claims passed the sub-millisecond deterministic guard and exceeded the calibrated DeBERTa NLI threshold (tau >= 0.82). Zero hallucinations detected.",
        };
      case "PARTIAL_PASS":
        return {
          icon: AlertTriangle,
          title: "Attribution Verdict: PARTIAL PASS",
          badge: "Graceful Recovery (Pruned)",
          bg: "bg-amber-950/40 border-amber-500/30 text-amber-300",
          aura: "glow-amber",
          description:
            "Attribution discrepancy detected. The system pruned ungrounded/hallucinated claims and safely assembled a verified answer from entailed claims.",
        };
      case "ABSTAIN":
        return {
          icon: ShieldX,
          title: "Attribution Verdict: STRICT ABSTENTION",
          badge: "Zero-Hallucination Refusal",
          bg: "bg-rose-950/40 border-rose-500/30 text-rose-300",
          aura: "glow-rose",
          description:
            "Insufficient grounded evidence retrieved. Rather than hallucinating or fabricating facts, Warrant executed its contractual refusal guarantee.",
        };
      default:
        return {
          icon: Clock,
          title: "Attribution Verdict: EVALUATING...",
          badge: "Pipeline Active",
          bg: "bg-slate-900 border-slate-700 text-slate-300",
          aura: "",
          description: "LangGraph state machine executing multi-hop retrieval and verification...",
        };
    }
  };

  const policy = getPolicyBanner();
  const PolicyIcon = policy.icon;

  return (
    <div className="space-y-6">
      {/* 1. Policy Contract Verdict Card */}
      <div className={`glass-panel rounded-2xl p-5 md:p-6 border transition-all ${policy.bg} ${policy.aura}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
              <PolicyIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">{policy.title}</h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/40 border border-white/20">
                  {policy.badge}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {policy.description}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          {state && (
            <div className="flex items-center gap-3 self-end sm:self-center font-mono text-xs">
              <div className="text-slate-300 bg-black/30 px-2.5 py-1 rounded-lg border border-white/5">
                Verified: <span className="text-emerald-400 font-bold">{state.verified_claims.length}</span>
              </div>
              {state.refuted_claims.length > 0 && (
                <div className="text-slate-300 bg-black/30 px-2.5 py-1 rounded-lg border border-white/5">
                  Pruned: <span className="text-rose-400 font-bold">{state.refuted_claims.length}</span>
                </div>
              )}
              <div className="text-slate-300 bg-black/30 px-2.5 py-1 rounded-lg border border-white/5">
                Hops: <span className="text-cyan-400 font-bold">{state.current_hop}</span>
              </div>
            </div>
          )}
        </div>

        {/* Final Warranted Answer */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Warranted Synthesis Output:
            </span>
            {state?.final_answer && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors bg-black/30 px-2.5 py-1 rounded-md border border-white/5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied to clipboard" : "Copy Answer"}</span>
              </button>
            )}
          </div>

          <div className="bg-black/60 rounded-xl p-4 md:p-5 border border-slate-800 text-sm md:text-base leading-relaxed text-slate-100 font-sans shadow-inner">
            {isLoading && !state?.final_answer ? (
              <div className="flex items-center gap-2.5 text-slate-400 animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                Synthesizing atomic claims and evaluating DeBERTa NLI cross-entropy...
              </div>
            ) : (
              <div>{state?.final_answer}</div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Studio Split Screen: Claims Matrix (Left) & Ground Truth Evidence (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Atomic Claims & Dual-Stage Verification Cards (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Claim-Level Verification Matrix ({state?.synthetic_claims.length || 0})
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Select a claim to highlight evidence
            </span>
          </div>

          <div className="space-y-3">
            {state?.synthetic_claims.map((claim) => {
              const isSelected = selectedClaimId === claim.claim_id;
              const isHovered = hoveredClaimId === claim.claim_id;
              const entailPercent = (claim.nli_entailment_prob * 100).toFixed(1);
              const isVerified = claim.verification_status === "VERIFIED";

              return (
                <div
                  key={claim.claim_id}
                  onClick={() => setSelectedClaimId(isSelected ? null : claim.claim_id)}
                  onMouseEnter={() => setHoveredClaimId(claim.claim_id)}
                  onMouseLeave={() => setHoveredClaimId(null)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected || isHovered
                      ? "glass-panel-elevated border-emerald-400 shadow-xl glow-emerald"
                      : "glass-panel border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {/* Top Bar of Claim */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/20">
                        {claim.claim_id}
                      </span>
                      {claim.guard_status === "PASSED" ? (
                        <span className="text-[11px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Guard: Passed (&lt;1ms)
                        </span>
                      ) : (
                        <span className="text-[11px] text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-500/30 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Guard: {claim.guard_status}
                        </span>
                      )}
                    </div>

                    {/* Overall Status */}
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${
                        isVerified
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      }`}
                    >
                      {claim.verification_status}
                    </span>
                  </div>

                  {/* Claim Text */}
                  <p className="text-sm font-medium text-slate-100 mb-3 leading-relaxed">
                    &ldquo;{claim.text}&rdquo;
                  </p>

                  {/* Verification Gauges */}
                  <div className="bg-black/50 rounded-lg p-3 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">DeBERTa-v3 NLI Entailment:</span>
                      <span
                        className={`font-mono font-bold ${
                          claim.nli_entailment_prob >= 0.82 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {entailPercent}% (Threshold: 82.0%)
                      </span>
                    </div>

                    {/* Progress Bar with 82% threshold needle */}
                    <div className="relative w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          claim.nli_entailment_prob >= 0.82
                            ? "bg-gradient-to-r from-emerald-500 to-green-400"
                            : "bg-gradient-to-r from-rose-500 to-red-400"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, claim.nli_entailment_prob * 100))}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-white shadow z-10"
                        style={{ left: "82%" }}
                        title="82% Entailment Acceptance Boundary"
                      />
                    </div>

                    {/* Telemetry view details */}
                    {viewMode === "telemetry" && (
                      <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>Neutral: {(claim.nli_neutral_prob * 100).toFixed(0)}%</span>
                        <span>Contradiction: {(claim.nli_contradiction_prob * 100).toFixed(0)}%</span>
                        <span>Latency: {claim.nli_inference_latency_ms.toFixed(0)}ms (CPU)</span>
                      </div>
                    )}
                  </div>

                  {/* Cited Spans footer */}
                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span>Cited:</span>
                      {claim.cited_spans.map((spanId) => (
                        <span
                          key={spanId}
                          className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-cyan-950/50 border border-cyan-500/20 text-cyan-300"
                        >
                          {spanId}
                        </span>
                      ))}
                    </div>
                    <span className="text-[11px] text-emerald-400/80 flex items-center gap-0.5 hover:underline">
                      View Grounding <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Ground Truth Evidence & Proof Inspector (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Ground Truth Evidence &amp; Proof Inspector
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              {state?.retrieved_spans.length || 0} sentences retrieved
            </span>
          </div>

          {activeClaim && (
            <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-200 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  Highlighting evidence supporting <strong>[{activeClaim.claim_id}]</strong>
                </span>
              </div>
              <span className="text-[11px] font-mono bg-cyan-900/40 px-2 py-0.5 rounded text-cyan-300">
                {activeCitedSpans.size} span(s) cited
              </span>
            </div>
          )}

          {/* Documents Container */}
          <div className="space-y-4 max-h-[640px] overflow-y-auto pr-1">
            {Object.entries(groupedSpans).map(([docTitle, spans]) => (
              <div
                key={docTitle}
                className="glass-panel rounded-xl border border-slate-800 overflow-hidden shadow-lg"
              >
                {/* Document Header */}
                <div className="px-4 py-3 bg-black/60 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-sm text-white">{docTitle}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Wikipedia Source &middot; {spans.length} sentence span{spans.length > 1 ? "s" : ""}
                  </span>
                </div>

                {/* Spans List */}
                <div className="p-3.5 space-y-2.5">
                  {spans.map((span) => {
                    const isCited = activeCitedSpans.has(span.id);

                    return (
                      <div
                        key={span.id}
                        className={`p-3 rounded-xl border transition-all text-xs leading-relaxed ${
                          isCited
                            ? "bg-emerald-950/50 border-emerald-400 text-white glow-emerald ring-1 ring-emerald-500/30"
                            : "bg-black/30 border-slate-800/80 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1 text-[10px] text-slate-400 font-mono">
                          <span
                            className={`font-bold ${
                              isCited ? "text-emerald-300" : "text-slate-400"
                            }`}
                          >
                            [{span.id}]
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="bg-black/40 px-1.5 py-0.5 rounded text-slate-300">
                              Hop {span.retrieval_hop}
                            </span>
                            <span>Score: {span.score.toFixed(3)}</span>
                          </div>
                        </div>

                        <p className={`text-sm ${isCited ? "text-white font-medium" : "text-slate-300"}`}>
                          {span.text}
                        </p>

                        {isCited && (
                          <div className="mt-2 pt-1.5 border-t border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>
                              Active Grounding: Cited by <strong>[{activeClaim?.claim_id}]</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
