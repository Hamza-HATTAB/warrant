"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { WarrantState, AtomicClaim, EvidenceSpan } from "../lib/types";

interface NodeData {
  id: string;
  label: string;
  type: "document" | "claim" | "guard" | "query";
  status: "verified" | "refuted" | "neutral" | "pending";
  position: THREE.Vector3;
  targetPosition: THREE.Vector3;
  score?: number;
  latencyMs?: number;
  details: string;
}

interface EpistemicLatticeCanvasProps {
  state: WarrantState | null;
  selectedClaimId?: string | null;
  onSelectClaim?: (claimId: string) => void;
  className?: string;
}

export const EpistemicLatticeCanvas: React.FC<EpistemicLatticeCanvasProps> = ({
  state,
  selectedClaimId,
  onSelectClaim,
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

    let width = container.clientWidth || 1200;
    let height = container.clientHeight || 560;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030712, 0.028);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 2.5, 20);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // OrbitControls for natural inspection
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false; // keep page scroll smooth
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;
    controls.maxPolarAngle = Math.PI / 1.7;
    controls.minPolarAngle = Math.PI / 3.2;

    // 2. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const keyLightEmerald = new THREE.PointLight(0x10b981, 3.5, 45);
    keyLightEmerald.position.set(8, 6, 8);
    scene.add(keyLightEmerald);

    const fillLightCyan = new THREE.PointLight(0x06b6d4, 2.8, 45);
    fillLightCyan.position.set(-8, -4, 6);
    scene.add(fillLightCyan);

    const backlightViolet = new THREE.PointLight(0x8b5cf6, 2.2, 50);
    backlightViolet.position.set(0, 8, -6);
    scene.add(backlightViolet);

    // Root Group
    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    // 3. Populate Graph Nodes
    const nodes: NodeData[] = [];
    const meshes: THREE.Mesh[] = [];
    const pulseMeshes: THREE.Mesh[] = [];

    // Query Root Node
    const queryText = state?.query || "Which magazine was started first, Arthur's Magazine or First for Women?";
    nodes.push({
      id: "node_query",
      label: "Inquiry Root",
      type: "query",
      status: "verified",
      position: new THREE.Vector3(0, 4.5, 0),
      targetPosition: new THREE.Vector3(0, 4.5, 0),
      details: queryText,
    });

    // Evidence Spans / Document Nodes
    const spans: EvidenceSpan[] = state?.retrieved_spans && state.retrieved_spans.length > 0
      ? state.retrieved_spans
      : [
          {
            id: "arthur_mag_s0",
            doc_title: "Arthur's Magazine (1844)",
            text: "Arthur's Magazine was founded in 1844 in Philadelphia.",
            char_start: 0,
            char_end: 55,
            retrieval_hop: 1,
            score: 0.942,
          },
          {
            id: "first_women_s1",
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
      const x = (idx % 2 === 0 ? -1 : 1) * (4.2 + idx * 0.9);
      const y = 1.4 - idx * 0.7;
      const z = (idx % 2 === 0 ? 1.4 : -1.4);

      const span = spans.find((s) => s.doc_title === docTitle);
      nodes.push({
        id: `node_doc_${idx}`,
        label: docTitle,
        type: "document",
        status: "verified",
        position: new THREE.Vector3(x, y, z),
        targetPosition: new THREE.Vector3(x, y, z),
        score: span?.score ?? 0.95,
        details: span?.text || "Source context span retrieved on multi-threaded CPU cores.",
      });
    });

    // Deterministic Entity Guard Arbiter Node
    nodes.push({
      id: "node_guard",
      label: "Stage-1 Deterministic Entity Guard",
      type: "guard",
      status: "verified",
      position: new THREE.Vector3(0, -0.4, 1.4),
      targetPosition: new THREE.Vector3(0, -0.4, 1.4),
      latencyMs: 0.42,
      score: 1.0,
      details: "Deterministic numerical regex & entity validation completed in 0.42ms (<1ms).",
    });

    // Synthetic & Verified Claims
    const claims: AtomicClaim[] = state?.synthetic_claims && state.synthetic_claims.length > 0
      ? state.synthetic_claims
      : [
          {
            claim_id: "c_001",
            text: "Arthur's Magazine was founded in 1844.",
            cited_spans: ["arthur_mag_s0"],
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
            cited_spans: ["first_women_s1"],
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
      const x = (idx === 0 ? -2.6 : idx === 1 ? 2.6 : 0) + (idx > 1 ? (idx - 1) * 3 : 0);
      const y = -2.8 - (idx % 2) * 0.8;
      const z = (idx % 2 === 0 ? 0.9 : -0.9);

      const status = claim.verification_status === "VERIFIED"
        ? "verified"
        : claim.verification_status === "REFUTED"
        ? "refuted"
        : "pending";

      nodes.push({
        id: claim.claim_id,
        label: `Claim ${claim.claim_id}: ${claim.text.slice(0, 36)}...`,
        type: "claim",
        status,
        position: new THREE.Vector3(x, y, z),
        targetPosition: new THREE.Vector3(x, y, z),
        score: claim.nli_entailment_prob,
        latencyMs: claim.nli_inference_latency_ms,
        details: `${claim.text} (Guard: ${claim.guard_status}, τ=${claim.nli_entailment_prob.toFixed(3)})`,
      });
    });

    // 4. Create Physically Based Meshes for Nodes
    nodes.forEach((node) => {
      let geometry: THREE.BufferGeometry;
      let colorHex = 0x10b981;

      if (node.type === "query") {
        geometry = new THREE.OctahedronGeometry(0.85, 0);
        colorHex = 0x38bdf8; // Sky
      } else if (node.type === "document") {
        geometry = new THREE.DodecahedronGeometry(0.72, 0);
        colorHex = 0x06b6d4; // Cyan
      } else if (node.type === "guard") {
        geometry = new THREE.BoxGeometry(0.85, 0.85, 0.85);
        colorHex = 0xa855f7; // Purple
      } else {
        geometry = new THREE.IcosahedronGeometry(0.65, 1);
        if (node.status === "verified") {
          colorHex = 0x10b981; // Emerald
        } else if (node.status === "refuted") {
          colorHex = 0xef4444; // Crimson
        } else {
          colorHex = 0xf59e0b; // Amber
        }
      }

      // ThreeUI style MeshPhysicalMaterial
      const material = new THREE.MeshPhysicalMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.45,
        roughness: 0.15,
        metalness: 0.85,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.95,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(node.position);
      mesh.userData = { nodeData: node };
      graphGroup.add(mesh);
      meshes.push(mesh);

      // Outer Wireframe Halo
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.14,
      });
      const wireMesh = new THREE.Mesh(geometry, wireMat);
      wireMesh.scale.set(1.18, 1.18, 1.18);
      mesh.add(wireMesh);

      // Verified radial pulse waves
      if (node.status === "verified" || node.type === "guard") {
        const pulseGeo = new THREE.RingGeometry(0.75, 0.88, 32);
        const pulseMat = new THREE.MeshBasicMaterial({
          color: colorHex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.45,
        });
        const pulse = new THREE.Mesh(pulseGeo, pulseMat);
        pulse.position.copy(node.position);
        pulse.rotation.x = Math.PI / 2;
        pulse.userData = { maxScale: 2.9, speed: 0.016 + Math.random() * 0.008 };
        graphGroup.add(pulse);
        pulseMeshes.push(pulse);
      }
    });

    // 5. Spring-Tensioned Dynamic Edges
    const edges: Array<{ from: NodeData; to: NodeData }> = [];
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
      opacity: 0.42,
    });
    const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    graphGroup.add(edgeLines);

    // 6. Ambient Particle Spark Cloud
    const particleCount = 240;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      particlePositions[idx] = (Math.random() - 0.5) * 40;
      particlePositions[idx + 1] = (Math.random() - 0.5) * 28;
      particlePositions[idx + 2] = (Math.random() - 0.5) * 30;

      const pColor = Math.random() > 0.6 ? new THREE.Color(0x10b981) : new THREE.Color(0x06b6d4);
      particleColors[idx] = pColor.r;
      particleColors[idx + 1] = pColor.g;
      particleColors[idx + 2] = pColor.b;
    }

    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);

    // 7. Mouse Interactivity & Raycasting
    const raycaster = new THREE.Raycaster();
    const mouseVector = new THREE.Vector2();

    const onMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      mouseVector.x = x;
      mouseVector.y = y;

      setTooltipPos({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    const onClick = () => {
      raycaster.setFromCamera(mouseVector, camera);
      const intersects = raycaster.intersectObjects(meshes);
      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const data = hit.userData.nodeData as NodeData | undefined;
        if (data && data.type === "claim" && onSelectClaim) {
          onSelectClaim(data.id);
        }
      }
    };

    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("click", onClick);

    // 8. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      controls.update();

      // Subtle dynamic bobbing on individual node meshes
      meshes.forEach((mesh, index) => {
        mesh.rotation.x += 0.005 * ((index % 3) + 1);
        mesh.rotation.y += 0.007 * ((index % 2) + 1);
        mesh.position.y += Math.sin(time * 1.6 + index) * 0.0018;

        const node = mesh.userData.nodeData as NodeData | undefined;
        const isExternalSelected = node && selectedClaimId && node.id === selectedClaimId;

        if (isExternalSelected) {
          mesh.scale.lerp(new THREE.Vector3(1.35, 1.35, 1.35), 0.15);
        }
      });

      // Animate Radial Pulse Shockwaves
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
      particleSystem.rotation.y = time * 0.018;

      // Raycasting for interactive hover
      raycaster.setFromCamera(mouseVector, camera);
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const topHit = intersects[0].object as THREE.Mesh;
        const nodeData = topHit.userData.nodeData as NodeData | undefined;
        if (nodeData) {
          setHoveredNode(nodeData);
          topHit.scale.lerp(new THREE.Vector3(1.3, 1.3, 1.3), 0.15);
        }
      } else {
        setHoveredNode(null);
        meshes.forEach((m) => {
          const node = m.userData.nodeData as NodeData | undefined;
          if (!selectedClaimId || node?.id !== selectedClaimId) {
            m.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    // 9. Resize Observer
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

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("click", onClick);
      resizeObserver.disconnect();
      controls.dispose();
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
  }, [state, selectedClaimId, onSelectClaim]);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-[460px] md:h-[540px] rounded-3xl overflow-hidden glass-surface shadow-2xl ${className}`}
    >
      {/* Three.js Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

      {/* Floating Status Glass Badge */}
      <div className="absolute top-5 left-6 z-10 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-xl">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        <span className="text-xs font-semibold text-slate-200 tracking-wide">
          Epistemic Lattice Stage
        </span>
        <span className="text-[11px] text-slate-400 font-mono">
          &middot; WebGL Physical Shaders
        </span>
      </div>

      <div className="absolute top-5 right-6 z-10 hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-xl text-xs text-slate-300">
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
          <span className="w-2 h-2 rounded-full bg-emerald-400" /> Verified Claim
        </span>
      </div>

      {/* Interactive Hover HUD Card */}
      {hoveredNode && (
        <div
          className="absolute pointer-events-none z-30 w-80 rounded-2xl p-4 bg-black/85 border border-white/15 shadow-2xl backdrop-blur-2xl transition-transform duration-75 text-xs font-sans"
          style={{
            left: Math.min(tooltipPos.x + 16, (mountRef.current?.clientWidth || 800) - 340),
            top: Math.max(tooltipPos.y - 50, 20),
          }}
        >
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              {hoveredNode.type.toUpperCase()} NODE
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                hoveredNode.status === "verified"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : hoveredNode.status === "refuted"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              }`}
            >
              {hoveredNode.status}
            </span>
          </div>

          <div className="text-slate-100 font-semibold leading-snug mb-2">
            {hoveredNode.label}
          </div>

          <p className="text-slate-300 text-[11px] leading-relaxed line-clamp-3 mb-3">
            {hoveredNode.details}
          </p>

          <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[11px] text-slate-400 font-mono">
            {hoveredNode.score !== undefined && (
              <span>Entailment τ: {(hoveredNode.score * 100).toFixed(1)}%</span>
            )}
            {hoveredNode.latencyMs !== undefined && (
              <span className="text-emerald-400 font-semibold">{hoveredNode.latencyMs}ms</span>
            )}
          </div>
        </div>
      )}

      {/* Orbit Controls Hint Footer */}
      <div className="absolute bottom-4 left-6 z-10 text-xs text-slate-400">
        Drag to rotate epistemic lattice &middot; Click claim node to focus attribution
      </div>
    </div>
  );
};
