"use client";

import React from "react";
import { Search, Split, ShieldAlert, Cpu, Award, CheckCircle2, Clock } from "lucide-react";
import { WarrantState, PolicyDecision } from "../lib/types";

interface PipelineStepperProps {
  state: WarrantState | null;
  isLoading: boolean;
  activeStep: number;
  setActiveStep: (step: number) => void;
}

export const PipelineStepper: React.FC<PipelineStepperProps> = ({
  state,
  isLoading,
  activeStep,
  setActiveStep,
}) => {
  const steps = [
    {
      id: 1,
      title: "Multi-Hop Retrieval",
      subtitle: "Qdrant Hybrid RRF + FlashRank",
      icon: Search,
      isDone: (state?.retrieved_spans?.length || 0) > 0,
      badge: `${state?.retrieved_spans?.length || 0} Spans`,
      badgeColor: "text-cyan-400 bg-cyan-950/40 border-cyan-800",
    },
    {
      id: 2,
      title: "Claim Decomposition",
      subtitle: "Gemma 3 12B Structured Extraction",
      icon: Split,
      isDone: (state?.synthetic_claims?.length || 0) > 0,
      badge: `${state?.synthetic_claims?.length || 0} Claims`,
      badgeColor: "text-emerald-400 bg-emerald-950/40 border-emerald-800",
    },
    {
      id: 3,
      title: "Stage 1 Guard",
      subtitle: "<1ms Numerical & Entity Check",
      icon: ShieldAlert,
      isDone: (state?.synthetic_claims?.length || 0) > 0,
      badge: state?.refuted_claims?.some((c) => c.guard_status !== "PASSED")
        ? "Intercepted"
        : "Passed <1ms",
      badgeColor: state?.refuted_claims?.some((c) => c.guard_status !== "PASSED")
        ? "text-rose-400 bg-rose-950/40 border-rose-800"
        : "text-emerald-400 bg-emerald-950/40 border-emerald-800",
    },
    {
      id: 4,
      title: "Stage 2 NLI Verifier",
      subtitle: "Calibrated DeBERTa-v3 on CPU",
      icon: Cpu,
      isDone: (state?.verified_claims?.length || 0) > 0 || (state?.refuted_claims?.length || 0) > 0,
      badge: `tau >= 0.82`,
      badgeColor: "text-lime-400 bg-lime-950/40 border-lime-800",
    },
    {
      id: 5,
      title: "3-State Contract",
      subtitle: "Guaranteed Attribution Verdict",
      icon: Award,
      isDone: Boolean(state?.policy_decision),
      badge: state?.policy_decision || "Pending",
      badgeColor:
        state?.policy_decision === "FULL_PASS"
          ? "text-emerald-400 bg-emerald-950/40 border-emerald-800 font-bold"
          : state?.policy_decision === "PARTIAL_PASS"
          ? "text-amber-400 bg-amber-950/40 border-amber-800 font-bold"
          : state?.policy_decision === "ABSTAIN"
          ? "text-rose-400 bg-rose-950/40 border-rose-800 font-bold"
          : "text-slate-400 bg-slate-900 border-slate-700",
    },
  ];

  return (
    <div className="glass-panel rounded-2xl p-4 shadow-xl border border-emerald-500/10">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Interactive Verification Pipeline:
          </span>
          <span className="text-[11px] text-slate-400">
            Click any step to inspect its inputs, reasoning, and outputs
          </span>
        </div>
        <button
          type="button"
          onClick={() => setActiveStep(0)}
          className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
            activeStep === 0
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          View Full Studio
        </button>
      </div>

      {/* Stepper Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        {steps.map((step) => {
          const Icon = step.icon;
          const isSelected = activeStep === step.id;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStep(isSelected ? 0 : step.id)}
              className={`text-left p-3 rounded-xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? "bg-emerald-950/60 border-emerald-400 ring-2 ring-emerald-500/20 shadow-lg glow-emerald"
                  : step.isDone
                  ? "bg-black/40 border-slate-800 hover:border-emerald-500/30 hover:bg-emerald-950/20"
                  : "bg-black/20 border-slate-900 opacity-60"
              }`}
            >
              {/* Step Number & Status Indicator */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[11px] font-mono font-bold text-slate-400">
                  STEP 0{step.id}
                </span>
                {step.isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : isLoading ? (
                  <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-800" />
                )}
              </div>

              {/* Title & Icon */}
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`w-4 h-4 ${isSelected ? "text-emerald-300" : "text-slate-400"}`} />
                <span className="text-xs font-semibold text-white tracking-tight leading-snug">
                  {step.title}
                </span>
              </div>

              <p className="text-[10px] text-slate-400 line-clamp-1 mb-2">
                {step.subtitle}
              </p>

              {/* Step Tag */}
              <div className="mt-auto">
                <span
                  className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-full border ${step.badgeColor}`}
                >
                  {step.badge}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
