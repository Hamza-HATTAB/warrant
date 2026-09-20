"use client";

import React, { useState } from "react";
import { ShieldCheck, AlertTriangle, ShieldX, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { WarrantState } from "../lib/types";

interface PolicyHUDProps {
  state: WarrantState | null;
  isLoading: boolean;
}

export const PolicyHUD: React.FC<PolicyHUDProps> = ({ state, isLoading }) => {
  const [copied, setCopied] = useState(false);
  const [showPruned, setShowPruned] = useState(false);

  if (!state && !isLoading) return null;

  const decision = state?.policy_decision;
  const prunedClaims = state ? [...state.refuted_claims, ...state.unverifiable_claims] : [];

  const handleCopy = () => {
    if (state?.final_answer) {
      navigator.clipboard.writeText(state.final_answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getTheme = () => {
    switch (decision) {
      case "FULL_PASS":
        return {
          border: "border-terminal-green/50",
          bg: "bg-terminal-green/5",
          glow: "glow-emerald",
          icon: ShieldCheck,
          iconColor: "text-terminal-green",
          badgeBg: "bg-terminal-green/20 text-terminal-greenBright border-terminal-green/40",
          title: "CONTRACT: FULL_PASS (100% Attributed)",
        };
      case "PARTIAL_PASS":
        return {
          border: "border-terminal-amber/50",
          bg: "bg-terminal-amber/5",
          glow: "glow-amber",
          icon: AlertTriangle,
          iconColor: "text-terminal-amber",
          badgeBg: "bg-terminal-amber/20 text-terminal-amber border-terminal-amber/40",
          title: "CONTRACT: PARTIAL_PASS (Graceful Recovery)",
        };
      case "ABSTAIN":
        return {
          border: "border-terminal-rose/50",
          bg: "bg-terminal-rose/5",
          glow: "glow-rose",
          icon: ShieldX,
          iconColor: "text-terminal-rose",
          badgeBg: "bg-terminal-rose/20 text-terminal-rose border-terminal-rose/40",
          title: "CONTRACT: STRICT ABSTENTION (Zero Hallucination Refusal)",
        };
      default:
        return {
          border: "border-panel-border",
          bg: "bg-panel",
          glow: "",
          icon: ShieldCheck,
          iconColor: "text-slate-400",
          badgeBg: "bg-slate-800 text-slate-400 border-slate-700",
          title: "CONTRACT: EVALUATING...",
        };
    }
  };

  const theme = getTheme();
  const Icon = theme.icon;

  return (
    <div className={`rounded-lg border ${theme.border} ${theme.bg} ${theme.glow} p-5 transition-all`}>
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-panel-border/60">
        <div className="flex items-center gap-3">
          <Icon className={`w-6 h-6 ${theme.iconColor}`} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-sm font-bold text-slate-100">{theme.title}</h2>
              {decision && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${theme.badgeBg}`}>
                  {decision}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              {state?.policy_reason || (isLoading ? "LangGraph DAG executing verification pipeline..." : "")}
            </p>
          </div>
        </div>

        {/* Execution Telemetry metrics */}
        {state && (
          <div className="flex items-center gap-3 font-mono text-[11px] self-end sm:self-center">
            <div className="text-slate-400">
              Iteration: <span className="text-slate-200 font-semibold">{state.iteration}</span>
            </div>
            <div className="text-slate-400">
              Retries: <span className="text-slate-200 font-semibold">{state.retry_count}</span>
            </div>
            <div className="text-slate-400">
              Verified:{" "}
              <span className="text-terminal-green font-semibold">{state.verified_claims.length}</span>
            </div>
            {prunedClaims.length > 0 && (
              <div className="text-slate-400">
                Pruned:{" "}
                <span className="text-terminal-rose font-semibold">{prunedClaims.length}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Final Assembled Answer Content */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Warranted Synthesis Output:
          </span>
          {state?.final_answer && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-terminal-green" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>

        <div className="bg-[#080c0a]/90 rounded border border-panel-border p-4 font-mono text-sm leading-relaxed text-slate-100">
          {isLoading && !state?.final_answer ? (
            <div className="flex items-center gap-2 text-slate-500 italic">
              <span className="inline-block w-2 h-2 rounded-full bg-terminal-green animate-ping" />
              Assembling warranted response from verified claim attributions...
            </div>
          ) : (
            <div>{state?.final_answer || "No response assembled."}</div>
          )}
        </div>
      </div>

      {/* Pruned Claims Drawer (For PARTIAL_PASS or ABSTAIN) */}
      {prunedClaims.length > 0 && (
        <div className="mt-3 pt-3 border-t border-panel-border/60">
          <button
            type="button"
            onClick={() => setShowPruned(!showPruned)}
            className="flex items-center justify-between w-full text-xs font-mono text-terminal-rose hover:text-terminal-rose/80 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                Pruned Non-Entailed Claims ({prunedClaims.length}) &mdash; Audit Log
              </span>
            </div>
            {showPruned ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showPruned && (
            <div className="mt-2 space-y-2">
              {prunedClaims.map((claim) => (
                <div
                  key={claim.claim_id}
                  className="p-2.5 rounded bg-terminal-rose/10 border border-terminal-rose/30 text-xs font-mono"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-terminal-rose">{claim.claim_id}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-terminal-rose/20 text-terminal-rose border border-terminal-rose/40 font-bold">
                      {claim.guard_status !== "PASSED" ? claim.guard_status : claim.verification_status}
                    </span>
                  </div>
                  <p className="text-slate-300 mb-1">{claim.text}</p>
                  {claim.guard_reasons.length > 0 && (
                    <div className="text-[11px] text-terminal-rose/90">
                      Reason: {claim.guard_reasons.join(", ")}
                    </div>
                  )}
                  {claim.guard_status === "PASSED" && (
                    <div className="text-[11px] text-slate-400">
                      DeBERTa NLI: P(Entail) = {(claim.nli_entailment_prob * 100).toFixed(1)}% &lt; threshold 82.0%
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
