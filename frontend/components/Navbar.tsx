"use client";

import React from "react";
import { Shield, Sparkles, BarChart2, Github, Radio } from "lucide-react";
import { cn } from "../lib/utils";

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
    <header className="sticky top-0 z-50 glass-surface border-b border-white/8 px-4 lg:px-8 py-3.5 shadow-2xl">
      <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-black text-lg">
              W
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white font-sans">
                  WARRANT
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  Calibrated NLI Gate
                </span>
              </div>
              <p className="text-xs text-slate-400 font-normal">
                Dual-Stage Epistemic Attribution &middot; Gemma-3 12B &middot; DeBERTa-v3
              </p>
            </div>
          </div>

          {/* Quick status pill on mobile */}
          <div className="md:hidden flex items-center gap-1.5 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                isLiveMode ? (backendConnected ? "bg-emerald-400 animate-ping" : "bg-rose-500") : "bg-cyan-400"
              }`}
            />
            <span className="text-slate-300 font-medium">{isLiveMode ? "Live GPU" : "Simulator"}</span>
          </div>
        </div>

        {/* Compute Architecture Indicator */}
        <div className="hidden lg:flex items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/8 text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Generation:</span>
            <span className="text-slate-200 font-semibold">Gemma-3 12B (RTX 4060 GPU)</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/8 text-slate-300">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Attribution:</span>
            <span className="text-cyan-300 font-semibold">DeBERTa-v3 (16 CPU Threads)</span>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Executive vs Telemetry View Switcher */}
          <div className="flex items-center bg-black/50 p-1 rounded-full border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("executive")}
              className={cn(
                "px-3 py-1 rounded-full transition-all font-medium",
                viewMode === "executive"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              Executive
            </button>
            <button
              type="button"
              onClick={() => setViewMode("telemetry")}
              className={cn(
                "px-3 py-1 rounded-full transition-all font-medium",
                viewMode === "telemetry"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              Telemetry
            </button>
          </div>

          {/* Live vs Simulator Mode Switcher */}
          <div className="flex items-center bg-black/50 p-1 rounded-full border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setIsLiveMode(false)}
              className={cn(
                "px-3 py-1 rounded-full transition-all font-medium flex items-center gap-1.5",
                !isLiveMode
                  ? "bg-white/10 text-slate-100 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Radio className="w-3 h-3 text-cyan-400" />
              <span>Deterministic</span>
            </button>
            <button
              type="button"
              onClick={onOpenLiveSettings}
              className={cn(
                "px-3 py-1 rounded-full transition-all font-medium flex items-center gap-1.5",
                isLiveMode
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  backendConnected ? "bg-emerald-400 animate-ping" : "bg-amber-400"
                }`}
              />
              <span>Live GPU</span>
            </button>
          </div>

          {/* Verifier Bake-Off Modal Trigger */}
          <button
            type="button"
            onClick={onOpenBenchmark}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 text-slate-200 text-xs font-semibold transition-all shadow-sm"
          >
            <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Verifier</span> Bake-Off
          </button>

          {/* GitHub Repo Link */}
          <a
            href="https://github.com/Hamza-HATTAB/warrant"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 text-slate-400 hover:text-slate-200 transition-colors"
            title="View Source on GitHub"
          >
            <Github className="w-4 h-4" />
          </a>
        </div>
      </div>
    </header>
  );
};
