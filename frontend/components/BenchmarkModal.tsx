"use client";

import React from "react";
import { X, Trophy, CheckCircle, AlertTriangle, Cpu, Zap, ShieldCheck } from "lucide-react";
import { BENCHMARK_METRICS } from "../lib/presets";

interface BenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BenchmarkModal: React.FC<BenchmarkModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl rounded-lg border border-terminal-green/40 bg-[#0d1511] p-6 shadow-2xl glow-emerald-lg max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-panel-border">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-terminal-lime" />
            <div>
              <h2 className="font-mono text-base font-bold text-slate-100">
                EMPIRICAL VERIFIER BAKE-OFF &amp; LATENCY BENCHMARK
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                HotpotQA Multi-Hop Grounding Evaluation &middot; NVIDIA RTX 4060 vs CPU DeBERTa-v3
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded bg-panel border border-panel-border text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Benchmark Results Grid */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {BENCHMARK_METRICS.map((metric, idx) => {
            const isWinner = metric.name.includes("WARRANT");
            const isJudge = metric.name.includes("Judge");

            return (
              <div
                key={metric.name}
                className={`rounded border p-4 flex flex-col justify-between transition-all ${
                  isWinner
                    ? "border-terminal-green bg-terminal-green/10 ring-1 ring-terminal-green/40 glow-emerald"
                    : "border-panel-border bg-panel"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="font-mono text-xs font-bold text-slate-200 truncate">
                      {metric.name}
                    </span>
                    {isWinner && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-terminal-green text-black font-bold">
                        WINNER
                      </span>
                    )}
                  </div>

                  {/* Hallucination Rate Metric */}
                  <div className="my-3 space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Hallucination Rate:</span>
                      <span
                        className={`font-bold ${
                          metric.hallucination_rate === 0
                            ? "text-terminal-greenBright text-sm"
                            : "text-terminal-rose text-sm"
                        }`}
                      >
                        {(metric.hallucination_rate * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Precision:</span>
                      <span
                        className={`font-semibold ${
                          metric.precision === 1.0 ? "text-terminal-greenBright" : "text-slate-200"
                        }`}
                      >
                        {(metric.precision * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Verifier Latency:</span>
                      <span className="text-slate-200">
                        {metric.verification_latency_ms > 0 ? `${metric.verification_latency_ms} ms` : "0 ms (N/A)"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">GPU VRAM Overhead:</span>
                      <span
                        className={`font-semibold ${
                          metric.gpu_vram_mb === 0 ? "text-terminal-greenBright" : "text-terminal-amber"
                        }`}
                      >
                        {metric.gpu_vram_mb} MB
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 font-sans border-t border-panel-border/60 pt-2 leading-relaxed">
                  {metric.notes}
                </p>
              </div>
            );
          })}
        </div>

        {/* Technical Architectural Takeaways */}
        <div className="mt-6 rounded border border-panel-border bg-[#080c0a] p-4 space-y-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-terminal-lime font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>Senior Architectural Takeaways (Why WARRANT Beats Generative Verification)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300 font-sans text-xs leading-relaxed">
            <div className="p-3 rounded bg-panel border border-panel-border">
              <div className="font-mono font-semibold text-terminal-greenBright mb-1">
                1. Elimination of Sycophancy &amp; Bias
              </div>
              <p className="text-slate-400">
                Prompted LLM-as-a-judge defaults to self-confirmation bias, failing on fine-grained numeral mutations (e.g. 1989 vs 1999). DeBERTa-v3 cross-encoder loss penalizes token misalignment deterministically.
              </p>
            </div>

            <div className="p-3 rounded bg-panel border border-panel-border">
              <div className="font-mono font-semibold text-terminal-lime mb-1">
                2. Zero GPU VRAM Contention
              </div>
              <p className="text-slate-400">
                Running a second 12B LLM pass consumes 12GB+ VRAM, causing CUDA OOM on typical 8GB–16GB developer GPUs. WARRANT offloads DeBERTa-v3 to 8 CPU threads with sub-700ms latency and 0 MB VRAM usage.
              </p>
            </div>

            <div className="p-3 rounded bg-panel border border-panel-border">
              <div className="font-mono font-semibold text-terminal-cyan mb-1">
                3. Sub-Millisecond Guard Pre-Filter
              </div>
              <p className="text-slate-400">
                Deterministic regex guards check numbers and named entities in &lt;1ms, short-circuiting 100% of arithmetic/calendar hallucinations before deep transformer inference is even invoked.
              </p>
            </div>

            <div className="p-3 rounded bg-panel border border-panel-border">
              <div className="font-mono font-semibold text-terminal-amber mb-1">
                4. Strict 3-State Contract
              </div>
              <p className="text-slate-400">
                Unlike binary RAG that always forces an answer, WARRANT enforces <code className="text-terminal-amber">FULL_PASS</code>, <code className="text-terminal-amber">PARTIAL_PASS</code>, and <code className="text-terminal-rose">ABSTAIN</code>, eliminating unsupported claims across our 200 HotpotQA evaluation questions via selective abstention.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-panel border border-panel-border text-slate-300 hover:text-white text-xs font-mono transition-colors"
          >
            Close Benchmark
          </button>
        </div>
      </div>
    </div>
  );
};
