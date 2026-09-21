"use client";

import React, { useState, useEffect } from "react";
import { X, Radio, CheckCircle2, AlertCircle, Wifi, Cpu, Zap, ExternalLink, RefreshCw } from "lucide-react";

interface LiveConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  backendUrl: string;
  setBackendUrl: (url: string) => void;
  isLiveMode: boolean;
  setIsLiveMode: (val: boolean) => void;
}

export const LiveConnectionModal: React.FC<LiveConnectionModalProps> = ({
  isOpen,
  onClose,
  backendUrl,
  setBackendUrl,
  isLiveMode,
  setIsLiveMode,
}) => {
  const [inputUrl, setInputUrl] = useState<string>(backendUrl);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    generatorModel?: string;
    verifierModel?: string;
    vramFreeMb?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    setInputUrl(backendUrl);
  }, [backendUrl]);

  if (!isOpen) return null;

  const testConnection = async (targetUrl: string) => {
    setIsTesting(true);
    setTestResult(null);
    const start = performance.now();

    try {
      const cleanUrl = targetUrl.replace(/\/+$/, "");
      const res = await fetch(`${cleanUrl}/api/health`, {
        signal: AbortSignal.timeout(4000),
      });

      const elapsed = Math.round(performance.now() - start);

      if (res.ok) {
        const data = await res.json();
        setTestResult({
          success: true,
          latencyMs: elapsed,
          generatorModel: data.generator_model,
          verifierModel: data.verifier_model,
          vramFreeMb: data.vram_free_mb,
        });
      } else {
        setTestResult({
          success: false,
          error: `HTTP ${res.status}: ${res.statusText}`,
        });
      }
    } catch (err: unknown) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : "Connection timed out or refused.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAndActivate = () => {
    const cleanUrl = inputUrl.replace(/\/+$/, "").trim();
    setBackendUrl(cleanUrl);
    if (typeof window !== "undefined") {
      localStorage.setItem("warrant_backend_url", cleanUrl);
    }
    setIsLiveMode(true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl glass-panel-elevated p-6 shadow-2xl border border-emerald-500/30">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Live RTX 4060 GPU Tunnel Configuration
              </h2>
              <p className="text-xs text-slate-400">
                Connect this Vercel web app directly to your local Gemma 3 12B model
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-black/40 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-4 p-3.5 rounded-xl bg-black/40 border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-1.5 font-sans">
          <p className="font-semibold text-emerald-400">How to run a live demonstration for interviews:</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-400">
            <li>Run <code className="font-mono text-emerald-300 bg-emerald-950/60 px-1 py-0.5 rounded">make tunnel</code> on your laptop to start your zero-trust Cloudflare HTTPS tunnel.</li>
            <li>Copy the public URL (e.g. <code className="font-mono text-cyan-300">https://xxx.trycloudflare.com</code>) and paste it below.</li>
            <li>Click <strong>Test Connection</strong>, then <strong>Activate Live GPU</strong>.</li>
          </ol>
        </div>

        {/* Input Form */}
        <div className="mt-5 space-y-3">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Backend Endpoint URL:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://your-tunnel.trycloudflare.com or http://localhost:8000"
              className="flex-1 bg-black/60 border border-slate-700 focus:border-emerald-400 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
            <button
              type="button"
              onClick={() => testConnection(inputUrl)}
              disabled={isTesting || !inputUrl.trim()}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
            >
              {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
              <span>Test</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Quick presets:</span>
            <button
              type="button"
              onClick={() => {
                setInputUrl("http://localhost:8000");
                testConnection("http://localhost:8000");
              }}
              className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/30 border border-slate-800 text-slate-300 hover:text-white"
            >
              http://localhost:8000
            </button>
          </div>
        </div>

        {/* Live Test Feedback Diagnostic */}
        {testResult && (
          <div
            className={`mt-4 p-4 rounded-xl border text-xs leading-relaxed transition-all ${
              testResult.success
                ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-200"
                : "bg-rose-950/40 border-rose-500/30 text-rose-200"
            }`}
          >
            <div className="flex items-center gap-2 font-bold mb-2">
              {testResult.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Connection Verified! Remote GPU Online ({testResult.latencyMs}ms ping)</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span>Connection Failed: {testResult.error}</span>
                </>
              )}
            </div>

            {testResult.success && (
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 mt-2 pt-2 border-t border-emerald-500/20">
                <div>Model: <span className="text-emerald-300 font-bold">{testResult.generatorModel}</span></div>
                <div>Verifier: <span className="text-lime-300">DeBERTa-v3 (CPU)</span></div>
                <div>GPU VRAM Headroom: <span className="text-cyan-300">{testResult.vramFreeMb?.toFixed(0)} MB</span></div>
                <div>Transport: <span className="text-slate-300">SSE over HTTPS</span></div>
              </div>
            )}
          </div>
        )}

        {/* Footer Controls */}
        <div className="mt-6 flex items-center justify-between pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              setIsLiveMode(false);
              onClose();
            }}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Use Offline Demo Mode
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndActivate}
              disabled={Boolean(testResult && !testResult.success)}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 disabled:opacity-40"
            >
              Activate Live GPU
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
