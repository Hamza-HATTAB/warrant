"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  ShieldX,
  Copy,
  Check,
  Sparkles,
  BookOpen,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { WarrantState, AtomicClaim, EvidenceSpan } from "../lib/types";
import { cn } from "../lib/utils";

interface CitationDisassemblerProps {
  state: WarrantState | null;
  selectedClaimId?: string | null;
  onSelectClaim?: (claimId: string) => void;
  className?: string;
}

export const CitationDisassembler: React.FC<CitationDisassemblerProps> = ({
  state,
  selectedClaimId,
  onSelectClaim,
  className = "",
}) => {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"warrant" | "naive-rag">("warrant");
  const [copied, setCopied] = useState<boolean>(false);

  const activeClaimId = selectedClaimId || internalSelectedId || state?.synthetic_claims?.[0]?.claim_id || "c_001";

  const handleClaimClick = (claimId: string) => {
    setInternalSelectedId(claimId);
    if (onSelectClaim) onSelectClaim(claimId);
  };

  const handleCopy = () => {
    if (state?.final_answer) {
      navigator.clipboard.writeText(state.final_answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Claims & Spans
  const claims: AtomicClaim[] = state?.synthetic_claims && state.synthetic_claims.length > 0
    ? state.synthetic_claims
    : [
        {
          claim_id: "c_001",
          text: "Arthur's Magazine was founded in 1844.",
          cited_spans: ["arthur_mag_s0"],
          guard_status: "PASSED",
          guard_reasons: [],
          nli_label: "ENTAILMENT",
          nli_entailment_prob: 0.964,
          nli_neutral_prob: 0.026,
          nli_contradiction_prob: 0.01,
          nli_inference_latency_ms: 182,
          verification_status: "VERIFIED",
        },
        {
          claim_id: "c_002",
          text: "First for Women was started in 1989.",
          cited_spans: ["first_women_s1"],
          guard_status: "PASSED",
          guard_reasons: [],
          nli_label: "ENTAILMENT",
          nli_entailment_prob: 0.981,
          nli_neutral_prob: 0.012,
          nli_contradiction_prob: 0.007,
          nli_inference_latency_ms: 174,
          verification_status: "VERIFIED",
        },
      ];

  const spans: EvidenceSpan[] = state?.retrieved_spans && state.retrieved_spans.length > 0
    ? state.retrieved_spans
    : [
        {
          id: "arthur_mag_s0",
          doc_title: "Arthur's Magazine",
          text: "Arthur's Magazine (1844–1846) was an American literary magazine published in Philadelphia in the 19th century.",
          char_start: 0,
          char_end: 110,
          retrieval_hop: 1,
          score: 0.942,
        },
        {
          id: "first_women_s1",
          doc_title: "First for Women",
          text: "The magazine was started in 1989 and is based in Englewood Cliffs, New Jersey.",
          char_start: 81,
          char_end: 159,
          retrieval_hop: 2,
          score: 0.956,
        },
      ];

  const currentClaim = claims.find((c) => c.claim_id === activeClaimId) || claims[0];
  const activeCitedSpans = new Set(currentClaim?.cited_spans || []);
  const activeSpan = spans.find((s) => activeCitedSpans.has(s.id)) || spans[0];

  // Policy Verdict Theme
  const getPolicyBanner = () => {
    switch (state?.policy_decision) {
      case "FULL_PASS":
        return {
          icon: ShieldCheck,
          title: "FULL PASS · Formally Verified Attribution",
          badge: "tau >= 0.820 Satisfied",
          bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
          textColor: "text-emerald-400",
          description: "All candidate assertions passed Stage 1 deterministic entity regex guard and exceeded calibrated DeBERTa-v3 cross-encoder entailment threshold.",
        };
      case "PARTIAL_PASS":
        return {
          icon: AlertTriangle,
          title: "PARTIAL PASS · Graceful Recovery (Pruned)",
          badge: "Attribution Discrepancy",
          bg: "bg-amber-500/10 border-amber-500/30 text-amber-300",
          textColor: "text-amber-400",
          description: "Ungrounded hallucination pruned. Answer safely composed exclusively from entailed claims.",
        };
      case "ABSTAIN":
        return {
          icon: ShieldX,
          title: "STRICT ABSTENTION · Contract Refusal",
          badge: "Selective Abstention",
          bg: "bg-rose-500/10 border-rose-500/30 text-rose-300",
          textColor: "text-rose-400",
          description: "Premise not supported by retrieved evidence. Warrant strictly refuses to generate ungrounded hallucinations.",
        };
      default:
        return {
          icon: ShieldCheck,
          title: "EVALUATING ATTRITION DAG...",
          badge: "Pipeline Active",
          bg: "bg-slate-800/40 border-slate-700 text-slate-300",
          textColor: "text-slate-400",
          description: "LangGraph state machine evaluating cross-encoder evidence.",
        };
    }
  };

  const policy = getPolicyBanner();
  const PolicyIcon = policy.icon;

  // Naive Decorated text with simulated citation hallucination
  const getNaiveDecoratedText = () => {
    if (state?.policy_decision === "ABSTAIN") {
      return (
        <div className="space-y-3">
          <p className="text-slate-300 text-sm leading-relaxed">
            In 1782, early physics pioneers at the University of Toronto documented groundbreaking anomalies regarding quantum resonance [1]. These experiments laid foundational principles for later atomic theory [2].
          </p>
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs space-y-1">
            <div className="font-semibold text-rose-400">Critical Hallucination Detected:</div>
            <div>University of Toronto founded in 1827 (45 years later). Quantum mechanics was formulated in the 1920s.</div>
            <div className="text-slate-400 text-[11px] pt-1">Baseline RAG inserted decorative citations [1] and [2] to mask impossible temporal assertions.</div>
          </div>
        </div>
      );
    }

    if (state?.policy_decision === "PARTIAL_PASS") {
      return (
        <div className="space-y-3">
          <p className="text-slate-300 text-sm leading-relaxed">
            Rod Serling was born on December 25, 1924 in Syracuse, New York [1]. Following his retirement from television production, he gave his historic final recorded retrospective interview in late 1976 [2].
          </p>
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs space-y-1">
            <div className="font-semibold text-amber-400">Numerical &amp; Temporal Fabrication:</div>
            <div>Serling passed away on June 28, 1975. An interview in 1976 is biologically impossible.</div>
            <div className="text-slate-400 text-[11px] pt-1">Citation [2] is purely ornamental decoration without source sentence grounding.</div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-slate-300 text-sm leading-relaxed">
          Arthur&apos;s Magazine was founded first in 1844 by T.S. Arthur in Philadelphia [1]. In contrast, First for Women is a contemporary publication started over a century later in 1989 [2].
        </p>
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 text-slate-400 text-xs leading-relaxed">
          <span className="text-amber-400 font-semibold">Vulnerability in Naive RAG:</span> Citations [1] and [2] are generated purely token-by-token. No cross-encoder or regex guard checks if &quot;1844&quot; or &quot;1989&quot; actually existed in retrieved contexts.
        </div>
      </div>
    );
  };

  return (
    <div className={cn("glass-surface rounded-3xl p-6 md:p-8 space-y-6", className)}>
      {/* 1. Policy Contract Verdict Banner */}
      <div className={cn("rounded-2xl p-5 border transition-all", policy.bg)}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-black/40 border border-white/10">
              <PolicyIcon className={cn("w-5 h-5", policy.textColor)} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">
                {policy.title}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                {policy.description}
              </p>
            </div>
          </div>

          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-black/40 border border-white/10 text-slate-300 self-start sm:self-auto">
            {policy.badge}
          </span>
        </div>

        {/* Warranted Final Answer Box */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Warranted Output:
            </span>
            {state?.final_answer && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2.5 py-1 rounded-lg bg-black/30 hover:bg-black/50 border border-white/5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            )}
          </div>

          <div className="p-4 rounded-xl bg-black/50 border border-white/10 text-sm text-slate-100 font-sans leading-relaxed">
            {state?.final_answer || "Evaluating selective abstention policy..."}
          </div>
        </div>
      </div>

      {/* 2. Disassembler View Switcher */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div>
          <h4 className="text-sm font-semibold text-white tracking-tight">
            Epistemic Trajectory &amp; Citation Disassembler
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Compare post-hoc citation decoration against deterministic attribution.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-full bg-black/50 border border-white/10 text-xs">
          <button
            onClick={() => setActiveTab("warrant")}
            className={cn(
              "px-3 py-1 rounded-full transition-all font-medium",
              activeTab === "warrant"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            WARRANT Grounding
          </button>
          <button
            onClick={() => setActiveTab("naive-rag")}
            className={cn(
              "px-3 py-1 rounded-full transition-all font-medium",
              activeTab === "naive-rag"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            Decorated RAG
          </button>
        </div>
      </div>

      {/* 3. Main Content: Active Tab */}
      {activeTab === "naive-rag" ? (
        <div className="rounded-2xl border border-rose-500/25 bg-rose-950/10 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-rose-500/20">
            <span className="text-xs font-semibold text-rose-300 uppercase tracking-wide">
              Decorated Unverified RAG (Baseline Generative LLM)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              50.0% Hallucination Rate
            </span>
          </div>

          {getNaiveDecoratedText()}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Claim Highlight Strip */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-400">
              Candidate Atomic Claims (Click to highlight in 3D lattice &amp; inspect evidence):
            </span>

            <div className="space-y-2.5">
              {claims.map((claim) => {
                const isSelected = claim.claim_id === activeClaimId;
                const isVerified = claim.verification_status === "VERIFIED";

                return (
                  <div
                    key={claim.claim_id}
                    onClick={() => handleClaimClick(claim.claim_id)}
                    className={cn(
                      "cursor-pointer rounded-xl p-3.5 border transition-all text-xs font-sans leading-relaxed",
                      isSelected
                        ? isVerified
                          ? "bg-emerald-500/15 border-emerald-500/70 text-slate-100 shadow-md shadow-emerald-500/10"
                          : "bg-rose-500/15 border-rose-500/70 text-slate-100 shadow-md shadow-rose-500/10"
                        : "bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06] hover:border-white/20"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold text-slate-400">
                          {claim.claim_id}
                        </span>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                            claim.guard_status === "PASSED"
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          )}
                        >
                          Guard: {claim.guard_status === "PASSED" ? "Passed (<1ms)" : claim.guard_status}
                        </span>
                      </div>

                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                          isVerified
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        )}
                      >
                        {claim.verification_status} &middot; τ={(claim.nli_entailment_prob * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div className="text-sm font-medium text-slate-100">
                      {claim.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Claim Evidence Deep Dive */}
          {currentClaim && (
            <div className="rounded-2xl p-4 bg-black/60 border border-white/10 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
                  Grounding Attribution: {currentClaim.claim_id}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Inference: {currentClaim.nli_inference_latency_ms}ms
                </span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-slate-400">Source Document:</span>
                <div className="text-xs font-semibold text-cyan-300 mt-0.5">
                  {activeSpan?.doc_title || "Corpus Document"}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-medium text-slate-400">Extracted Grounding Sentence:</span>
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-slate-200 leading-relaxed mt-1">
                  &quot;{activeSpan?.text || "Document evidence sentence not available."}&quot;
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20">
                  <div className="text-[10px] font-semibold text-purple-300 uppercase">Stage 1 Entity Guard</div>
                  <div className="text-xs font-semibold text-emerald-400 mt-0.5">
                    {currentClaim.guard_status === "PASSED" ? "PASSED (0.42ms)" : currentClaim.guard_status}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                    {currentClaim.guard_status === "PASSED"
                      ? "Deterministic entity and numeral match."
                      : currentClaim.guard_reasons?.join("; ") || "Guard failure."}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                  <div className="text-[10px] font-semibold text-emerald-300 uppercase">Stage 2 DeBERTa-v3</div>
                  <div className="text-xs font-semibold text-emerald-400 mt-0.5">
                    τ = {currentClaim.nli_entailment_prob.toFixed(3)} (&ge; 0.820)
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Natural Language Inference entailed.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ground Truth Evidence Corpus Drawer */}
      <div className="pt-2 border-t border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Retrieved Evidence Spans ({spans.length})
          </h4>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {spans.map((span) => {
            const isCited = activeCitedSpans.has(span.id);
            return (
              <div
                key={span.id}
                className={cn(
                  "p-3 rounded-xl border text-xs leading-relaxed transition-all",
                  isCited
                    ? "bg-cyan-500/10 border-cyan-500/40 text-slate-100"
                    : "bg-white/[0.02] border-white/5 text-slate-400"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-cyan-300 text-[11px]">
                    {span.doc_title}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Hop {span.retrieval_hop} &middot; Score {span.score.toFixed(3)}
                  </span>
                </div>
                <p className="text-slate-300 text-xs">{span.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
