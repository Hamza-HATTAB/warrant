"use client";

import React, { useState, useEffect, useRef } from "react";
import { TopBar } from "../components/TopBar";
import { QueryInput } from "../components/QueryInput";
import { PolicyHUD } from "../components/PolicyHUD";
import { MultiHopTimeline } from "../components/MultiHopTimeline";
import { ClaimMatrix } from "../components/ClaimMatrix";
import { EvidenceDrawer } from "../components/EvidenceDrawer";
import { BenchmarkModal } from "../components/BenchmarkModal";
import { PRESET_TRAJECTORIES } from "../lib/presets";
import { PresetTrajectory, WarrantState, SSEEventPayload } from "../lib/types";
import { streamLiveQuery, streamPresetTrajectory } from "../lib/sse-client";

export default function Home() {
  const defaultPreset = PRESET_TRAJECTORIES[0];

  const [query, setQuery] = useState<string>(defaultPreset.query);
  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>(defaultPreset.id);
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState<boolean>(false);

  const [warrantState, setWarrantState] = useState<WarrantState | null>(defaultPreset.mockState);
  const [hoveredClaimId, setHoveredClaimId] = useState<string | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("Ready");

  const abortControllerRef = useRef<AbortController | null>(null);

  // Check live backend health periodically
  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/health", {
          signal: AbortSignal.timeout(2000),
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
  }, []);

  const handleSelectPreset = (preset: PresetTrajectory) => {
    if (isLoading) handleAbort();
    setSelectedPresetId(preset.id);
    setQuery(preset.query);
    setWarrantState(preset.mockState);
    setStatusMessage(`Loaded preset: ${preset.title}`);
  };

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setStatusMessage("Aborted by user.");
  };

  const handleExecute = async () => {
    if (!query.trim() || isLoading) return;

    handleAbort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    setStatusMessage("Initializing multi-hop research pipeline...");

    // Reset current state to empty structure for incoming stream
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
      policy_reason: "Processing...",
      final_answer: "",
      iteration: 1,
      retry_count: 0,
    };
    setWarrantState(emptyState);

    const handleEvent = (event: SSEEventPayload) => {
      setStatusMessage(`DAG Node [${event.node_name || event.event_type}]: Processing...`);

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
        setStatusMessage("Execution finished. Warranted attribution contract fulfilled.");
      }
    };

    const handleError = (error: Error) => {
      console.error("Stream Error:", error);
      setIsLoading(false);
      setStatusMessage(`Error: ${error.message}. Switching to Demo Mode recommended.`);
    };

    if (isLiveMode && backendConnected) {
      await streamLiveQuery("http://localhost:8000", query.trim(), handleEvent, handleError, controller.signal);
    } else {
      // Find matching preset or simulate execution for custom input
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
    <main className="min-h-screen bg-[#080c0a] text-slate-100 pb-16">
      {/* Top Bar with System Telemetry */}
      <TopBar
        isLiveMode={isLiveMode}
        setIsLiveMode={setIsLiveMode}
        onOpenBenchmark={() => setIsBenchmarkOpen(true)}
        backendConnected={backendConnected}
      />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 mt-6 space-y-6">
        {/* Terminal Query Prompt & Presets */}
        <QueryInput
          query={query}
          setQuery={setQuery}
          isLoading={isLoading}
          onExecute={handleExecute}
          onAbort={handleAbort}
          onSelectPreset={handleSelectPreset}
          selectedPresetId={selectedPresetId}
          isLiveMode={isLiveMode}
        />

        {/* Live Status Ticker */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded bg-panel border border-panel-border text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                isLoading ? "bg-terminal-green animate-ping" : "bg-slate-600"
              }`}
            />
            <span className="text-slate-300">{statusMessage}</span>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-slate-500">
            <span>LangGraph Cyclic State Machine</span>
            <span>&middot;</span>
            <span>Qdrant Dense+Sparse RRF</span>
            <span>&middot;</span>
            <span>Calibrated DeBERTa-v3</span>
          </div>
        </div>

        {/* 3-State Policy Contract HUD */}
        <PolicyHUD state={warrantState} isLoading={isLoading} />

        {/* Two-Column Telemetry & Verification Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: DAG Timeline & Claim Matrix (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <MultiHopTimeline
              currentHop={warrantState?.current_hop || 1}
              maxHops={warrantState?.max_hops || 2}
              spans={warrantState?.retrieved_spans || []}
              isLoading={isLoading}
            />

            <ClaimMatrix
              claims={warrantState?.synthetic_claims || []}
              hoveredClaimId={hoveredClaimId}
              setHoveredClaimId={setHoveredClaimId}
              selectedClaimId={selectedClaimId}
              setSelectedClaimId={setSelectedClaimId}
            />
          </div>

          {/* Right Column: Grounded Evidence Drawer (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <EvidenceDrawer
              spans={warrantState?.retrieved_spans || []}
              claims={warrantState?.synthetic_claims || []}
              hoveredClaimId={hoveredClaimId}
              selectedClaimId={selectedClaimId}
            />
          </div>
        </div>
      </div>

      {/* Verifier Bake-Off Modal */}
      <BenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
      />
    </main>
  );
}
