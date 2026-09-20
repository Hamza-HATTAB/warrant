"use client";

import React from "react";
import { GitBranch, Search, Filter, CheckCircle2, Clock } from "lucide-react";
import { EvidenceSpan } from "../lib/types";

interface MultiHopTimelineProps {
  currentHop: number;
  maxHops: number;
  spans: EvidenceSpan[];
  isLoading: boolean;
}

export const MultiHopTimeline: React.FC<MultiHopTimelineProps> = ({
  currentHop,
  maxHops,
  spans,
  isLoading,
}) => {
  const hop1Spans = spans.filter((s) => s.retrieval_hop === 1);
  const hop2Spans = spans.filter((s) => s.retrieval_hop === 2);

  const renderHopCard = (hopNumber: number, hopSpans: EvidenceSpan[], isActive: boolean) => {
    const isCompleted = hopSpans.length > 0 || (currentHop > hopNumber && !isLoading);
    const isProcessing = isLoading && currentHop === hopNumber;

    return (
      <div
        className={`flex-1 rounded border p-3.5 transition-all ${
          isProcessing
            ? "border-terminal-green bg-terminal-green/5 ring-1 ring-terminal-green/30"
            : isCompleted
            ? "border-panel-borderBright bg-panel"
            : "border-panel-border/50 bg-[#080c0a]/60 opacity-60"
        }`}
      >
        {/* Hop Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`h-5 w-5 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                isCompleted
                  ? "bg-terminal-green text-black"
                  : isProcessing
                  ? "bg-terminal-green/20 text-terminal-green border border-terminal-green animate-pulse"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {hopNumber}
            </span>
            <span className="font-mono text-xs font-semibold text-slate-200">
              Hop {hopNumber}: {hopNumber === 1 ? "Anchor Entity Retrieval" : "Bridged Attribute Retrieval"}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono">
            {isProcessing && (
              <span className="flex items-center gap-1 text-terminal-green text-[10px]">
                <Clock className="w-3 h-3 animate-spin" />
                Reranking...
              </span>
            )}
            {isCompleted && (
              <span className="flex items-center gap-1 text-terminal-green text-[10px]">
                <CheckCircle2 className="w-3 h-3" />
                {hopSpans.length} Spans
              </span>
            )}
          </div>
        </div>

        {/* Retrieval Pipeline Telemetry */}
        <div className="space-y-1.5 font-mono text-[11px] text-slate-400">
          <div className="flex items-center justify-between bg-[#080c0a] px-2 py-1 rounded border border-panel-border/60">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Search className="w-3 h-3 text-terminal-cyan" />
              Hybrid Fusion:
            </span>
            <span className="text-slate-300">BGE Dense + BM25 Sparse (RRF k=60)</span>
          </div>

          <div className="flex items-center justify-between bg-[#080c0a] px-2 py-1 rounded border border-panel-border/60">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Filter className="w-3 h-3 text-terminal-lime" />
              Cross-Encoder:
            </span>
            <span className="text-slate-300">FlashRank MiniLM (CPU &middot; top-3)</span>
          </div>
        </div>

        {/* Retrieved documents preview */}
        {hopSpans.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-panel-border/40">
            <div className="text-[10px] uppercase font-mono text-slate-500 mb-1">
              Top Ranked Documents:
            </div>
            <div className="flex flex-wrap gap-1">
              {Array.from(new Set(hopSpans.map((s) => s.doc_title))).map((title) => (
                <span
                  key={title}
                  className="px-1.5 py-0.5 rounded bg-panel-elevated border border-panel-border text-[11px] font-mono text-slate-300 truncate max-w-[200px]"
                >
                  {title}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="terminal-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-terminal-green" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            Multi-Hop Retrieval Timeline (Qdrant RRF &amp; FlashRank)
          </h3>
        </div>
        <div className="font-mono text-[11px] text-slate-400">
          Max Hops: <span className="text-slate-200">{maxHops}</span> &middot; Total Spans:{" "}
          <span className="text-terminal-green font-semibold">{spans.length}</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-stretch gap-3">
        {renderHopCard(1, hop1Spans, currentHop === 1)}
        <div className="hidden md:flex items-center justify-center text-slate-600 font-mono text-sm px-1">
          &rarr;
        </div>
        {renderHopCard(2, hop2Spans, currentHop === 2)}
      </div>
    </div>
  );
};
