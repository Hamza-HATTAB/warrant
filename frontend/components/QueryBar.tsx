"use client";

import React, { KeyboardEvent } from "react";
import { Search, Play, Square, Sparkles, ArrowRight, ShieldCheck, AlertTriangle, ShieldX } from "lucide-react";
import { PRESET_TRAJECTORIES } from "../lib/presets";
import { PresetTrajectory } from "../lib/types";
import { cn } from "../lib/utils";

interface QueryBarProps {
  query: string;
  setQuery: (val: string) => void;
  isLoading: boolean;
  onExecute: () => void;
  onAbort: () => void;
  onSelectPreset: (preset: PresetTrajectory) => void;
  selectedPresetId?: string;
  className?: string;
}

export const QueryBar: React.FC<QueryBarProps> = ({
  query,
  setQuery,
  isLoading,
  onExecute,
  onAbort,
  onSelectPreset,
  selectedPresetId,
  className = "",
}) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!isLoading && query.trim()) {
        onExecute();
      }
    }
  };

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Floating Frosted Glass Capsule */}
      <div className="glass-pill rounded-full p-2 pl-6 pr-2.5 flex items-center gap-3 transition-all duration-300 focus-within:border-emerald-500/40 focus-within:glow-emerald-subtle">
        <div className="text-emerald-400 flex items-center justify-center">
          <Search className="w-5 h-5" />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="Ask a multi-hop inquiry (e.g. Which magazine was started first, Arthur's Magazine or First for Women?)..."
          className="flex-1 bg-transparent border-none text-sm md:text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-0 font-sans"
        />

        {/* Tactile Execute / Abort Button */}
        {isLoading ? (
          <button
            type="button"
            onClick={onAbort}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 text-xs font-semibold transition-all shadow-md active:scale-95"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Abort Run</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onExecute}
            disabled={!query.trim()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-semibold text-xs md:text-sm transition-all shadow-lg shadow-emerald-500/25 active:scale-95"
          >
            <span>Execute Attribution</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Preset Trajectory Selector Pills */}
      <div className="flex flex-wrap items-center gap-2 px-2">
        <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mr-1">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>HotpotQA Presets:</span>
        </span>

        {PRESET_TRAJECTORIES.map((preset) => {
          const isSelected = selectedPresetId === preset.id;
          const isFullPass = preset.expectedDecision === "FULL_PASS";
          const isPartialPass = preset.expectedDecision === "PARTIAL_PASS";

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-2",
                isSelected
                  ? isFullPass
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : isPartialPass
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
                  : "bg-white/[0.04] text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] border border-white/[0.06]"
              )}
            >
              {isFullPass ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              ) : isPartialPass ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <ShieldX className="w-3.5 h-3.5 text-rose-400" />
              )}
              <span>{preset.title}</span>
              <span className="text-[10px] text-slate-500 font-mono">
                {preset.expectedDecision}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
