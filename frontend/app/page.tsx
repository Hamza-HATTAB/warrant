"use client";

import React, { useState, useEffect, useRef } from "react";
import { Navbar } from "../components/Navbar";
import { QueryBar } from "../components/QueryBar";
import { EpistemicLatticeCanvas } from "../components/EpistemicLatticeCanvas";
import { CitationDisassembler } from "../components/CitationDisassembler";
import { VerificationStudioTabs } from "../components/VerificationStudioTabs";
import { StepInspector } from "../components/StepInspector";
import { BenchmarkModal } from "../components/BenchmarkModal";
import { LiveConnectionModal } from "../components/LiveConnectionModal";
import { PRESET_TRAJECTORIES } from "../lib/presets";
import {
  PresetTrajectory,
  WarrantState,
  SSEEventPayload,
  EvidenceSpan,
  AtomicClaim,
  PolicyDecision,
} from "../lib/types";
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
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>("c_001");

  const [warrantState, setWarrantState] = useState<WarrantState | null>(defaultPreset.mockState);
  const [statusMessage, setStatusMessage] = useState<string>("Epistemic Verification Cockpit Ready");

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load saved backend URL
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
    setSelectedClaimId(preset.mockState.synthetic_claims[0]?.claim_id || null);
    setStatusMessage(`Loaded trajectory: ${preset.title}`);
  };

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setStatusMessage("Pipeline execution interrupted by user.");
  };

  const handleExecute = async () => {
    if (!query.trim() || isLoading) return;

    handleAbort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    setActiveStep(1);
    setStatusMessage("Executing multi-hop epistemic verification...");

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
      policy_reason: "Evaluating multi-hop attribution DAG...",
      final_answer: "",
      iteration: 1,
      retry_count: 0,
    };
    setWarrantState(emptyState);

    const handleEvent = (event: SSEEventPayload) => {
      setStatusMessage(`Phase [${event.node_name || event.event_type}]: Active`);

      setWarrantState((prev) => {
        if (!prev) return emptyState;
        const next: WarrantState = { ...prev };

        if (event.state_delta) {
          Object.assign(next, event.state_delta);
        }

        if (event.event_type === "hop_completed") {
          setActiveStep(3);
          if (Array.isArray(event.data?.retrieved_spans)) {
            next.retrieved_spans = event.data.retrieved_spans as EvidenceSpan[];
          }
          if (typeof event.data?.hop === "number") {
            next.current_hop = event.data.hop;
          }
        } else if (event.event_type === "claims_synthesized") {
          setActiveStep(4);
          if (Array.isArray(event.data?.claims)) {
            next.synthetic_claims = event.data.claims as AtomicClaim[];
            setSelectedClaimId(next.synthetic_claims[0]?.claim_id || null);
          }
        } else if (event.event_type === "claims_verified") {
          setActiveStep(6);
          if (event.state_delta?.verified_claims) {
            next.verified_claims = event.state_delta.verified_claims;
          }
          if (event.state_delta?.refuted_claims) {
            next.refuted_claims = event.state_delta.refuted_claims;
          }
        } else if (event.event_type === "policy_evaluated") {
          setActiveStep(7);
          const decision = event.data?.decision;
          if (decision === "FULL_PASS" || decision === "PARTIAL_PASS" || decision === "ABSTAIN") {
            next.policy_decision = decision as PolicyDecision;
          }
          if (typeof event.data?.reason === "string") {
            next.policy_reason = event.data.reason;
          }
        } else if (event.event_type === "answer_assembled") {
          if (typeof event.data?.final_answer === "string") {
            next.final_answer = event.data.final_answer;
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
        setStatusMessage("Execution complete. 3-state selective abstention contract validated.");
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
    <main className="min-h-screen bg-[#030712] text-slate-100 pb-20 selection:bg-emerald-500/30 selection:text-white">
      {/* Flagship Navbar */}
      <Navbar
        isLiveMode={isLiveMode}
        setIsLiveMode={setIsLiveMode}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenBenchmark={() => setIsBenchmarkOpen(true)}
        onOpenLiveSettings={() => setIsLiveModalOpen(true)}
        backendConnected={backendConnected}
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-10">
        {/* 1. Full-Bleed 3D Spatial Hero Section */}
        <section className="space-y-6">
          {/* High-Impact Editorial Statement */}
          <div className="max-w-4xl mx-auto text-center space-y-4 pt-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Flagship Epistemic Attribution Cockpit</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight font-sans text-metallic leading-tight">
              WARRANT <span className="text-gradient-emerald">&middot;</span> Dual-Stage Attribution
            </h1>

            <p className="text-base sm:text-lg text-slate-400 font-normal leading-relaxed max-w-2xl mx-auto">
              Eliminating citation decoration and hallucinations through asymmetric compute partitioning: Gemma-3 12B on 8GB RTX 4060 GPU and calibrated DeBERTa-v3 cross-encoder on CPU.
            </p>
          </div>

          {/* Floating Frosted Glass Query Capsule & Preset Selector Pills */}
          <div className="max-w-3xl mx-auto">
            <QueryBar
              query={query}
              setQuery={setQuery}
              isLoading={isLoading}
              onExecute={handleExecute}
              onAbort={handleAbort}
              onSelectPreset={handleSelectPreset}
              selectedPresetId={selectedPresetId}
            />
          </div>

          {/* Full-Bleed Spatial 3D Epistemic Lattice */}
          <div className="w-full pt-2">
            <EpistemicLatticeCanvas
              state={warrantState}
              selectedClaimId={selectedClaimId}
              onSelectClaim={(id) => setSelectedClaimId(id)}
            />
          </div>
        </section>

        {/* 2. The Integrated 2-Column Split Studio */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Epistemic Trajectory & Citation Disassembler (7 cols) */}
          <div className="lg:col-span-7">
            <CitationDisassembler
              state={warrantState}
              selectedClaimId={selectedClaimId}
              onSelectClaim={(id) => setSelectedClaimId(id)}
            />
          </div>

          {/* Right Column: Verification Engine & Telemetry Tabs (5 cols) */}
          <div className="lg:col-span-5 sticky top-24">
            <VerificationStudioTabs
              state={warrantState}
              isLoading={isLoading}
              activeNodeIndex={activeStep}
              onSelectNode={(step) => setActiveStep(step)}
            />
          </div>
        </section>
      </div>

      {/* Step Inspector Drawer */}
      {activeStep > 0 && (
        <StepInspector
          stepNumber={activeStep}
          onClose={() => setActiveStep(0)}
          state={warrantState}
        />
      )}

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
