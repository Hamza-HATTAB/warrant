"use client";

import React, { KeyboardEvent } from "react";
import { Terminal, Play, Square, Sparkles } from "lucide-react";
import { PRESET_TRAJECTORIES } from "../lib/presets";
import { PresetTrajectory } from "../lib/types";

interface QueryInputProps {
  query: string;
  setQuery: (val: string) => void;
  isLoading: boolean;
  onExecute: () => void;
  onAbort: () => void;
  onSelectPreset: (preset: PresetTrajectory) => void;
  selectedPresetId?: string;
  isLiveMode: boolean;
}

export const QueryInput: React.FC<QueryInputProps> = ({
  query,
  setQuery,
  isLoading,
  onExecute,
  onAbort,
  onSelectPreset,
  selectedPresetId,
  isLiveMode,
}) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!isLoading && query.trim()) {
        onExecute();
      }
    }
  };

  return (
    <div className="terminal-border rounded-lg p-4 md:p-5 shadow-xl">
      {/* Terminal Command Line Header */}
      <div className="flex items-center justify-between mb-3 text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-400">
          <Terminal className="w-4 h-4 text-terminal-green" />
          <span className="text-slate-500">session:</span>
          <span className="text-slate-300">warrant@rtx4060:~$</span>
          <span className="text-terminal-greenBright">execute_multi_hop_query</span>
        </div>
        <div className="text-[11px] text-slate-500 hidden sm:block">
          Press <kbd className="px-1.5 py-0.5 rounded bg-panel-elevated border border-panel-border text-slate-300 font-mono">Ctrl+Enter</kbd> to run
        </div>
      </div>

      {/* Input bar */}
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Enter multi-hop research inquiry (e.g. Which magazine was started first, Arthur's Magazine or First for Women?)..."
            className="w-full bg-[#080c0a] border border-panel-border focus:border-terminal-green/60 rounded px-4 py-3 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-terminal-green/40 transition-all"
          />
        </div>

        {/* Action Button */}
        {isLoading ? (
          <button
            type="button"
            onClick={onAbort}
            className="flex items-center gap-2 px-5 py-3 rounded bg-terminal-rose/20 border border-terminal-rose/40 text-terminal-rose hover:bg-terminal-rose/30 font-mono text-xs font-semibold transition-colors"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Abort</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onExecute}
            disabled={!query.trim()}
            className="flex items-center gap-2 px-6 py-3 rounded bg-terminal-green/20 border border-terminal-green/50 text-terminal-greenBright hover:bg-terminal-green/30 disabled:opacity-40 disabled:cursor-not-allowed font-mono text-xs font-semibold glow-emerald transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Execute</span>
          </button>
        )}
      </div>

      {/* Preset Trajectories Selector */}
      <div className="mt-4 pt-3 border-t border-panel-border">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-terminal-lime" />
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            HotpotQA Multi-Hop Presets &amp; Edge Cases:
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {PRESET_TRAJECTORIES.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            const badgeColor =
              preset.expectedDecision === "FULL_PASS"
                ? "text-terminal-green border-terminal-green/30 bg-terminal-green/10"
                : preset.expectedDecision === "PARTIAL_PASS"
                ? "text-terminal-amber border-terminal-amber/30 bg-terminal-amber/10"
                : "text-terminal-rose border-terminal-rose/30 bg-terminal-rose/10";

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className={`text-left p-2.5 rounded border text-xs font-mono transition-all flex flex-col justify-between ${
                  isSelected
                    ? "border-terminal-green bg-terminal-green/10 ring-1 ring-terminal-green/30"
                    : "border-panel-border bg-panel hover:border-panel-borderBright hover:bg-panel-hover"
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="font-semibold text-slate-200 truncate">{preset.title}</span>
                  <span className={`text-[10px] px-1 rounded border ${badgeColor} font-bold`}>
                    {preset.expectedDecision}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed font-sans">
                  {preset.query}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
