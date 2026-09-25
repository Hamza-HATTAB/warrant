"use client";

import React, { useRef } from "react";
import { WarrantState, PolicyDecision } from "../lib/types";
import { AnimatedBeam } from "./ui/animated-beam";
import { cn } from "../lib/utils";

interface AnimatedPipelineDAGProps {
  state: WarrantState | null;
  isLoading: boolean;
  className?: string;
  onSelectNode?: (nodeIndex: number) => void;
  activeNodeIndex?: number;
}

interface PipelineNodeConfig {
  id: string;
  stepNumber: number;
  label: string;
  subLabel: string;
  hardware: "RTX 4060 GPU" | "CPU MULTI-THREAD" | "DETERMINISTIC" | "STATE MACHINE";
  hardwareColor: string;
  latencyBadge: string;
  description: string;
}

const PIPELINE_NODES: PipelineNodeConfig[] = [
  {
    id: "query",
    stepNumber: 1,
    label: "User Query",
    subLabel: "Multi-Hop Input",
    hardware: "STATE MACHINE",
    hardwareColor: "text-sky-400 border-sky-500/30 bg-sky-500/10",
    latencyBadge: "0.1ms",
    description: "Ingests raw user inquiry and seeds the LangGraph execution environment.",
  },
  {
    id: "decomposition",
    stepNumber: 2,
    label: "Sub-Query Decomposition",
    subLabel: "LangGraph Planner",
    hardware: "CPU MULTI-THREAD",
    hardwareColor: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    latencyBadge: "12ms",
    description: "Deconstructs complex multi-entity queries into discrete single-hop sub-queries.",
  },
  {
    id: "retrieval",
    stepNumber: 3,
    label: "Hybrid Retrieval",
    subLabel: "Dense + Sparse Spans",
    hardware: "CPU MULTI-THREAD",
    hardwareColor: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
    latencyBadge: "48ms",
    description: "Multi-hop retrieval with BM25 and vector embedding reranking on CPU cores.",
  },
  {
    id: "generation",
    stepNumber: 4,
    label: "12B Generation",
    subLabel: "Gemma-3 Autoregressive",
    hardware: "RTX 4060 GPU",
    hardwareColor: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    latencyBadge: "220ms",
    description: "7.36 GB active VRAM allocation on 8GB RTX 4060. Synthesizes atomic claims with span pointers.",
  },
  {
    id: "entity_guard",
    stepNumber: 5,
    label: "Entity Guard",
    subLabel: "Deterministic Regex/NER",
    hardware: "DETERMINISTIC",
    hardwareColor: "text-purple-400 border-purple-500/30 bg-purple-500/10",
    latencyBadge: "<1ms",
    description: "Sub-millisecond validation ensuring all numbers and named entities strictly originate in retrieved spans.",
  },
  {
    id: "cross_encoder",
    stepNumber: 6,
    label: "DeBERTa-v3 NLI",
    subLabel: "Calibrated Cross-Encoder",
    hardware: "CPU MULTI-THREAD",
    hardwareColor: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    latencyBadge: "182ms",
    description: "Natural Language Inference gate enforcing calibrated entailment threshold (tau >= 0.820).",
  },
  {
    id: "policy_contract",
    stepNumber: 7,
    label: "3-State Contract",
    subLabel: "Selective Abstention",
    hardware: "STATE MACHINE",
    hardwareColor: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    latencyBadge: "0.2ms",
    description: "LangGraph contract enforcing FULL_PASS, PARTIAL_PASS, or strict ABSTAIN refusal.",
  },
];

