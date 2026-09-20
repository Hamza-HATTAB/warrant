"use client";

import React, { KeyboardEvent } from "react";
import { Search, Play, Square, Sparkles, CornerDownLeft, ShieldCheck, AlertCircle, ShieldAlert } from "lucide-react";
import { PRESET_TRAJECTORIES } from "../lib/presets";
import { PresetTrajectory } from "../lib/types";

interface QueryBarProps {
  query: string;
  setQuery: (val: string) => void;
  isLoading: boolean;
  onExecute: () => void;
  onAbort: () => void;
  onSelectPreset: (preset: PresetTrajectory) => void;
  selectedPresetId?: string;
}

export const QueryBar: React.FC<QueryBarProps> = ({
  query,
  setQuery,
  isLoading,
  onExecute,
  onAbort,
  onSelectPreset,
  selectedPresetId,
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
    <div className="glass-panel-elevated rounded-2xl p-5 md:p-6 shadow-2xl border border-emerald-500/20">
      {/* Search Input Box */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-emerald-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask a multi-hop research inquiry (e.g. Which magazine was started first, Arthur's Magazine or First for Women?)..."
            className="w-full pl-12 pr-4 py-3.5 bg-black/60 border border-slate-700/80 focus:border-emerald-400 rounded-xl text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner"
          />
        </div>

        {/* Action Button */}
        {isLoading ? (
          <button
            type="button"
            onClick={onAbort}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 text-sm font-semibold transition-colors shadow-lg shadow-rose-500/10"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>Abort Run</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onExecute}
            disabled={!query.trim()}
            className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 transition-all transform active:scale-95"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Execute Research</span>
            <CornerDownLeft className="w-3.5 h-3.5 opacity-60 hidden sm:inline" />
          </button>
        )}
      </div>

      {/* Preset Scenarios Header */}
      <div className="mt-5 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Select a Pre-Engineered HotpotQA Multi-Hop Trajectory:</span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Demonstrates full DAG verification and edge case handling
          </span>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {PRESET_TRAJECTORIES.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            const badgeIcon =
              preset.expectedDecision === "FULL_PASS"
                ? ShieldCheck
                : preset.expectedDecision === "PARTIAL_PASS"
                ? AlertCircle
                : ShieldAlert;

            const badgeStyles =
              preset.expectedDecision === "FULL_PASS"
                ? "text-emerald-400 bg-emerald-950/60 border-emerald-500/30"
                : preset.expectedDecision === "PARTIAL_PASS"
                ? "text-amber-400 bg-amber-950/60 border-amber-500/30"
                : "text-rose-400 bg-rose-950/60 border-rose-500/30";

            const BadgeIcon = badgeIcon;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between ${
                  isSelected
                    ? "bg-emerald-950/40 border-emerald-400 shadow-md ring-1 ring-emerald-500/30"
                    : "bg-black/30 border-slate-800/80 hover:bg-black/50 hover:border-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="font-semibold text-xs text-white truncate">
                      {preset.title}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${badgeStyles}`}
                    >
                      <BadgeIcon className="w-2.5 h-2.5" />
                      {preset.expectedDecision}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                    {preset.description}
                  </p>
                </div>

                <div className="mt-2 text-[10px] text-slate-500 font-mono">
                  {preset.hopsRequired} hops &middot; {preset.mockState.synthetic_claims.length} claims
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
