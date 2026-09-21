"use client";

import React, { useState, useEffect, useRef } from "react";
import { Navbar } from "../components/Navbar";
import { QueryBar } from "../components/QueryBar";
import { PipelineStepper } from "../components/PipelineStepper";
import { StepInspector } from "../components/StepInspector";
import { VerificationStudio } from "../components/VerificationStudio";
import { BenchmarkModal } from "../components/BenchmarkModal";
import { LiveConnectionModal } from "../components/LiveConnectionModal";
import { PRESET_TRAJECTORIES } from "../lib/presets";
import { PresetTrajectory, WarrantState, SSEEventPayload } from "../lib/types";
import { streamLiveQuery, streamPresetTrajectory } from "../lib/sse-client";

export default function Home() {
  const defaultPreset = PRESET_TRAJECTORIES[0];

  const [query, setQuery] = useState<string>(defaultPreset.query);
  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>(defaultPreset.id);
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);
  const [backendUrl, setBackendUrl] = useState<string>("http://localhost:8000");
  const [isLiveModalOpen, setIsLiveModalOpen] = useState<boolean>(false);
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"executive" | "telemetry">("executive");

  const [warrantState, setWarrantState] = useState<WarrantState | null>(defaultPreset.mockState);
  const [statusMessage, setStatusMessage] = useState<string>("Ready");

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load saved backend URL from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("warrant_backend_url");
      if (saved) setBackendUrl(saved);
    }
  }, []);

  // Probe live FastAPI backend health periodically
  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const cleanUrl = backendUrl.replace(/\/+$/, "");
        const res = await fetch(`${cleanUrl}/api/health`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok && isMounted) {
          setBackendConnected(true);
        } else if (isMounted) {
          setBackendConnected(false);
        }
      } catch {
        if (isMounted) setBackendConnected(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [backendUrl]);


  const handleSelectPreset = (preset: PresetTrajectory) => {
    if (isLoading) handleAbort();
    setSelectedPresetId(preset.id);
    setQuery(preset.query);
    setWarrantState(preset.mockState);
    setActiveStep(0);
    setStatusMessage(`Loaded trajectory: ${preset.title}`);
  };

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setStatusMessage("Execution cancelled by user.");
  };

  const handleExecute = async () => {
    if (!query.trim() || isLoading) return;

    handleAbort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    setActiveStep(0);
    setStatusMessage("Initializing multi-hop research pipeline...");

    // Initial empty state for incoming stream
    const emptyState: WarrantState = {
      query: query.trim(),
      current_hop: 0,
      max_hops: 2,
      retrieved_spans: [],
      synthetic_claims: [],
      verified_claims: [],
      refuted_claims: [],
      unverifiable_claims: [],
      policy_decision: "FULL_PASS",
      policy_reason: "Processing research pipeline...",
      final_answer: "",
      iteration: 1,
      retry_count: 0,
    };
    setWarrantState(emptyState);

    const handleEvent = (event: SSEEventPayload) => {
      setStatusMessage(`Phase [${event.node_name || event.event_type}]: Processing...`);

      setWarrantState((prev) => {
        if (!prev) return emptyState;
        const next = { ...prev };

        if (event.state_delta) {
          Object.assign(next, event.state_delta);
        }

        if (event.event_type === "hop_completed") {
          const newSpans = (event.data?.retrieved_spans as any[]) || [];
          if (newSpans.length > 0) {
            next.retrieved_spans = newSpans;
          }
          if (typeof event.data?.hop === "number") {
            next.current_hop = event.data.hop;
          }
        } else if (event.event_type === "claims_synthesized") {
          const claims = (event.data?.claims as any[]) || [];
          if (claims.length > 0) {
            next.synthetic_claims = claims;
          }
        } else if (event.event_type === "claims_verified") {
          if (event.state_delta?.verified_claims) {
            next.verified_claims = event.state_delta.verified_claims;
          }
          if (event.state_delta?.refuted_claims) {
            next.refuted_claims = event.state_delta.refuted_claims;
          }
        } else if (event.event_type === "policy_evaluated") {
          if (event.data?.decision) {
            next.policy_decision = event.data.decision as any;
          }
          if (event.data?.reason) {
            next.policy_reason = event.data.reason as string;
          }
        } else if (event.event_type === "answer_assembled") {
          if (event.data?.final_answer) {
            next.final_answer = event.data.final_answer as string;
          }
        } else if (event.event_type === "complete") {
          if (event.data?.final_state) {
            return event.data.final_state as WarrantState;
          }
        }

        return next;
      });

      if (event.event_type === "complete") {
        setIsLoading(false);
        setStatusMessage("Execution complete. Selective abstention policy contract evaluated.");
      }
    };

    const handleError = (error: Error) => {
      console.error("Pipeline Error:", error);
      setIsLoading(false);
      setStatusMessage(`Error: ${error.message}`);
    };

    if (isLiveMode && backendConnected) {
      await streamLiveQuery(backendUrl, query.trim(), handleEvent, handleError, controller.signal);
    } else {
      const matchingPreset = PRESET_TRAJECTORIES.find(
        (p) => p.query.toLowerCase().trim() === query.toLowerCase().trim()
      );
      const targetPreset = matchingPreset || {
        ...defaultPreset,
        query: query.trim(),
        mockState: {
          ...defaultPreset.mockState,
          query: query.trim(),
        },
      };

      await streamPresetTrajectory(targetPreset, handleEvent, controller.signal);
    }
  };

  return (
    <main className="min-h-screen pb-20">
      {/* Brand Navbar */}
      <Navbar
        isLiveMode={isLiveMode}
        setIsLiveMode={setIsLiveMode}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenBenchmark={() => setIsBenchmarkOpen(true)}
        onOpenLiveSettings={() => setIsLiveModalOpen(true)}
        backendConnected={backendConnected}
      />

      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 mt-6 space-y-6">
        {/* Search Query Prompt & Preset Trajectories */}
        <QueryBar
          query={query}
          setQuery={setQuery}
          isLoading={isLoading}
          onExecute={handleExecute}
          onAbort={handleAbort}
          onSelectPreset={handleSelectPreset}
          selectedPresetId={selectedPresetId}
        />

        {/* Live Status Bar */}
        <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-black/40 border border-slate-800/80 text-xs text-slate-400 font-sans shadow-sm">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isLoading ? "bg-emerald-400 animate-ping" : "bg-emerald-500/60"
              }`}
            />
            <span className="text-slate-200 font-medium">{statusMessage}</span>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-slate-400 font-mono text-[11px]">
            <span>Endpoint: {backendConnected && isLiveMode ? backendUrl : "Offline Simulator"}</span>
            <span>&middot;</span>
            <span>Gemma 3 12B Unified</span>
            <span>&middot;</span>
            <span>DeBERTa-v3 CPU</span>
          </div>
        </div>

        {/* Visual 5-Phase Pipeline Stepper */}
        <PipelineStepper
          state={warrantState}
          isLoading={isLoading}
          activeStep={activeStep}
          setActiveStep={setActiveStep}
        />

        {/* Educational Deep Dive Drawer (Appears when user clicks any step) */}
        {activeStep > 0 && (
          <StepInspector
            stepNumber={activeStep}
            onClose={() => setActiveStep(0)}
            state={warrantState}
          />
        )}

        {/* The Split-Screen Verification Studio (Core Experience) */}
        <VerificationStudio
          state={warrantState}
          isLoading={isLoading}
          viewMode={viewMode}
        />
      </div>

      {/* Live GPU Connection Modal */}
      <LiveConnectionModal
        isOpen={isLiveModalOpen}
        onClose={() => setIsLiveModalOpen(false)}
        backendUrl={backendUrl}
        setBackendUrl={setBackendUrl}
        isLiveMode={isLiveMode}
        setIsLiveMode={setIsLiveMode}
      />

      {/* Verifier Bake-Off Modal */}
      <BenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
      />
    </main>
  );
}

