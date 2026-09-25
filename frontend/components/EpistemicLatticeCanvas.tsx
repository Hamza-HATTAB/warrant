"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { WarrantState, AtomicClaim, EvidenceSpan } from "../lib/types";

interface NodeData {
  id: string;
  label: string;
  type: "document" | "claim" | "guard" | "query";
  status: "verified" | "refuted" | "neutral" | "pending";
  position: THREE.Vector3;
  targetPosition: THREE.Vector3;
  velocity: THREE.Vector3;
  score?: number;
  latencyMs?: number;
  details: string;
}

interface EpistemicLatticeCanvasProps {
  state: WarrantState | null;
  className?: string;
}

export const EpistemicLatticeCanvas: React.FC<EpistemicLatticeCanvasProps> = ({
  state,
  className = "",
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const container = mountRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // Sizing
    let width = container.clientWidth || 800;
    let height = container.clientHeight || 500;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030712, 0.035);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 0, 18);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const pointLightEmerald = new THREE.PointLight(0x10b981, 2.5, 50);
    pointLightEmerald.position.set(5, 5, 8);
    scene.add(pointLightEmerald);

    const pointLightCyan = new THREE.PointLight(0x06b6d4, 2.0, 50);
    pointLightCyan.position.set(-5, -4, 6);
    scene.add(pointLightCyan);

    // Group for mouse parallax tilt
    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    // 1. Build Nodes
    const nodes: NodeData[] = [];
    const meshes: THREE.Mesh[] = [];
    const pulseMeshes: THREE.Mesh[] = [];

    // Query Root Node
    const queryText = state?.query || "Which magazine was started first?";
    nodes.push({
      id: "node_query",
      label: "Query Node",
      type: "query",
      status: "verified",
      position: new THREE.Vector3(0, 4.2, 0),
      targetPosition: new THREE.Vector3(0, 4.2, 0),
      velocity: new THREE.Vector3(),
      details: queryText,
    });

    // Document Nodes from retrieved spans
    const spans: EvidenceSpan[] = state?.retrieved_spans && state.retrieved_spans.length > 0
      ? state.retrieved_spans
      : [
          {
            id: "doc_1",
            doc_title: "Arthur's Magazine (1844)",
            text: "Arthur's Magazine was founded in 1844 in Philadelphia.",
            char_start: 0,
            char_end: 55,
            retrieval_hop: 1,
            score: 0.942,
          },
          {
            id: "doc_2",
            doc_title: "First for Women (1989)",
            text: "First for Women was started in 1989 by Bauer Media.",
            char_start: 0,
            char_end: 52,
            retrieval_hop: 2,
            score: 0.956,
          },
        ];

    const uniqueDocs = Array.from(new Set(spans.map((s) => s.doc_title)));
    uniqueDocs.forEach((docTitle, idx) => {
      const angle = (idx / Math.max(uniqueDocs.length, 1)) * Math.PI * 0.8 + 0.3;
      const x = (idx % 2 === 0 ? -1 : 1) * (3.8 + idx * 0.8);
      const y = 1.2 - idx * 0.6;
      const z = (idx % 2 === 0 ? 1 : -1) * 1.5;

      const span = spans.find((s) => s.doc_title === docTitle);
      nodes.push({
        id: `node_doc_${idx}`,
        label: docTitle,
        type: "document",
        status: "verified",
        position: new THREE.Vector3(x, y, z),
        targetPosition: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(),
        score: span?.score ?? 0.95,
        details: span?.text || "Source context span retrieved on CPU cross-encoder.",
      });
    });

    // Claim Nodes from synthetic claims
    const claims: AtomicClaim[] = state?.synthetic_claims && state.synthetic_claims.length > 0
      ? state.synthetic_claims
      : [
          {
            claim_id: "c_001",
            text: "Arthur's Magazine was founded in 1844.",
            cited_spans: ["doc_1"],
            guard_status: "PASSED",
            guard_reasons: [],
            nli_label: "ENTAILMENT",
            nli_entailment_prob: 0.964,
            nli_neutral_prob: 0.026,
            nli_contradiction_prob: 0.01,
            nli_inference_latency_ms: 182,
            verification_status: "VERIFIED",
          },
          {
            claim_id: "c_002",
            text: "First for Women was started in 1989.",
            cited_spans: ["doc_2"],
            guard_status: "PASSED",
            guard_reasons: [],
            nli_label: "ENTAILMENT",
            nli_entailment_prob: 0.981,
            nli_neutral_prob: 0.012,
            nli_contradiction_prob: 0.007,
            nli_inference_latency_ms: 174,
            verification_status: "VERIFIED",
          },
        ];

    claims.forEach((claim, idx) => {
      const x = (idx === 0 ? -2.2 : idx === 1 ? 2.2 : 0) + (idx > 1 ? (idx - 1) * 2.5 : 0);
      const y = -2.5 - (idx % 2) * 0.8;
      const z = (idx % 2 === 0 ? 0.8 : -0.8);

      const status = claim.verification_status === "VERIFIED"
        ? "verified"
        : claim.verification_status === "REFUTED"
        ? "refuted"
        : "pending";

      nodes.push({
        id: claim.claim_id,
        label: `Claim: ${claim.text.slice(0, 32)}...`,
        type: "claim",
        status,
        position: new THREE.Vector3(x, y, z),
        targetPosition: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(),
        score: claim.nli_entailment_prob,
        latencyMs: claim.nli_inference_latency_ms,
        details: `${claim.text} (Guard: ${claim.guard_status}, τ=${claim.nli_entailment_prob.toFixed(3)})`,
      });
    });

    // Deterministic Entity Guard Arbiter Node
    nodes.push({
      id: "node_guard",
      label: "Stage-1 Entity Guard (<1ms)",
      type: "guard",
      status: "verified",
      position: new THREE.Vector3(0, -0.6, 1.2),
      targetPosition: new THREE.Vector3(0, -0.6, 1.2),
      velocity: new THREE.Vector3(),
      latencyMs: 0.42,
      score: 1.0,
      details: "Deterministic numerical regex & entity validation completed in 0.42ms",
    });

    // Create 3D Meshes for Nodes
    nodes.forEach((node) => {
      let geometry: THREE.BufferGeometry;
      let color = 0x10b981; // Emerald

      if (node.type === "query") {
        geometry = new THREE.OctahedronGeometry(0.75, 0);
        color = 0x38bdf8; // Sky / Cyan
      } else if (node.type === "document") {
        geometry = new THREE.DodecahedronGeometry(0.65, 0);
        color = 0x06b6d4; // Cyan
      } else if (node.type === "guard") {
        geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        color = 0x8b5cf6; // Purple / Guard
      } else {
        // Claim
        geometry = new THREE.IcosahedronGeometry(0.55, 1);
        if (node.status === "verified") {
          color = 0x10b981; // Emerald
        } else if (node.status === "refuted") {
          color = 0xef4444; // Crimson
        } else {
          color = 0xf59e0b; // Amber
        }
      }

      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.2,
        metalness: 0.8,
        emissive: color,
        emissiveIntensity: 0.35,
        wireframe: false,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(node.position);
      mesh.userData = { nodeData: node };
      graphGroup.add(mesh);
      meshes.push(mesh);

      // Wireframe overlay shell for tech aesthetic
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.15,
      });
      const wireMesh = new THREE.Mesh(geometry, wireMat);
      wireMesh.scale.set(1.15, 1.15, 1.15);
      mesh.add(wireMesh);

      // Radial Pulse Shockwave for verified nodes
      if (node.status === "verified" || node.type === "guard") {
        const pulseGeo = new THREE.RingGeometry(0.7, 0.8, 32);
        const pulseMat = new THREE.MeshBasicMaterial({
          color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.4,
        });
        const pulse = new THREE.Mesh(pulseGeo, pulseMat);
        pulse.position.copy(node.position);
        pulse.rotation.x = Math.PI / 2;
        pulse.userData = { initialScale: 1.0, maxScale: 2.8, speed: 0.015 + Math.random() * 0.01 };
        graphGroup.add(pulse);
        pulseMeshes.push(pulse);
      }
    });

    // 2. Spring-Tensioned Edges Connecting Nodes
    const edges: Array<{ from: NodeData; to: NodeData }> = [];

    // Query connects to all docs
    const queryNode = nodes.find((n) => n.type === "query");
    const docNodes = nodes.filter((n) => n.type === "document");
    const guardNode = nodes.find((n) => n.type === "guard");
    const claimNodes = nodes.filter((n) => n.type === "claim");

    if (queryNode) {
      docNodes.forEach((doc) => edges.push({ from: queryNode, to: doc }));
    }

    if (guardNode) {
      docNodes.forEach((doc) => edges.push({ from: doc, to: guardNode }));
      claimNodes.forEach((claim) => edges.push({ from: guardNode, to: claim }));
    }

    // Dynamic Line Segments
    const linePositions = new Float32Array(edges.length * 6);
    const lineColors = new Float32Array(edges.length * 6);

    edges.forEach((edge, idx) => {
      const i = idx * 6;
      linePositions[i] = edge.from.position.x;
      linePositions[i + 1] = edge.from.position.y;
      linePositions[i + 2] = edge.from.position.z;
      linePositions[i + 3] = edge.to.position.x;
      linePositions[i + 4] = edge.to.position.y;
      linePositions[i + 5] = edge.to.position.z;

      // Color gradient along edge
      const c1 = edge.from.type === "query" ? new THREE.Color(0x38bdf8) : new THREE.Color(0x06b6d4);
      const c2 = edge.to.status === "verified" ? new THREE.Color(0x10b981) : new THREE.Color(0xf59e0b);

      lineColors[i] = c1.r;
      lineColors[i + 1] = c1.g;
      lineColors[i + 2] = c1.b;
      lineColors[i + 3] = c2.r;
      lineColors[i + 4] = c2.g;
      lineColors[i + 5] = c2.b;
    });

    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    edgeGeometry.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));

    const edgeMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.45,
      linewidth: 1.5,
    });

    const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    graphGroup.add(edgeLines);

    // 3. Ambient Particle Spark Cloud (Obsidian Field)
    const particleCount = 180;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      particlePositions[idx] = (Math.random() - 0.5) * 35;
      particlePositions[idx + 1] = (Math.random() - 0.5) * 25;
      particlePositions[idx + 2] = (Math.random() - 0.5) * 25;

      const pColor = Math.random() > 0.5 ? new THREE.Color(0x10b981) : new THREE.Color(0x06b6d4);
      particleColors[idx] = pColor.r;
      particleColors[idx + 1] = pColor.g;
      particleColors[idx + 2] = pColor.b;
    }

    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);

    // 4. Mouse Inertia Parallax & Raycasting
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const raycaster = new THREE.Raycaster();
    const mouseVector = new THREE.Vector2();

    const onMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      mouse.targetX = x;
      mouse.targetY = y;

      mouseVector.x = x;
      mouseVector.y = y;

      setTooltipPos({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    container.addEventListener("mousemove", onMouseMove);

    // 5. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Mouse Inertia Damping
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      // Parallax Tilt on Group
      graphGroup.rotation.y = mouse.x * 0.45 + Math.sin(time * 0.2) * 0.05;
      graphGroup.rotation.x = -mouse.y * 0.35 + Math.cos(time * 0.25) * 0.04;

      // Floating gentle bobbing on individual nodes
      meshes.forEach((mesh, index) => {
        mesh.rotation.x += 0.006 * ((index % 3) + 1);
        mesh.rotation.y += 0.008 * ((index % 2) + 1);
        mesh.position.y += Math.sin(time * 1.5 + index) * 0.002;
      });

      // Animate Radial Pulse Waves
      pulseMeshes.forEach((pulse) => {
        const u = pulse.userData;
        pulse.scale.x += u.speed;
        pulse.scale.y += u.speed;
        const mat = pulse.material as THREE.MeshBasicMaterial;
        mat.opacity = THREE.MathUtils.lerp(0.5, 0, (pulse.scale.x - 1) / (u.maxScale - 1));

        if (pulse.scale.x > u.maxScale) {
          pulse.scale.set(1.0, 1.0, 1.0);
          mat.opacity = 0.5;
        }
      });

      // Slowly rotate particle field
      particleSystem.rotation.y = time * 0.02;

      // Raycasting for interactive hover
      raycaster.setFromCamera(mouseVector, camera);
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const topHit = intersects[0].object as THREE.Mesh;
        const nodeData = topHit.userData.nodeData as NodeData | undefined;
        if (nodeData) {
          setHoveredNode(nodeData);
          topHit.scale.lerp(new THREE.Vector3(1.25, 1.25, 1.25), 0.15);
        }
      } else {
        setHoveredNode(null);
        meshes.forEach((m) => {
          m.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    // 6. Responsive Resize Observer
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      width = container.clientWidth;
      height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener("mousemove", onMouseMove);
      resizeObserver.disconnect();
      meshes.forEach((m) => {
        m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material.dispose();
      });
      pulseMeshes.forEach((p) => {
        p.geometry.dispose();
        (p.material as THREE.Material).dispose();
      });
      edgeGeometry.dispose();
      edgeMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
    };
  }, [state]);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-[360px] md:h-[440px] rounded-2xl overflow-hidden border border-emerald-500/20 bg-[#030712]/90 backdrop-blur-xl shadow-2xl ${className}`}
    >
      {/* 3D Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />

      {/* Epistemic Lattice Canvas HUD Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 border border-emerald-500/30 backdrop-blur-md">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-300 font-semibold">
          Epistemic Verification Lattice (WebGL)
        </span>
      </div>

      <div className="absolute top-4 right-4 z-10 hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-black/60 border border-slate-800 backdrop-blur-md text-[11px] font-mono text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-400" /> Query
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400" /> Evidence
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-400" /> Guard
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" /> Claim
        </span>
      </div>

      {/* Interactive Hover HUD Card */}
      {hoveredNode && (
        <div
          className="absolute pointer-events-none z-30 w-72 rounded-xl p-3.5 bg-black/90 border border-emerald-500/50 shadow-2xl backdrop-blur-xl transition-transform duration-75 text-xs font-sans"
          style={{
            left: Math.min(tooltipPos.x + 16, (mountRef.current?.clientWidth || 600) - 300),
            top: Math.max(tooltipPos.y - 40, 16),
          }}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
              {hoveredNode.type.toUpperCase()} NODE
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                hoveredNode.status === "verified"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : hoveredNode.status === "refuted"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              }`}
            >
              {hoveredNode.status}
            </span>
          </div>
          <div className="text-slate-200 font-medium leading-relaxed mb-2">
            {hoveredNode.label}
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-3 mb-2 font-mono">
            {hoveredNode.details}
          </p>
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
            {hoveredNode.score !== undefined && (
              <span>Entailment τ: {(hoveredNode.score * 100).toFixed(1)}%</span>
            )}
            {hoveredNode.latencyMs !== undefined && (
              <span className="text-emerald-400 font-semibold">{hoveredNode.latencyMs}ms</span>
            )}
          </div>
        </div>
      )}

      {/* Bottom Hint */}
      <div className="absolute bottom-3 left-4 z-10 text-[10px] font-mono text-slate-400/80">
        Mouse parallax active &bull; Hover nodes to inspect epistemic grounding
      </div>
    </div>
  );
};
