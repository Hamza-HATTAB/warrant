"use client";

import React from "react";
import { BookOpen, Layers, ExternalLink } from "lucide-react";
import { EvidenceSpan, AtomicClaim } from "../lib/types";

interface EvidenceDrawerProps {
  spans: EvidenceSpan[];
  claims: AtomicClaim[];
  hoveredClaimId: string | null;
  selectedClaimId: string | null;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  spans,
  claims,
  hoveredClaimId,
  selectedClaimId,
}) => {
  if (!spans || spans.length === 0) {
    return (
      <div className="terminal-border rounded-lg p-5 text-center font-mono text-xs text-slate-500">
        No evidence spans retrieved yet.
      </div>
    );
  }

  // Find which spans are cited by the currently hovered/selected claim
  const activeClaim = claims.find((c) => c.claim_id === (hoveredClaimId || selectedClaimId));
  const activeCitedSpans = new Set(activeClaim?.cited_spans || []);

  // Group spans by document title
  const groupedSpans: Record<string, EvidenceSpan[]> = {};
  for (const span of spans) {
    if (!groupedSpans[span.doc_title]) {
      groupedSpans[span.doc_title] = [];
    }
    groupedSpans[span.doc_title].push(span);
  }

  return (
    <div className="terminal-border rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-terminal-cyan" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            Grounded Evidence Documents &amp; Spans
          </h3>
        </div>
        <div className="font-mono text-[11px] text-slate-400">
          Docs: <span className="text-slate-200">{Object.keys(groupedSpans).length}</span> &middot; Total
          Spans: <span className="text-terminal-cyan font-semibold">{spans.length}</span>
        </div>
      </div>

      {activeClaim && (
        <div className="mb-3 px-3 py-1.5 rounded bg-terminal-cyan/10 border border-terminal-cyan/30 text-xs font-mono text-terminal-cyan flex items-center justify-between">
          <span>Highlighting spans cited by [{activeClaim.claim_id}]</span>
          <span className="text-[10px]">{activeCitedSpans.size} span(s) active</span>
        </div>
      )}

      {/* Grouped Document List */}
      <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
        {Object.entries(groupedSpans).map(([docTitle, docSpans]) => (
          <div
            key={docTitle}
            className="rounded border border-panel-border bg-panel overflow-hidden"
          >
            {/* Document Header */}
            <div className="px-3 py-2 bg-[#080c0a] border-b border-panel-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono text-xs font-semibold text-slate-200">{docTitle}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                {docSpans.length} sentence span{docSpans.length > 1 ? "s" : ""}
              </span>
            </div>

            {/* Spans List */}
            <div className="p-2.5 space-y-2">
              {docSpans.map((span) => {
                const isCited = activeCitedSpans.has(span.id);

                return (
                  <div
                    key={span.id}
                    className={`p-2.5 rounded border transition-all text-xs font-mono leading-relaxed ${
                      isCited
                        ? "border-terminal-green bg-terminal-green/15 text-slate-100 glow-emerald"
                        : "border-panel-border/60 bg-[#080c0a]/60 text-slate-300 hover:border-panel-borderBright"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 text-[10px] text-slate-500">
                      <span className={`font-semibold ${isCited ? "text-terminal-greenBright" : "text-slate-400"}`}>
                        [{span.id}]
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="px-1 rounded bg-panel-elevated text-slate-400">
                          Hop {span.retrieval_hop}
                        </span>
                        <span className="text-slate-500">
                          Score: {span.score.toFixed(3)}
                        </span>
                      </div>
                    </div>
                    <p className="font-sans text-xs text-slate-200">{span.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