export const AnimatedPipelineDAG: React.FC<AnimatedPipelineDAGProps> = ({
  state,
  isLoading,
  className = "",
  onSelectNode,
  activeNodeIndex = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Refs for each node for the Magic UI AnimatedBeam
  const nodeRef1 = useRef<HTMLDivElement>(null);
  const nodeRef2 = useRef<HTMLDivElement>(null);
  const nodeRef3 = useRef<HTMLDivElement>(null);
  const nodeRef4 = useRef<HTMLDivElement>(null);
  const nodeRef5 = useRef<HTMLDivElement>(null);
  const nodeRef6 = useRef<HTMLDivElement>(null);
  const nodeRef7 = useRef<HTMLDivElement>(null);

  const nodeRefs = [
    nodeRef1,
    nodeRef2,
    nodeRef3,
    nodeRef4,
    nodeRef5,
    nodeRef6,
    nodeRef7,
  ];

  // Determine current active node based on state or loading
  const decision: PolicyDecision = state?.policy_decision || "FULL_PASS";
  const verifiedCount = state?.verified_claims?.length || 0;
  const refutedCount = state?.refuted_claims?.length || 0;

  const getDecisionBadge = () => {
    if (decision === "FULL_PASS") {
      return { text: "FULL_PASS", bg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50" };
    }
    if (decision === "PARTIAL_PASS") {
      return { text: "PARTIAL_PASS", bg: "bg-amber-500/20 text-amber-300 border-amber-500/50" };
    }
    return { text: "ABSTAIN", bg: "bg-rose-500/20 text-rose-300 border-rose-500/50" };
  };

  const decisionBadge = getDecisionBadge();

  return (
    <div
      className={cn(
        "relative w-full rounded-2xl border border-slate-800 bg-[#030712]/95 backdrop-blur-xl p-6 shadow-2xl overflow-hidden",
        className
      )}
    >
      {/* Header section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 mb-6 border-b border-slate-800/80 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h3 className="text-sm font-semibold tracking-wide text-slate-100 uppercase font-mono">
              Verification Pipeline DAG &middot; Asymmetric Compute Architecture
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gemma-3 12B (7.36 GB active VRAM on RTX 4060) decoupled from CPU Stage-1 Entity Guard &amp; DeBERTa-v3 Cross-Encoder.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400">Total Latency:</span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold">
            461.9 ms
          </span>
          <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 font-mono text-xs">
            9.5x Speedup vs LLM Judge
          </span>
        </div>
      </div>

      {/* DAG Node Container */}
      <div
        ref={containerRef}
        className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 py-4 z-10"
      >
        {PIPELINE_NODES.map((node, index) => {
          const isSelected = activeNodeIndex === node.stepNumber;
          const isFinal = index === PIPELINE_NODES.length - 1;

          return (
            <div
              key={node.id}
              ref={nodeRefs[index]}
              onClick={() => onSelectNode && onSelectNode(node.stepNumber)}
              className={cn(
                "relative group cursor-pointer rounded-xl p-3.5 border transition-all duration-200 flex flex-col justify-between bg-black/60 backdrop-blur-md min-h-[148px]",
                isSelected
                  ? "border-emerald-500/80 bg-emerald-950/20 shadow-lg shadow-emerald-500/10 scale-[1.02]"
                  : "border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/40"
              )}
            >
              {/* Step indicator & Hardware tag */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-slate-400 font-bold">
                  0{node.stepNumber}
                </span>
                <span
                  className={cn(
                    "text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider font-medium",
                    node.hardwareColor
                  )}
                >
                  {node.latencyBadge}
                </span>
              </div>

              {/* Node Title & SubLabel */}
              <div>
                <h4 className="text-xs font-semibold text-slate-100 group-hover:text-emerald-300 transition-colors">
                  {node.label}
                </h4>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {node.subLabel}
                </p>
              </div>

              {/* Hardware & Contract Footer */}
              <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                <span className="text-[9px] font-mono text-slate-400 truncate max-w-[90px]">
                  {node.hardware}
                </span>
                {isFinal ? (
                  <span
                    className={cn(
                      "text-[9px] font-mono px-1.5 py-0.5 rounded border font-bold uppercase",
                      decisionBadge.bg
                    )}
                  >
                    {decisionBadge.text}
                  </span>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600 group-hover:bg-emerald-400 transition-colors" />
                )}
              </div>
            </div>
          );
        })}

        {/* Animated Light Beams Connecting Consecutive Nodes */}
        {nodeRefs.slice(0, -1).map((fromRef, idx) => {
          const toRef = nodeRefs[idx + 1];
          const isGuardOrNli = idx >= 3;
          return (
            <AnimatedBeam
              key={`beam-${idx}`}
              containerRef={containerRef}
              fromRef={fromRef}
              toRef={toRef}
              duration={3.2}
              delay={idx * 0.45}
              pathColor="rgba(51, 65, 85, 0.4)"
              pathWidth={2}
              gradientStartColor={isGuardOrNli ? "#10B981" : "#06B6D4"}
              gradientStopColor={isGuardOrNli ? "#06B6D4" : "#10B981"}
              active={true}
              className="hidden lg:block z-0"
            />
          );
        })}
      </div>

      {/* Dynamic Summary Bar below DAG */}
      <div className="mt-4 pt-3 border-t border-slate-800/70 flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Verified Claims: <strong className="text-emerald-400">{verifiedCount}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            Refuted Claims: <strong className="text-rose-400">{refutedCount}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            Active VRAM: <strong className="text-slate-200">7.36 GB / 8.00 GB</strong>
          </span>
        </div>

        <div className="text-[11px] text-slate-400">
          Click any stage node to inspect full algorithmic telemetry &amp; execution logs
        </div>
      </div>
    </div>
  );
};
