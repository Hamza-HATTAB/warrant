"use client";

import React from "react";
import { X, Search, Split, ShieldAlert, Cpu, Award, ArrowRight, CheckCircle, AlertTriangle } from "lucide-react";
import { WarrantState } from "../lib/types";

interface StepInspectorProps {
  stepNumber: number;
  onClose: () => void;
  state: WarrantState | null;
}

export const StepInspector: React.FC<StepInspectorProps> = ({ stepNumber, onClose, state }) => {
  if (stepNumber === 0) return null;

  const getStepData = () => {
    switch (stepNumber) {
      case 1:
        return {
          title: "Step 01: Multi-Hop Hybrid Retrieval & FlashRank Reranking",
          icon: Search,
          badge: "Information Retrieval Layer",
          badgeColor: "text-cyan-400 bg-cyan-950/50 border-cyan-800",
          summary:
            "Multi-hop questions cannot be answered by a single document lookup. Warrant decomposes the inquiry into an anchor search (Hop 1) followed by a bridged attribute search (Hop 2).",
          howItWorks: [
            "Dense Embeddings: BAAI/bge-large-en-v1.5 encodes semantic intent into 1024-dimensional vectors.",
            "Sparse Lexical: BM25 indexes exact named entities and dates.",
            "Reciprocal Rank Fusion (RRF k=60): Merges dense and sparse ranks with zero score scale distortion.",
            "FlashRank CPU Cross-Encoder: MiniLM reranks top-10 candidates into the top-3 most relevant sentence spans.",
          ],
          telemetry: `${state?.retrieved_spans.length || 0} total evidence spans retrieved across 2 hops.`,
        };
      case 2:
        return {
          title: "Step 02: Structured Atomic Claim Decomposition",
          icon: Split,
          badge: "LLM Synthesis Layer",
          badgeColor: "text-emerald-400 bg-emerald-950/50 border-emerald-800",
          summary:
            "Instead of verifying entire paragraphs as opaque text, Warrant forces Gemma 3 12B to decompose the answer into atomic, verifiable statements bound to specific cited evidence spans.",
          howItWorks: [
            "Local Unified LLM: Gemma 3 12B Unified running via Ollama on your local RTX 4060 GPU.",
            "Pydantic JSON Grammar: Constrains LLM generation to an explicit array of atomic claims.",
            "Span Binding: Each claim must cite one or more exact evidence span IDs (e.g. [arthur_mag_s0]).",
            "Hallucinated Span Filtering: Non-existent span IDs are instantly detected and discarded.",
          ],
          telemetry: `${state?.synthetic_claims.length || 0} atomic claims synthesized.`,
        };
      case 3:
        return {
          title: "Step 03: Stage 1 Deterministic Guard Rails (<1ms)",
          icon: ShieldAlert,
          badge: "Deterministic Verification",
          badgeColor: "text-amber-400 bg-amber-950/50 border-amber-800",
          summary:
            "Neural networks can experience soft semantic drift on dates and arithmetic. Stage 1 executes hard deterministic regex filters in less than 1 millisecond.",
          howItWorks: [
            "Numerical Attribution: Every digit, year, and quantity in the claim must exist verbatim in the cited span.",
            "Entity Grounding: Capitalized named entities are verified against the source text.",
            "Short-Circuit Optimization: Claims that fail the guard are immediately refuted without burning CPU cycles on transformer attention.",
            "Zero GPU Overhead: Executes purely in Python set operations with 0 MB VRAM.",
          ],
          telemetry: `${state?.refuted_claims.filter((c) => c.guard_status !== "PASSED").length || 0} claims intercepted by Stage 1 Guard.`,
        };
      case 4:
        return {
          title: "Step 04: Stage 2 Calibrated DeBERTa-v3 NLI",
          icon: Cpu,
          badge: "Transformer Verification",
          badgeColor: "text-lime-400 bg-lime-950/50 border-lime-800",
          summary:
            "DeBERTa-v3 cross-encoder evaluates directional entailment (Premise => Hypothesis) using full bidirectional cross-attention layers.",
          howItWorks: [
            "Cross-Attention: Concatenates Premise [SEP] Hypothesis, attending every token to every token simultaneously.",
            "Temperature Calibration: Output logits are scaled by T=1.14 on validation data to minimize Expected Calibration Error (ECE).",
            "Acceptance Threshold: Only claims with calibrated P(Entailment) >= 0.820 are classified as VERIFIED.",
            "CPU Offloading: Runs on multi-threaded CPU PyTorch, completely preserving RTX 4060 VRAM for Gemma 3 12B.",
          ],
          telemetry: `${state?.verified_claims.length || 0} claims verified with P(Entailment) >= 0.82.`,
        };
      case 5:
        return {
          title: "Step 05: 3-State Contractual Abstention Policy",
          icon: Award,
          badge: "Selective Abstention Policy Contract",
          badgeColor: "text-emerald-400 bg-emerald-950/50 border-emerald-800",
          summary:
            "Standard RAG forces an answer even when ungrounded. Warrant enforces a mathematically sound 3-state contract enforcing selective abstention whenever candidate assertions fail the calibrated NLI threshold (tau >= 0.82), mitigating unsupported statements in high-consequence domains.",
          howItWorks: [
            "FULL_PASS: All candidate claims pass Stage 1 and Stage 2. Full warranted answer delivered.",
            "PARTIAL_PASS: At least one claim verified, but ungrounded claims detected. Non-entailed claims pruned, verified core delivered with audit notice.",
            "ABSTAIN: Zero valid spans retrieved or zero claims verified. System explicitly refuses to extrapolate beyond verified evidence.",
          ],
          telemetry: `Current Contract Verdict: ${state?.policy_decision || "Pending"}`,
        };
      default:
        return null;
    }
  };

  const data = getStepData();
  if (!data) return null;

  const Icon = data.icon;

  return (
    <div className="glass-panel-elevated rounded-2xl p-5 md:p-6 border border-emerald-500/30 shadow-2xl relative">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 rounded-lg bg-black/40 border border-slate-800 text-slate-400 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-xl bg-black/50 border border-slate-800">
          <Icon className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white">{data.title}</h3>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${data.badgeColor}`}>
              {data.badge}
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">{data.summary}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-800">
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Technical Architecture:
          </span>
          <ul className="space-y-2">
            {data.howItWorks.map((item, i) => (
              <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-black/50 rounded-xl p-4 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Live Trajectory Metrics:
            </span>
            <p className="text-sm font-semibold text-emerald-300 mt-2 font-mono">
              {data.telemetry}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500">
            Protected by Warrant Immutable State Machine &middot; LangGraph Engine
          </div>
        </div>
      </div>
    </div>
  );
};
