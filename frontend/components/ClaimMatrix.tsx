"use client";

import React from "react";
import { CheckCircle, XCircle, AlertCircle, Shield, Cpu, Gauge } from "lucide-react";
import { AtomicClaim } from "../lib/types";

interface ClaimMatrixProps {
  claims: AtomicClaim[];
  hoveredClaimId: string | null;
  setHoveredClaimId: (id: string | null) => void;
  selectedClaimId: string | null;
  setSelectedClaimId: (id: string | null) => void;
}

export const ClaimMatrix: React.FC<ClaimMatrixProps> = ({
  claims,
  hoveredClaimId,
  setHoveredClaimId,
  selectedClaimId,
  setSelectedClaimId,
}) => {
  if (!claims || claims.length === 0) {
    return (
      <div className="terminal-border rounded-lg p-5 text-center font-mono text-xs text-slate-500">
        No claims synthesized yet. Waiting for LLM structured claim decomposition...
      </div>
    );
  }

  const getStatusBadge = (claim: AtomicClaim) => {
    switch (claim.verification_status) {
      case "VERIFIED":
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-terminal-green/20 text-terminal-greenBright border border-terminal-green/40">
            <CheckCircle className="w-3 h-3" />
            VERIFIED
          </span>
        );
      case "REFUTED":
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-terminal-rose/20 text-terminal-rose border border-terminal-rose/40">
            <XCircle className="w-3 h-3" />
            REFUTED
          </span>
        );
      case "UNVERIFIABLE":
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-terminal-amber/20 text-terminal-amber border border-terminal-amber/40">
            <AlertCircle className="w-3 h-3" />
            UNVERIFIABLE
          </span>
        );
    }
  };

  const getGuardBadge = (claim: AtomicClaim) => {
    if (claim.guard_status === "PASSED") {
      return (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-terminal-green/10 text-terminal-green border border-terminal-green/30 flex items-center gap-1">
          <Shield className="w-2.5 h-2.5" />
          Guard: Passed (&lt;1ms)
        </span>
      );
    }
    return (
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-terminal-rose/10 text-terminal-rose border border-terminal-rose/30 flex items-center gap-1">
        <Shield className="w-2.5 h-2.5" />
        Guard: {claim.guard_status}
      </span>
    );
  };

  return (
    <div className="terminal-border rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-terminal-lime" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            Claim-Level Dual-Stage Verification Matrix
          </h3>
        </div>
        <div className="font-mono text-[11px] text-slate-400">
          Threshold &tau; = <span className="text-terminal-lime font-semibold">0.820</span> &middot;{" "}
          <span className="text-terminal-green">{claims.filter((c) => c.verification_status === "VERIFIED").length}</span>
          /{claims.length} Verified
        </div>
      </div>

      {/* Claims List */}
      <div className="space-y-3">
        {claims.map((claim) => {
          const isHovered = hoveredClaimId === claim.claim_id;
          const isSelected = selectedClaimId === claim.claim_id;
          const entailProb = Math.min(1, Math.max(0, claim.nli_entailment_prob));
          const entailPercent = (entailProb * 100).toFixed(1);
          const isOverThreshold = entailProb >= 0.82;

          return (
            <div
              key={claim.claim_id}
              onMouseEnter={() => setHoveredClaimId(claim.claim_id)}
              onMouseLeave={() => setHoveredClaimId(null)}
              onClick={() => setSelectedClaimId(isSelected ? null : claim.claim_id)}
              className={`rounded border p-3.5 transition-all cursor-pointer ${
                isSelected || isHovered
                  ? "border-terminal-green bg-panel-elevated ring-1 ring-terminal-green/30"
                  : "border-panel-border bg-panel hover:border-panel-borderBright"
              }`}
            >
              {/* Claim Top Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-terminal-lime">
                    [{claim.claim_id}]
                  </span>
                  {getGuardBadge(claim)}
                </div>
                <div>{getStatusBadge(claim)}</div>
              </div>

              {/* Claim Text */}
              <p className="font-sans text-sm text-slate-100 mb-3 leading-relaxed">
                {claim.text}
              </p>

              {/* Cited Evidence Spans Tags */}
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <span className="text-[10px] uppercase font-mono text-slate-500">Cited Spans:</span>
                {claim.cited_spans.length > 0 ? (
                  claim.cited_spans.map((spanId) => (
                    <span
                      key={spanId}
                      className="px-1.5 py-0.5 rounded bg-[#080c0a] border border-panel-border text-[11px] font-mono text-terminal-cyan"
                    >
                      {spanId}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] font-mono text-terminal-rose">None cited (Ungrounded)</span>
                )}
              </div>

              {/* Stage 2 Calibrated DeBERTa-v3 NLI Score Bar */}
              <div className="bg-[#080c0a] rounded p-2.5 border border-panel-border">
                <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Cpu className="w-3 h-3 text-terminal-green" />
                    Calibrated DeBERTa-v3 NLI Confidence:
                  </span>
                  <span
                    className={`font-semibold ${
                      isOverThreshold ? "text-terminal-greenBright" : "text-terminal-rose"
                    }`}
                  >
                    P(Entailment) = {entailPercent}%
                  </span>
                </div>

                {/* Progress Bar with 82% threshold marker */}
                <div className="relative w-full h-2 rounded bg-slate-900 overflow-hidden border border-panel-border">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isOverThreshold
                        ? "bg-gradient-to-r from-terminal-green/80 to-terminal-greenBright"
                        : "bg-gradient-to-r from-terminal-rose/80 to-terminal-rose"
                    }`}
                    style={{ width: `${entailPercent}%` }}
                  />
                  {/* Threshold mark at 82% */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-terminal-lime z-10"
                    style={{ left: "82%" }}
                    title="Verification Decision Threshold (0.82)"
                  />
                </div>

                {/* Granular Probabilities Breakdown */}
                <div className="flex items-center justify-between mt-2 text-[10px] font-mono text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="text-terminal-green">Entail: {(claim.nli_entailment_prob * 100).toFixed(0)}%</span>
                    <span className="text-slate-400">Neutral: {(claim.nli_neutral_prob * 100).toFixed(0)}%</span>
                    <span className="text-terminal-rose">Contradict: {(claim.nli_contradiction_prob * 100).toFixed(0)}%</span>
                  </div>
                  <div className="text-slate-500">
                    Latency: {claim.nli_inference_latency_ms.toFixed(0)}ms (CPU)
                  </div>
                </div>
              </div>

              {/* Guard failure diagnostic if applicable */}
              {claim.guard_reasons.length > 0 && (
                <div className="mt-2 text-[11px] font-mono text-terminal-rose bg-terminal-rose/10 p-2 rounded border border-terminal-rose/30">
                  Guard Intercept: {claim.guard_reasons.join("; ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
