"use client";

import React from "react";
import { Cpu, Zap, Activity, BarChart3, Github, Radio } from "lucide-react";

interface TopBarProps {
  isLiveMode: boolean;
  setIsLiveMode: (val: boolean) => void;
  onOpenBenchmark: () => void;
  backendConnected: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  isLiveMode,
  setIsLiveMode,
  onOpenBenchmark,
  backendConnected,
}) => {
  return (
    <header className="border-b border-panel-border bg-[#080c0a]/90 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Architecture */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded border border-terminal-green/40 bg-terminal-green/10 flex items-center justify-center font-mono font-bold text-terminal-green text-sm glow-emerald">
              W
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold tracking-wider text-slate-100">
                  WARRANT
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border border-terminal-green/30 bg-terminal-green/10 text-terminal-green">
                  v1.0.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans hidden sm:block">
                Attributed Multi-Hop Research Agent &middot; 3-State Abstention Contract
              </p>
            </div>
          </div>

          {/* Mobile mode indicator */}
          <div className="md:hidden flex items-center gap-1.5 text-xs font-mono">
            <span
              className={`h-2 w-2 rounded-full ${
                isLiveMode ? (backendConnected ? "bg-terminal-green" : "bg-terminal-rose") : "bg-terminal-cyan"
              }`}
            />
            <span className="text-slate-400">{isLiveMode ? "LIVE" : "DEMO"}</span>
          </div>
        </div>

        {/* System Telemetry Pills */}
        <div className="hidden lg:flex items-center gap-2.5 font-mono text-[11px]">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-panel border border-panel-border text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-terminal-green" />
            <span className="text-slate-400">Synthesis:</span>
            <span className="text-slate-200 font-medium">Gemma 3 12B Unified</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-panel border border-panel-border text-slate-300">
            <Zap className="w-3.5 h-3.5 text-terminal-lime" />
            <span className="text-slate-400">Verifier:</span>
            <span className="text-slate-200 font-medium">DeBERTa-v3 NLI (CPU &middot; 0 MB VRAM)</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-panel border border-panel-border text-slate-300">
            <Activity className="w-3.5 h-3.5 text-terminal-cyan" />
            <span className="text-slate-400">Guard:</span>
            <span className="text-slate-200 font-medium">&lt;1ms Deterministic</span>
          </div>
        </div>

        {/* Action Controls & Mode Toggle */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Mode Switcher */}
          <div className="flex items-center rounded border border-panel-border bg-panel p-0.5 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setIsLiveMode(false)}
              className={`px-2.5 py-1 rounded transition-all flex items-center gap-1.5 ${
                !isLiveMode
                  ? "bg-terminal-green/15 text-terminal-greenBright border border-terminal-green/30 font-medium"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Radio className="w-3 h-3" />
              Demo Mode
            </button>
            <button
              type="button"
              onClick={() => setIsLiveMode(true)}
              className={`px-2.5 py-1 rounded transition-all flex items-center gap-1.5 ${
                isLiveMode
                  ? "bg-terminal-cyan/15 text-terminal-cyan border border-terminal-cyan/30 font-medium"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  backendConnected ? "bg-terminal-green animate-pulse" : "bg-terminal-amber"
                }`}
              />
              Live GPU
            </button>
          </div>

          {/* Verifier Bake-Off Modal Trigger */}
          <button
            type="button"
            onClick={onOpenBenchmark}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-panel border border-terminal-lime/30 text-terminal-lime hover:bg-terminal-lime/10 text-xs font-mono font-medium transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Verifier</span> Bake-Off
          </button>

          {/* GitHub Repository */}
          <a
            href="https://github.com/Hamza-HATTAB/warrant"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded bg-panel border border-panel-border text-slate-400 hover:text-slate-200 transition-colors"
            title="View Warrant on GitHub"
          >
            <Github className="w-4 h-4" />
          </a>
        </div>
      </div>
    </header>
  );
};
