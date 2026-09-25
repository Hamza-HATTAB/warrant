"use client";

import React, { useState } from "react";
import { CardSpotlight } from "./ui/card-spotlight";
import { NumberTicker } from "./ui/number-ticker";
import { BorderBeam } from "./ui/border-beam";
import { cn } from "../lib/utils";

interface TelemetryBentoGridProps {
  className?: string;
}

export const TelemetryBentoGrid: React.FC<TelemetryBentoGridProps> = ({ className = "" }) => {
  const [activeTab, setActiveTab] = useState<"latency" | "compute" | "benchmark">("latency");

  return (
    <div className={cn("w-full space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h3 className="text-sm font-semibold tracking-wide text-slate-100 uppercase font-mono">
              Empirical Telemetry Bento &middot; Hardware &amp; Benchmark Profiling
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified HotpotQA multi-hop benchmark telemetry on 8GB consumer hardware.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>Target GPU: NVIDIA RTX 4060 Laptop (8GB VRAM)</span>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: 461.9ms Latency & 9.5x Speedup */}
        <CardSpotlight
          color="rgba(16, 185, 129, 0.2)"
          className="relative flex flex-col justify-between border-slate-800/90 bg-[#04080e]/90 hover:border-emerald-500/40 transition-colors"
        >
          <BorderBeam size={220} duration={8} colorFrom="#10B981" colorTo="#06B6D4" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                P50 Latency
              </span>
              <span className="text-[11px] font-mono text-sky-400 font-bold px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30">
                9.5x Speedup
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-extrabold text-slate-100 tracking-tight font-mono">
                <NumberTicker value={461.9} decimalPlaces={1} suffix=" ms" />
              </span>
            </div>

            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Full end-to-end verification pipeline vs 4,420 ms for generative LLM-as-a-judge (9.5x speedup).
            </p>

            {/* Pipeline Stage Breakdown */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Stage-1 Entity Guard</span>
                <span className="text-purple-400 font-bold">&lt; 1 ms (0.42ms)</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div className="bg-purple-500 h-full rounded-full" style={{ width: "3%" }} />
              </div>

              <div className="flex items-center justify-between text-slate-300 pt-1">
                <span className="text-slate-400">Stage-2 DeBERTa-v3 NLI</span>
                <span className="text-amber-400 font-bold">182 ms</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: "39%" }} />
              </div>

              <div className="flex items-center justify-between text-slate-300 pt-1">
                <span className="text-slate-400">12B Claim Generation</span>
                <span className="text-emerald-400 font-bold">220 ms</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: "48%" }} />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/60 text-[10px] font-mono text-slate-400 flex items-center justify-between">
            <span>LLM Judge: 4,420 ms</span>
            <span className="text-emerald-400 font-semibold">WARRANT: 461.9 ms</span>
          </div>
        </CardSpotlight>

        {/* Card 2: Asymmetric Compute Partition */}
        <CardSpotlight
          color="rgba(6, 182, 212, 0.2)"
          className="relative flex flex-col justify-between border-slate-800/90 bg-[#04080e]/90 hover:border-cyan-500/40 transition-colors"
        >
          <BorderBeam size={220} duration={8} delay={2} colorFrom="#06B6D4" colorTo="#3B82F6" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
                Compute Partitioning
              </span>
              <span className="text-[11px] font-mono text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                Zero CUDA OOMs
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-extrabold text-slate-100 tracking-tight font-mono">
                <NumberTicker value={7.36} decimalPlaces={2} suffix=" GB" />
              </span>
              <span className="text-sm font-mono text-slate-400">/ 8.00 GB VRAM</span>
            </div>

            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              RTX 4060 host budget preserved by offloading dense retrieval and NLI inference to CPU threads.
            </p>

            {/* Hardware Partition Visual Bars */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3 text-xs font-mono">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-300">GPU VRAM: Gemma-3 12B</span>
                  <span className="text-emerald-400 font-bold">92.0% (7.36 GB)</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full rounded-full" style={{ width: "92%" }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-300">CPU: Retrieval &amp; Cross-Encoder</span>
                  <span className="text-cyan-400 font-bold">16 Threads Active</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                  <div className="bg-cyan-500 h-full rounded-full" style={{ width: "68%" }} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/60 text-[10px] font-mono text-slate-400 flex items-center justify-between">
            <span>Dual-12B OOM: Prevented</span>
            <span className="text-cyan-400 font-semibold">Decoupled Architecture</span>
          </div>
        </CardSpotlight>

        {/* Card 3: HotpotQA Distractor Evaluation */}
        <CardSpotlight
          color="rgba(168, 85, 247, 0.2)"
          className="relative flex flex-col justify-between border-slate-800/90 bg-[#04080e]/90 hover:border-purple-500/40 transition-colors"
        >
          <BorderBeam size={220} duration={8} delay={4} colorFrom="#A855F7" colorTo="#10B981" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30">
                HotpotQA Benchmark
              </span>
              <span className="text-[11px] font-mono text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                1,991 Distractors
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-extrabold text-slate-100 tracking-tight font-mono">
                <NumberTicker value={100.0} decimalPlaces={1} suffix="%" />
              </span>
              <span className="text-sm font-mono text-emerald-400">Precision</span>
            </div>

            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              0.0% Hallucination rate on HotpotQA multi-hop distractor evaluation with selective abstention.
            </p>

            {/* Benchmark Comparison Table */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs font-mono">
              <div className="grid grid-cols-3 text-[10px] text-slate-400 font-semibold uppercase pb-1 border-b border-slate-800/60">
                <span>Architecture</span>
                <span className="text-center">Precision</span>
                <span className="text-right">Hallucination</span>
              </div>
              <div className="grid grid-cols-3 text-[11px] text-slate-400 py-0.5">
                <span>Naive RAG</span>
                <span className="text-center text-amber-400">50.0%</span>
                <span className="text-right text-rose-400">50.0%</span>
              </div>
              <div className="grid grid-cols-3 text-[11px] text-slate-400 py-0.5">
                <span>LLM Judge</span>
                <span className="text-center text-sky-400">62.5%</span>
                <span className="text-right text-amber-400">37.5%</span>
              </div>
              <div className="grid grid-cols-3 text-[11px] text-emerald-300 font-bold py-0.5 bg-emerald-950/30 rounded px-1 -mx-1">
                <span>WARRANT</span>
                <span className="text-center text-emerald-400">100.0%</span>
                <span className="text-right text-emerald-400">0.0%</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/60 text-[10px] font-mono text-slate-400 flex items-center justify-between">
            <span>Strict 3-State Contract</span>
            <span className="text-emerald-400 font-semibold">Calibrated tau &gt;= 0.820</span>
          </div>
        </CardSpotlight>
      </div>
    </div>
  );
};
