"use client";

import React from "react";
import { Shield, Sparkles, Cpu, BarChart2, Github, Radio, CheckCircle, HelpCircle } from "lucide-react";

interface NavbarProps {
  isLiveMode: boolean;
  setIsLiveMode: (val: boolean) => void;
  viewMode: "executive" | "telemetry";
  setViewMode: (val: "executive" | "telemetry") => void;
  onOpenBenchmark: () => void;
  onOpenLiveSettings: () => void;
  backendConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  isLiveMode,
  setIsLiveMode,
  viewMode,
  setViewMode,
  onOpenBenchmark,
  onOpenLiveSettings,
  backendConnected,
}) => {

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-emerald-500/10 px-4 lg:px-8 py-3.5 shadow-2xl">
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3.5 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-black font-extrabold text-lg">
              W
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white">
                  WARRANT
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  v0.1.0 &middot; Calibrated NLI Gate
                </span>
              </div>
              <p className="text-xs text-slate-400 font-normal">
                Multi-Hop Attributed Research &middot; Claim-Level NLI Verification &amp; Selective Abstention
              </p>
            </div>
          </div>

          {/* Quick status pill on mobile */}
          <div className="md:hidden flex items-center gap-1.5 text-xs font-mono">
            <span
              className={`h-2 w-2 rounded-full ${
                isLiveMode ? (backendConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-500") : "bg-cyan-400"
              }`}
            />
            <span className="text-slate-300 font-medium">{isLiveMode ? "Live GPU" : "Simulator"}</span>
          </div>
        </div>

        {/* Model & Hardware Pipeline Badges */}
        <div className="hidden lg:flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Synthesis:</span>
            <span className="text-emerald-300 font-semibold">Gemma 3 12B Unified</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-slate-300">
            <Shield className="w-3.5 h-3.5 text-lime-400" />
            <span className="text-slate-400">Verifier:</span>
            <span className="text-lime-300 font-semibold">DeBERTa-v3 NLI (CPU &middot; 0 MB VRAM)</span>
          </div>
        </div>

        {/* Control Toggles */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Executive vs Deep Telemetry View Switcher */}
          <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("executive")}
              className={`px-3 py-1 rounded-md transition-all font-medium ${
                viewMode === "executive"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Readable step-by-step visual mode for recruiters and executives"
            >
              Executive
            </button>
            <button
              type="button"
              onClick={() => setViewMode("telemetry")}
              className={`px-3 py-1 rounded-md transition-all font-medium ${
                viewMode === "telemetry"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Full engineer view with tensor logits, latencies, and state deltas"
            >
              Telemetry
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setIsLiveMode(false)}
              className={`px-3 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 ${
                !isLiveMode
                  ? "bg-slate-800 text-slate-200 border border-slate-700 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Radio className="w-3 h-3 text-cyan-400" />
              Demo Mode
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isLiveMode) {
                  onOpenLiveSettings();
                } else {
                  onOpenLiveSettings();
                }
              }}
              className={`px-3 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 ${
                isLiveMode
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Configure live RTX 4060 GPU Tunnel connection"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  backendConnected ? "bg-emerald-400 animate-ping" : "bg-amber-400"
                }`}
              />
              Live GPU
            </button>

          </div>

          {/* Benchmark Trigger */}
          <button
            type="button"
            onClick={onOpenBenchmark}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-xs font-semibold transition-all shadow-sm"
          >
            <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Verifier</span> Bake-Off
          </button>

          {/* GitHub */}
          <a
            href="https://github.com/Hamza-HATTAB/warrant"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg bg-black/40 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="View Source on GitHub"
          >
            <Github className="w-4 h-4" />
          </a>
        </div>
      </div>
    </header>
  );
};
