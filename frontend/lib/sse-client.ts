import { SSEEventPayload, WarrantState, PresetTrajectory } from "./types";

export type EventCallback = (event: SSEEventPayload) => void;

/**
 * Stream events from the live FastAPI backend via Server-Sent Events (SSE).
 */
export async function streamLiveQuery(
  backendUrl: string,
  query: string,
  onEvent: EventCallback,
  onError: (error: Error) => void,
  signal?: AbortSignal
): Promise<void> {
  const url = `${backendUrl}/api/stream?query=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const block of lines) {
        if (!block.trim()) continue;
        const lineMatch = block.split("\n");
        let eventType = "message";
        let dataStr = "";

        for (const line of lineMatch) {
          if (line.startsWith("event:")) {
            eventType = line.replace("event:", "").trim();
          } else if (line.startsWith("data:")) {
            dataStr = line.replace("data:", "").trim();
          }
        }

        if (dataStr) {
          try {
            const parsed = JSON.parse(dataStr) as SSEEventPayload;
            onEvent(parsed);
          } catch (e) {
            console.warn("Failed to parse SSE line data:", dataStr, e);
          }
        }
      }
    }
  } catch (err: unknown) {
    if (signal?.aborted) {
      return;
    }
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * Simulate live SSE streaming for the bundled preset trajectories (Offline Demo Mode).
 * Yields identical state mutations and timing as the live engine.
 */
export async function streamPresetTrajectory(
  preset: PresetTrajectory,
  onEvent: EventCallback,
  signal?: AbortSignal
): Promise<void> {
  const delay = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        });
      }
    });

  try {
    // 1. query_started
    onEvent({
      event_type: "query_started",
      timestamp: new Date().toISOString(),
      data: { query: preset.query },
      telemetry: { node: "input_guard", step_duration_ms: 12 },
    });
    await delay(350);

    // 2. hop 1 completed
    const hop1Spans = preset.mockState.retrieved_spans.filter((s) => s.retrieval_hop === 1);
    onEvent({
      event_type: "hop_completed",
      node_name: "retrieve_hop_1",
      timestamp: new Date().toISOString(),
      data: {
        hop: 1,
        spans_count: hop1Spans.length,
        retrieved_spans: hop1Spans,
      },
      state_delta: {
        current_hop: 1,
        retrieved_spans: hop1Spans,
      },
      telemetry: { node: "retrieval_hop_1", step_duration_ms: 210 },
    });
    await delay(450);

    // 3. hop 2 completed (if multi-hop)
    if (preset.hopsRequired > 1) {
      onEvent({
        event_type: "hop_completed",
        node_name: "retrieve_hop_2",
        timestamp: new Date().toISOString(),
        data: {
          hop: 2,
          spans_count: preset.mockState.retrieved_spans.length,
          retrieved_spans: preset.mockState.retrieved_spans,
        },
        state_delta: {
          current_hop: 2,
          retrieved_spans: preset.mockState.retrieved_spans,
        },
        telemetry: { node: "retrieval_hop_2", step_duration_ms: 245 },
      });
      await delay(400);
    }

    // 4. claims synthesized
    onEvent({
      event_type: "claims_synthesized",
      node_name: "synthesize_claims",
      timestamp: new Date().toISOString(),
      data: {
        claims_count: preset.mockState.synthetic_claims.length,
        claims: preset.mockState.synthetic_claims,
      },
      state_delta: {
        synthetic_claims: preset.mockState.synthetic_claims,
      },
      telemetry: { node: "gemma3_synthesis", step_duration_ms: 680 },
    });
    await delay(500);

    // 5. claims verified
    onEvent({
      event_type: "claims_verified",
      node_name: "verify_claims",
      timestamp: new Date().toISOString(),
      data: {
        verified_count: preset.mockState.verified_claims.length,
        refuted_count: preset.mockState.refuted_claims.length,
        unverifiable_count: preset.mockState.unverifiable_claims.length,
      },
      state_delta: {
        verified_claims: preset.mockState.verified_claims,
        refuted_claims: preset.mockState.refuted_claims,
        unverifiable_claims: preset.mockState.unverifiable_claims,
      },
      telemetry: { node: "hybrid_verifier", step_duration_ms: 380 },
    });
    await delay(400);

    // 6. policy evaluated
    onEvent({
      event_type: "policy_evaluated",
      node_name: "evaluate_policy",
      timestamp: new Date().toISOString(),
      data: {
        decision: preset.mockState.policy_decision,
        reason: preset.mockState.policy_reason,
      },
      state_delta: {
        policy_decision: preset.mockState.policy_decision,
        policy_reason: preset.mockState.policy_reason,
      },
      telemetry: { node: "policy_contract", step_duration_ms: 15 },
    });
    await delay(300);

    // 7. answer assembled
    onEvent({
      event_type: "answer_assembled",
      node_name: "assemble_answer",
      timestamp: new Date().toISOString(),
      data: {
        final_answer: preset.mockState.final_answer,
      },
      state_delta: {
        final_answer: preset.mockState.final_answer,
      },
      telemetry: { node: "final_assembly", step_duration_ms: 25 },
    });
    await delay(200);

    // 8. complete
    onEvent({
      event_type: "complete",
      timestamp: new Date().toISOString(),
      data: {
        final_state: preset.mockState,
      },
      telemetry: { total_latency_ms: 1952 },
    });
  } catch (err: unknown) {
    if (signal?.aborted) return;
    throw err;
  }
}
