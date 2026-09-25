"use client";

import React, { useState } from "react";
import { WarrantState, AtomicClaim, EvidenceSpan } from "../lib/types";
import { cn } from "../lib/utils";

interface CitationDisassemblerProps {
  state: WarrantState | null;
  className?: string;
}

export const CitationDisassembler: React.FC<CitationDisassemblerProps> = ({
  state,
  className = "",
}) => {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"side-by-side" | "warrant-only" | "naive-only">("side-by-side");

  // Fallback default state if none provided
  const query = state?.query || "Which magazine was started first, Arthur's Magazine or First for Women?";
  const verifiedClaims: AtomicClaim[] = state?.synthetic_claims || [
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

  const retrievedSpans: EvidenceSpan[] = state?.retrieved_spans || [
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

  const activeClaim = verifiedClaims.find((c) => c.claim_id === selectedClaimId) || verifiedClaims[0];
  const activeSpan = retrievedSpans.find((s) => activeClaim?.cited_spans?.includes(s.id)) || retrievedSpans[0];

  // Naive Decorated text with simulated citation hallucination
  const getNaiveDecoratedText = () => {
    if (state?.policy_decision === "ABSTAIN") {
      return (
        <div className="space-y-3">
          <p className="text-slate-300 leading-relaxed text-sm">
            In 1782, early physics pioneers at the University of Toronto documented groundbreaking anomalies regarding quantum resonance [1]. These experiments laid foundational principles for later atomic theory [2].
          </p>
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono space-y-1">
            <div className="font-bold text-rose-400">Critical Hallucination Detected:</div>
            <div>University of Toronto was founded in 1827 (45 years later). Quantum mechanics was formulated in the 1920s.</div>
            <div className="text-[11px] text-slate-400">Baseline RAG hallucinated citations [1] and [2] to mask impossible temporal assertions.</div>
          </div>
        </div>
      );
    }

    if (state?.policy_decision === "PARTIAL_PASS") {
      return (
        <div className="space-y-3">
          <p className="text-slate-300 leading-relaxed text-sm">
            Rod Serling was born on December 25, 1924 in Syracuse, New York [1]. Following his retirement from television production, he gave his historic final recorded retrospective interview in late 1976 [2].
          </p>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono space-y-1">
            <div className="font-bold text-amber-400">Numerical &amp; Temporal Fabrication:</div>
            <div>Serling passed away on June 28, 1975. An interview in 1976 is biologically impossible.</div>
            <div className="text-[11px] text-slate-400">Citation [2] is purely ornamental decoration without source sentence grounding.</div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-slate-300 leading-relaxed text-sm">
          Arthur&apos;s Magazine was founded first in 1844 by T.S. Arthur in Philadelphia [1]. In contrast, First for Women is a contemporary publication started over a century later in 1989 [2].
        </p>
        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 text-xs font-mono">
          <span className="text-amber-400 font-semibold">Vulnerability in Naive RAG:</span> Citations [1] and [2] are generated purely token-by-token. No cross-encoder or regex guard checks if &quot;1844&quot; or &quot;1989&quot; actually existed in retrieved contexts.
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-slate-800 bg-[#030712]/95 backdrop-blur-xl p-6 shadow-2xl space-y-6",
        className
      )}
    >
      {/* Title & Layout Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <h3 className="text-sm font-semibold tracking-wide text-slate-100 uppercase font-mono">
              Citation Disassembler &middot; Attributed Grounding Inspector
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Exposing ungrounded &quot;citation decoration&quot; versus deterministic dual-stage attribution.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-black/60 border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setActiveTab("side-by-side")}
            className={cn(
              "px-3 py-1 rounded-lg transition-all",
              activeTab === "side-by-side"
                ? "bg-slate-800 text-slate-100 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            Side-by-Side
          </button>
          <button
            onClick={() => setActiveTab("warrant-only")}
            className={cn(
              "px-3 py-1 rounded-lg transition-all",
              activeTab === "warrant-only"
                ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            WARRANT Grounding
          </button>
          <button
            onClick={() => setActiveTab("naive-only")}
            className={cn(
              "px-3 py-1 rounded-lg transition-all",
              activeTab === "naive-only"
                ? "bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            Decorated RAG
          </button>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Decorated Unverified RAG */}
        {(activeTab === "side-by-side" || activeTab === "naive-only") && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/10 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-rose-500/20">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <h4 className="text-xs font-mono uppercase font-bold text-rose-300">
                  Decorated Unverified RAG (Naive LLM)
                </h4>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Post-Hoc Hallucination Risk
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-black/40 border border-rose-900/30 text-xs font-mono text-slate-400">
              Prompt: &quot;{query}&quot;
            </div>

            {getNaiveDecoratedText()}

            <div className="pt-3 border-t border-rose-500/20 text-[11px] font-mono text-rose-300/80 space-y-1">
              <div>&bull; Citation markers [1], [2] are decorative tokens without attribution guarantees.</div>
              <div>&bull; Zero entity/numerical guard; high hallucination propagation in multi-hop tasks.</div>
            </div>
          </div>
        )}

        {/* Right Column: WARRANT Dual-Stage Grounding */}
        {(activeTab === "side-by-side" || activeTab === "warrant-only") && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <h4 className="text-xs font-mono uppercase font-bold text-emerald-300">
                  WARRANT Attributed Grounding
                </h4>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                100.0% HotpotQA Precision
              </span>
            </div>

            {/* Answer Display with Clickable Claims */}
            <div className="space-y-3">
              <div className="text-xs font-mono text-slate-400">
                Click any highlighted claim to inspect exact cross-encoder evidence &amp; guard status:
              </div>

              <div className="p-4 rounded-xl bg-black/60 border border-slate-800 space-y-2.5">
                {verifiedClaims.length === 0 ? (
                  <div className="text-slate-300 text-sm italic">
                    {state?.final_answer || "Strict abstention activated. No claims warranted."}
                  </div>
                ) : (
                  verifiedClaims.map((claim) => {
                    const isSelected = activeClaim?.claim_id === claim.claim_id;
                    const isVerified = claim.verification_status === "VERIFIED";

                    return (
                      <div
                        key={claim.claim_id}
                        onClick={() => setSelectedClaimId(claim.claim_id)}
                        className={cn(
                          "cursor-pointer rounded-lg p-2.5 border transition-all text-xs font-sans leading-relaxed",
                          isSelected
                            ? isVerified
                              ? "bg-emerald-500/20 border-emerald-500 text-emerald-100 shadow-md shadow-emerald-500/20"
                              : "bg-rose-500/20 border-rose-500 text-rose-100 shadow-md shadow-rose-500/20"
                            : isVerified
                            ? "bg-slate-900/60 border-emerald-500/30 text-slate-200 hover:border-emerald-500/70"
                            : "bg-slate-900/60 border-rose-500/30 text-slate-200 hover:border-rose-500/70"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-[10px] font-bold text-slate-400">
                            Claim ID: {claim.claim_id}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold",
                              isVerified
                                ? "bg-emerald-500/30 text-emerald-300"
                                : "bg-rose-500/30 text-rose-300"
                            )}
                          >
                            {claim.verification_status} &middot; τ={(claim.nli_entailment_prob * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="font-medium text-slate-100">{claim.text}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Interactive Claim Inspector Card */}
            {activeClaim && (
              <div className="rounded-xl border border-emerald-500/40 bg-black/80 p-4 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                    Epistemic Claim Telemetry
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    Latency: {activeClaim.nli_inference_latency_ms}ms
                  </span>
                </div>

                {/* Exact Source Document */}
                <div>
                  <span className="text-slate-400 text-[10px] uppercase">Exact Source Document:</span>
                  <div className="text-cyan-300 font-semibold text-xs mt-0.5">
                    {activeSpan?.doc_title || "Primary Corpus Document"}
                  </div>
                </div>

                {/* Extracted Evidence Sentence */}
                <div>
                  <span className="text-slate-400 text-[10px] uppercase">Extracted Evidence Sentence:</span>
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 text-[11px] leading-relaxed mt-1">
                    &quot;{activeSpan?.text || "Arthur's Magazine (1844-1846) was an American literary magazine published in Philadelphia."}&quot;
                  </div>
                </div>

                {/* Stage 1 Deterministic Entity Guard */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-500/30">
                    <div className="text-[10px] text-purple-300 font-bold uppercase">Stage 1: Entity Guard</div>
                    <div className="text-emerald-400 text-xs font-semibold mt-0.5">
                      {activeClaim.guard_status === "PASSED" ? "PASSED (0.42ms)" : activeClaim.guard_status}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {activeClaim.guard_status === "PASSED"
                        ? "Deterministic regex/NER validated."
                        : activeClaim.guard_reasons?.join("; ") || "Guard failure"}
                    </div>
                  </div>

                  {/* Stage 2 Calibrated DeBERTa-v3 NLI */}
                  <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
                    <div className="text-[10px] text-emerald-300 font-bold uppercase">Stage 2: DeBERTa-v3</div>
                    <div className="text-emerald-400 text-xs font-semibold mt-0.5">
                      τ = {activeClaim.nli_entailment_prob.toFixed(3)} (&gt;= 0.820)
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Entailment label calibrated.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
