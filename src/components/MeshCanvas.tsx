import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { useStore } from '../store';
import { score } from '../sampling';
import { renderToken } from '../tokens';
import { useAccentRGB, shade, rgba, type AccentRGB } from '../theme/accent';
import type { CandidateToken, TreeNode } from '../types';

const VISIBLE_PER_NODE = 24;
const CHAIN_SPACING = 18;
const MAX_VISIBLE_CHAIN = 6;
const MAX_LOOKAHEAD_DEPTH = 3;
// How many candidates to show per lookahead level (decreases with depth).
const LOOKAHEAD_VISIBLE = [10, 6, 4];

interface GraphNode {
  id: string;
  kind: 'chain' | 'candidate' | 'lookahead';
  text: string;
  alive: boolean;
  isTop: boolean;
  isActive: boolean;
  isChosen: boolean;
  isTip: boolean;
  // 0 = active fan, 1+ = lookahead depth
  lookaheadDepth: number;
  decay: number;
  prob: number;
  rank: number;
  treeNodeId?: string;
  candidateIndex?: number;
  candidate?: CandidateToken;
  fx?: number;
  fy?: number;
  fz?: number;
  x?: number;
  y?: number;
  z?: number;
}

interface GraphLink {
  source: string;
  target: string;
  alive: boolean;
  isChain: boolean;
  isTopFan: boolean;
  isActiveFan: boolean;
  isLookahead: boolean;
  lookaheadDepth: number;
  intensity: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

function decayFor(distance: number): number {
  return Math.pow(0.78, distance);
}

function buildGraphData(
  tipNodeId: string,
  storeNodes: Record<string, TreeNode>,
  sampling: ReturnType<typeof useStore.getState>['sampling'],
  positionHints: Map<string, { x: number; y: number; z: number }>
): GraphData | null {
  const tipNode = storeNodes[tipNodeId];
  if (!tipNode || !tipNode.inputTokens || !tipNode.candidates) return null;

  const treeChain: TreeNode[] = [];
  let cur: TreeNode | null = tipNode;
  while (cur) {
    treeChain.unshift(cur);
    cur = cur.parentId ? storeNodes[cur.parentId] ?? null : null;
  }

  const inputTokens = tipNode.inputTokens;
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const chainNodeIds: string[] = [];

  // Keep only the most-recent MAX_VISIBLE_CHAIN tokens visible. The simulation
  // anchors them in a fixed band near the tip; older context lives in the
  // prompt textarea but stays out of the 3D scene so the camera frame doesn't
  // have to keep expanding as the user types.
  const visibleStart = Math.max(0, inputTokens.length - MAX_VISIBLE_CHAIN);
  for (let i = visibleStart; i < inputTokens.length; i++) {
    const tok = inputTokens[i];
    const distance = inputTokens.length - 1 - i;
    const decay = decayFor(distance);
    const id = `chain-${i}-${tok.id}`;
    chainNodeIds.push(id);
    const isTip = i === inputTokens.length - 1;
    nodes.push({
      id,
      kind: 'chain',
      text: tok.text,
      alive: true,
      isTop: false,
      isActive: false,
      isChosen: false,
      isTip,
      lookaheadDepth: 0,
      decay,
      prob: 1,
      rank: i,
      // X position relative to the visible window so the tip is always near 0.
      fx: (i - inputTokens.length + 1) * CHAIN_SPACING,
      fy: 0,
      fz: 0
    });
    // No chain-to-chain edge: the horizontal layout + textarea already convey
    // the sequence, and a bright line through the words obscures them.
  }

  treeChain.forEach((tn, treeIdx) => {
    if (!tn.candidates || !tn.inputTokens) return;
    const fanPositionIndex = tn.inputTokens.length;
    const isActive = treeIdx === treeChain.length - 1;
    const fanDistance = inputTokens.length - tn.inputTokens.length;
    const fadeFactor = isActive ? 1.0 : Math.max(0.2, decayFor(fanDistance));

    const visible = Math.min(tn.candidates.length, VISIBLE_PER_NODE);
    const scored = score(
      tn.candidates.map((c) => c.logit),
      sampling
    );
    const ordered = scored
      .map((s, i) => ({ ...s, candidate: tn.candidates![i], originalIndex: i }))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, visible);

    const chosenText =
      !isActive && fanPositionIndex < inputTokens.length
        ? inputTokens[fanPositionIndex].text
        : null;

    // Map the absolute chain position into the visible chain window.
    const visibleChainIndex = fanPositionIndex - 1 - visibleStart;
    if (visibleChainIndex < 0) return; // Anchor is offscreen — skip its fan.
    const anchorChainNodeId = chainNodeIds[Math.max(visibleChainIndex, 0)];

    ordered.forEach((o) => {
      const isTop = o.rank === 0;
      const isChosen = chosenText !== null && o.candidate.text === chosenText;
      // The chosen candidate is already represented as a chain bubble — hide
      // its duplicate in the historical fan so the user can't re-click it.
      if (!isActive && isChosen) return;
      // Identity by *text* (not numeric token id) so candidates that recur
      // across consecutive inferences keep their physics position. As the
      // user types, "going" stays put even though the underlying token id
      // / rank / probability shift slightly between each keystroke.
      const id = `fan-${tn.id}-${o.candidate.text}`;
      // For new nodes, seed position near the anchor so they ease in instead
      // of shooting from origin. Existing nodes are preserved by the library.
      const hint = positionHints.get(id) ?? positionHints.get(anchorChainNodeId);
      const seedX = hint ? hint.x + (Math.random() - 0.5) * 4 : (fanPositionIndex - 1) * CHAIN_SPACING;
      const seedY = hint ? hint.y + (Math.random() - 0.5) * 4 : 0;
      const seedZ = hint ? hint.z + (Math.random() - 0.5) * 4 : 0;
      nodes.push({
        id,
        kind: 'candidate',
        text: o.candidate.text,
        alive: o.alive,
        isTop,
        isActive,
        isChosen,
        isTip: false,
        lookaheadDepth: 0,
        decay: fadeFactor,
        prob: o.prob,
        rank: o.rank,
        treeNodeId: tn.id,
        candidateIndex: o.originalIndex,
        candidate: o.candidate,
        x: seedX,
        y: seedY,
        z: seedZ
      });
      const intensity = isActive
        ? isTop
          ? 1.6
          : o.alive
            ? 0.5 + 0.6 * o.prob
            : 0.15
        : isChosen
          ? 0.85
          : 0.18 * fadeFactor;
      links.push({
        source: anchorChainNodeId,
        target: id,
        alive: o.alive,
        isChain: false,
        isTopFan: isTop && isActive,
        isActiveFan: isActive,
        isLookahead: false,
        lookaheadDepth: 0,
        intensity
      });
    });
  });

  // Lookahead: walk forward from the active tip, following each level's top-1
  // child if it exists in storeNodes. Render its candidates as a softer fan
  // anchored to the previous level's top-1 node. Each level dims further.
  let parentTreeNode: TreeNode = tipNode;
  let parentTopGraphId: string | null = null;
  // Find the active fan's top-1 node id (for anchoring lookahead level 1).
  const activeTopOne = nodes.find((n) => n.isTop && n.isActive);
  if (activeTopOne) parentTopGraphId = activeTopOne.id;

  for (let depth = 1; depth <= MAX_LOOKAHEAD_DEPTH; depth++) {
    if (!parentTreeNode.candidates || !parentTopGraphId) break;
    // Top-1 of parent = candidate with rank 0 under current sampling.
    const parentScored = score(
      parentTreeNode.candidates.map((c) => c.logit),
      sampling
    );
    const parentTopIdx = parentScored.findIndex((s) => s.rank === 0);
    if (parentTopIdx < 0) break;
    const parentTopCandidate = parentTreeNode.candidates[parentTopIdx];
    const lookaheadId = `${parentTreeNode.id}/${parentTopCandidate.id}`;
    const lookaheadNode = storeNodes[lookaheadId];
    if (!lookaheadNode || !lookaheadNode.candidates) break;

    const visible = Math.min(
      lookaheadNode.candidates.length,
      LOOKAHEAD_VISIBLE[depth - 1] ?? 4
    );
    const fadeFactor = Math.pow(0.7, depth);
    const lookScored = score(
      lookaheadNode.candidates.map((c) => c.logit),
      sampling
    );
    const lookOrdered = lookScored
      .map((s, i) => ({
        ...s,
        candidate: lookaheadNode.candidates![i],
        originalIndex: i
      }))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, visible);

    let nextTopGraphId: string | null = null;
    lookOrdered.forEach((o) => {
      const isLocalTop = o.rank === 0;
      const id = `lookahead-${lookaheadNode.id}-${o.candidate.text}`;
      const hint =
        positionsRef_get(positionHints, id) ?? positionHints.get(parentTopGraphId!);
      const seedX = hint ? hint.x + (Math.random() - 0.5) * 3 : 0;
      const seedY = hint ? hint.y + (Math.random() - 0.5) * 3 : 0;
      const seedZ = hint ? hint.z + (Math.random() - 0.5) * 3 : 0;
      nodes.push({
        id,
        kind: 'lookahead',
        text: o.candidate.text,
        alive: o.alive,
        isTop: isLocalTop,
        isActive: false,
        isChosen: false,
        isTip: false,
        lookaheadDepth: depth,
        decay: fadeFactor,
        prob: o.prob,
        rank: o.rank,
        treeNodeId: lookaheadNode.id,
        candidateIndex: o.originalIndex,
        candidate: o.candidate,
        x: seedX,
        y: seedY,
        z: seedZ
      });
      const intensity = (isLocalTop ? 0.9 : 0.4 + 0.4 * o.prob) * fadeFactor;
      links.push({
        source: parentTopGraphId!,
        target: id,
        alive: o.alive,
        isChain: false,
        isTopFan: false,
        isActiveFan: false,
        isLookahead: true,
        lookaheadDepth: depth,
        intensity
      });
      if (isLocalTop) nextTopGraphId = id;
    });

    if (!nextTopGraphId) break;
    parentTopGraphId = nextTopGraphId;
    parentTreeNode = lookaheadNode;
  }

  return { nodes, links };
}

// Wrap Map.get with a small helper so the per-call type stays clean.
function positionsRef_get(
  positionHints: Map<string, { x: number; y: number; z: number }>,
  key: string
): { x: number; y: number; z: number } | undefined {
  return positionHints.get(key);
}

// Map a probability in [0..1] onto a viridis-ish ramp for heatmap mode.
// Cold/blue at low prob → warm/yellow at high prob, easy to read against the
// dark backdrop.
function heatmapColor(prob: number): string {
  const t = Math.min(1, Math.max(0, prob));
  // Stops: 0 → cool blue, 0.5 → magenta-pink, 1 → warm yellow
  const stops = [
    [60, 88, 220],
    [180, 64, 200],
    [240, 130, 110],
    [255, 220, 90]
  ];
  const idx = t * (stops.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(stops.length - 1, lo + 1);
  const frac = idx - lo;
  const r = Math.round(stops[lo][0] + (stops[hi][0] - stops[lo][0]) * frac);
  const g = Math.round(stops[lo][1] + (stops[hi][1] - stops[lo][1]) * frac);
  const b = Math.round(stops[lo][2] + (stops[hi][2] - stops[lo][2]) * frac);
  return `rgb(${r}, ${g}, ${b})`;
}

function tokenColor(node: GraphNode, heatmap: boolean, accent: AccentRGB): string {
  // Heatmap override: any candidate/lookahead is colored purely by probability
  // so the viewer's eye reads the distribution shape at a glance. Chain tokens
  // (already-committed) keep their accent tint so the spine stays anchored.
  if (heatmap && node.kind !== 'chain') {
    if (node.kind === 'lookahead') {
      return heatmapColor(Math.min(1, node.prob * (0.6 + 0.4 * node.decay)));
    }
    if (node.isTop && node.isActive) return heatmapColor(1);
    if (!node.alive) return '#2a3c4d';
    return heatmapColor(node.prob);
  }
  // Chain tokens — already-committed text. Brightest at the tip, dimmer with age.
  if (node.kind === 'chain') {
    return shade(accent, 0.75 + 0.25 * node.decay);
  }
  if (node.kind === 'lookahead') {
    if (node.isTop) {
      // Lookahead top-1 is the predicted future — bright accent + slight white
      // mix so it pops vs the active fan's top-1 (which is even brighter).
      return shade(accent, 0.95, 0.05);
    }
    return shade(accent, Math.max(0.45, node.decay * (0.55 + 0.4 * node.prob)));
  }
  // Active fan top-1 — the model's current best guess. Near-white.
  if (node.isTop && node.isActive) return shade(accent, 1, 0.55);
  if (node.isActive) {
    if (!node.alive) return shade(accent, 0.28); // pruned by top-k/top-p
    return shade(accent, 0.55 + 0.4 * node.prob);
  }
  // Historical chosen (the path the user took). Same hue, mid-brightness.
  if (node.isChosen) return shade(accent, 0.7);
  return shade(accent, 0.32);
}

function tokenSize(node: GraphNode): number {
  if (node.kind === 'chain') return 3.5 + 4.5 * node.decay;
  if (node.kind === 'lookahead') {
    // Floor sizes so deep-lookahead candidates remain readable.
    if (node.isTop) return Math.max(5.5, (6 + 4 * node.prob) * node.decay + 2);
    return Math.max(3.5, (3.5 + 2.5 * node.prob) * node.decay + 1.5);
  }
  if (node.isTop && node.isActive) return 11;
  if (node.isActive) return 4 + 7 * Math.sqrt(node.prob);
  if (node.isChosen) return 5;
  return 3 + 2.5 * node.decay;
}

function linkColor(link: GraphLink, accent: AccentRGB): string {
  // Accent-toned links so the scene retints with the user's chosen color.
  const [r, g, b] = accent;
  const i = Math.min(1, link.intensity);
  if (link.isTopFan) {
    // Active top-1 fan link — strongest, slightly white-mixed so it leads the eye.
    const a = 0.7 + 0.3 * i;
    return `rgba(${Math.min(255, r + 60)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 20)}, ${a})`;
  }
  if (link.isActiveFan) {
    return `rgba(${r}, ${g}, ${b}, ${0.35 + 0.5 * i})`;
  }
  if (link.isLookahead) {
    return `rgba(${r}, ${g}, ${b}, ${0.1 + 0.4 * i})`;
  }
  if (link.isChain) {
    return `rgba(${r}, ${g}, ${b}, ${0.3 + 0.5 * i})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${0.08 + 0.18 * i})`;
}

function makeSprite(node: GraphNode, heatmap: boolean, accent: AccentRGB): THREE.Object3D {
  const sprite = new SpriteText(renderToken(node.text));
  const color = tokenColor(node, heatmap, accent);
  sprite.color = color;
  // JetBrains Mono lines up cleanly with the rest of the MESH HUD type system.
  sprite.fontFace = 'JetBrains Mono, ui-monospace, SFMono-Regular, monospace';
  sprite.fontWeight = node.isTop && node.isActive ? '700' : node.kind === 'chain' && node.isTip ? '600' : '500';
  sprite.textHeight = tokenSize(node);
  sprite.material.depthWrite = false;
  sprite.material.transparent = true;
  sprite.padding = 1;

  // Always wrap in a group so we have a scale handle that does NOT conflict
  // with three-spritetext's internal scale management (it sets the sprite's
  // scale based on its rendered text bitmap).
  const wrapper = new THREE.Group();

  // Layered halo + ring for the active top-1 — the scene's hero element.
  if (node.isTop && node.isActive) {
    const [r, g, b] = accent;
    const lit: AccentRGB = [Math.min(255, r + 50), Math.min(255, g + 40), Math.min(255, b + 30)];
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = 256;
    haloCanvas.height = 256;
    const ctx = haloCanvas.getContext('2d')!;
    // Soft radial bloom
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, rgba(accent, 0.6));
    grad.addColorStop(0.45, rgba(accent, 0.18));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    // Outer ring — tight stroke at ~r=110 for a definite shape
    ctx.strokeStyle = rgba(lit, 0.85);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(128, 128, 108, 0, Math.PI * 2);
    ctx.stroke();
    const haloTex = new THREE.CanvasTexture(haloCanvas);
    const haloMat = new THREE.SpriteMaterial({
      map: haloTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(46, 46, 1);
    wrapper.add(halo);
  }

  // Subtle dot under historical-chosen tokens so the user can read the path.
  if (node.isChosen && !node.isActive) {
    const dotCanvas = document.createElement('canvas');
    dotCanvas.width = 64;
    dotCanvas.height = 64;
    const ctx = dotCanvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, rgba(accent, 0.55));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const dotMat = new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(dotCanvas),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const dot = new THREE.Sprite(dotMat);
    dot.scale.set(14, 14, 1);
    wrapper.add(dot);
  }

  wrapper.add(sprite);

  // Tag the wrapper for fade-in. The animation loop (in MeshCanvas) eases
  // wrapper.scale 0→1 over 500ms, composing on top of the sprite's own scale.
  wrapper.scale.setScalar(0.001);
  wrapper.userData.__fadeStart = performance.now();

  return wrapper;
}

function FallbackOverlay({ message, isError }: { message: string; isError?: boolean }) {
  return (
    <div className={`flex h-full items-center justify-center font-mono text-[11px] uppercase tracking-[0.2em] ${isError ? 'text-mesh-bad' : 'text-mesh-mute'}`}>
      {message}
    </div>
  );
}

export function MeshCanvas() {
  const tipNodeId = useStore((s) => s.tipNodeId);
  const tipNode = useStore((s) => s.nodes[s.tipNodeId]);
  const storeNodes = useStore((s) => s.nodes);
  const sampling = useStore((s) => s.sampling);
  const expand = useStore((s) => s.expand);
  const setHover = useStore((s) => s.setHover);
  const heatmap = useStore((s) => s.heatmap);
  const accentRGB = useAccentRGB();
  const isThinking =
    !!tipNode && (tipNode.status === 'loading' || !tipNode.candidates);
  const hasAnyData = !!tipNode?.candidates && !!tipNode?.inputTokens;

  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<unknown>(null);
  const positionsRef = useRef<Map<string, { x: number; y: number; z: number }>>(new Map());
  const graphDataRef = useRef<GraphData>({ nodes: [], links: [] });
  // Track the container's measured size so the canvas fills it on mount and
  // tracks viewport changes (the lib's auto-sizing reads from layout once).
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setSize({ width: w, height: h });
    };
    // requestAnimationFrame ensures CSS layout has settled before we read.
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // Cache the last meaningful graph so clicks (which create a new tip with
  // null candidates while inference is in flight) don't blank the canvas.
  // The cache only updates when buildGraphData returns a populated graph.
  const lastGoodGraphRef = useRef<GraphData>({ nodes: [], links: [] });
  const graphData: GraphData = useMemo(() => {
    const built = buildGraphData(tipNodeId, storeNodes, sampling, positionsRef.current);
    if (built && built.nodes.length > 0) {
      lastGoodGraphRef.current = built;
      return built;
    }
    return lastGoodGraphRef.current;
  }, [tipNodeId, storeNodes, sampling]);

  useEffect(() => {
    graphDataRef.current = graphData;
    const fg = fgRef.current as { refresh?: () => void } | null;
    if (fg && typeof fg.refresh === 'function') {
      try { fg.refresh(); } catch { /* */ }
    }
  }, [graphData]);

  // Fade-in animation loop — eases wrapper groups' scale from 0 to 1 over
  // 500 ms with cubic ease-out. Each new node is tagged in makeSprite.
  useEffect(() => {
    let raf = 0;
    const FADE_MS = 500;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const fg = fgRef.current as { scene?: () => THREE.Scene } | null;
      if (!fg?.scene) return;
      let scene: THREE.Scene;
      try { scene = fg.scene(); } catch { return; }
      const now = performance.now();
      scene.traverse((obj) => {
        const ud = obj.userData as { __fadeStart?: number };
        if (ud.__fadeStart === undefined) return;
        const age = now - ud.__fadeStart;
        if (age < 0) return;
        const t = Math.min(age / FADE_MS, 1);
        // easeOutBack — slight overshoot at t=0.85 then settles to 1.0. Gives sprites
        // a pleasing "drop in" feel instead of just sliding to size.
        const c = 1.65;
        const t1 = t - 1;
        const eased = 1 + (c + 1) * t1 * t1 * t1 + c * t1 * t1;
        obj.scale.setScalar(eased);
        if (t >= 1) delete ud.__fadeStart;
      });
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const fg = fgRef.current as
      | {
          d3Force: (name: string) => unknown;
          scene: () => THREE.Scene;
          zoomToFit: (ms?: number, padding?: number) => void;
          postProcessingComposer?: () => { addPass: (p: unknown) => void };
        }
      | null;
    if (!fg) return;
    // Snapshot perf mode at mount — bloom is the heaviest pass, so skipping
    // it on low-end devices is the single biggest win. Star count also drops.
    const perf = useStore.getState().perfMode;
    // Add a starfield to the underlying THREE scene once.
    const scene = fg.scene();
    const STAR_TAG = 'llm-viz-stars';
    const existing = scene.children.find((c) => c.name === STAR_TAG);
    if (!existing) {
      const starGeom = new THREE.BufferGeometry();
      const starCount = perf === 'low' ? 1800 : 6000;
      const positions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const r = 400 + Math.random() * 1600;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      starGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const [sr, sg, sb] = accentRGB;
      const starMat = new THREE.PointsMaterial({
        color: new THREE.Color(sr / 255, sg / 255, sb / 255),
        size: 1.4,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.55
      });
      const stars = new THREE.Points(starGeom, starMat);
      stars.name = STAR_TAG;
      scene.add(stars);
    }

    // Holographic grid floor — tints the lower hemisphere with the classic
    // sci-fi blueprint look. Lives below the action so it doesn't compete
    // with the chain.
    const GRID_TAG = 'llm-viz-grid';
    if (!scene.children.find((c) => c.name === GRID_TAG)) {
      const [ar, ag, ab] = accentRGB;
      const grid = new THREE.GridHelper(
        900,
        90,
        new THREE.Color(ar / 255, ag / 255, ab / 255),
        new THREE.Color((ar * 0.35) / 255, (ag * 0.35) / 255, (ab * 0.35) / 255)
      ) as THREE.Object3D;
      const gridLines = grid as unknown as { material?: { transparent: boolean; opacity: number } };
      if (gridLines.material) {
        gridLines.material.transparent = true;
        gridLines.material.opacity = 0.16;
      }
      grid.position.y = -90;
      grid.name = GRID_TAG;
      scene.add(grid);
    }

    // Stronger bloom — the holo look needs noticeable blooming on the bright text.
    // Skip entirely in low-perf mode: bloom is the heaviest pass in the scene.
    if (perf !== 'low' && fg.postProcessingComposer) {
      try {
        const composer = fg.postProcessingComposer();
        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          1.5, // strength
          0.95, // radius
          0.08 // threshold (low = lots of stuff blooms — that holo feel)
        );
        composer.addPass(bloomPass);
      } catch {
        /* postprocessing unavailable */
      }
    }
  }, []);

  // Retint stars + grid when the accent changes. Runs separately from the
  // one-shot scene-init above so users see the recolor live (instead of
  // having to switch lenses to remount the canvas).
  useEffect(() => {
    const fg = fgRef.current as { scene?: () => THREE.Scene } | null;
    if (!fg?.scene) return;
    let scene: THREE.Scene;
    try { scene = fg.scene(); } catch { return; }
    const [ar, ag, ab] = accentRGB;
    // Stars: update material color in place.
    const stars = scene.children.find((c) => c.name === 'llm-viz-stars') as THREE.Points | undefined;
    if (stars) {
      const mat = stars.material as THREE.PointsMaterial;
      mat.color.setRGB(ar / 255, ag / 255, ab / 255);
      mat.needsUpdate = true;
    }
    // Grid: line colors are baked into the geometry's color attribute, so
    // dispose + rebuild is the cleanest way to retint reliably.
    const oldGrid = scene.children.find((c) => c.name === 'llm-viz-grid');
    if (oldGrid) {
      scene.remove(oldGrid);
      // Best-effort cleanup — types are loose enough that we just guard.
      const og = oldGrid as unknown as { geometry?: { dispose?: () => void }; material?: { dispose?: () => void } };
      og.geometry?.dispose?.();
      og.material?.dispose?.();
      const grid = new THREE.GridHelper(
        900,
        90,
        new THREE.Color(ar / 255, ag / 255, ab / 255),
        new THREE.Color((ar * 0.35) / 255, (ag * 0.35) / 255, (ab * 0.35) / 255)
      ) as THREE.Object3D;
      const lineMat = grid as unknown as { material?: { transparent: boolean; opacity: number } };
      if (lineMat.material) {
        lineMat.material.transparent = true;
        lineMat.material.opacity = 0.16;
      }
      grid.position.y = -90;
      grid.name = 'llm-viz-grid';
      scene.add(grid);
    }
  }, [accentRGB]);

  useEffect(() => {
    const fg = fgRef.current as
      | { d3Force: (name: string) => unknown; zoomToFit: (ms?: number, padding?: number) => void }
      | null;
    if (!fg) return;
    const linkForce = fg.d3Force('link') as
      | {
          distance: (fn: (l: GraphLink) => number) => unknown;
          strength: (fn: (l: GraphLink) => number) => unknown;
        }
      | undefined;
    const chargeForce = fg.d3Force('charge') as
      | { strength: (s: number) => unknown; distanceMax: (d: number) => unknown }
      | undefined;
    if (linkForce) {
      // Higher-probability candidates anchor close; low-prob drift further.
      // Top-1 hugs its tip. Chain links are uniform & sturdy.
      linkForce.distance((l) => {
        if (l.isChain) return CHAIN_SPACING;
        if (l.isTopFan) return 14;
        const probish = Math.min(1, l.intensity);
        return 14 + (1 - probish) * 40;
      });
      linkForce.strength((l) => {
        if (l.isChain) return 1.0;
        if (l.isTopFan) return 0.85;
        return 0.18 + 0.55 * Math.min(1, l.intensity);
      });
    }
    if (chargeForce) {
      chargeForce.strength(-45);
      chargeForce.distanceMax(120);
    }

  }, [graphData]);

  // Compute the centroid of every currently-rendered node and use it as the
  // OrbitControls target so rotation pivots around the actual visible mesh,
  // not just the chain midpoint.
  const computeCentroid = (): [number, number, number] => {
    const positions = positionsRef.current;
    let sumX = 0, sumY = 0, sumZ = 0, count = 0;
    // Restrict to currently-rendered ids so stale positions don't drag the
    // centroid sideways.
    const liveIds = new Set(graphData.nodes.map((n) => n.id));
    for (const [id, p] of positions) {
      if (!liveIds.has(id)) continue;
      sumX += p.x; sumY += p.y; sumZ += p.z; count++;
    }
    if (count === 0) return [0, 0, 0];
    return [sumX / count, sumY / count, sumZ / count];
  };

  const chainLen = tipNode?.inputTokens?.length ?? 0;
  const tipSignature = `${tipNodeId}:${chainLen}`;
  useEffect(() => {
    const fg = fgRef.current as
      | {
          controls: () => {
            target?: { set: (x: number, y: number, z: number) => void };
            update?: () => void;
          };
        }
      | null;
    if (!fg) return;
    // Wait a bit so the simulation has positioned the new nodes before we
    // measure the centroid.
    const t = window.setTimeout(() => {
      try {
        const [cx, cy, cz] = computeCentroid();
        const ctl = fg.controls();
        if (ctl?.target) {
          ctl.target.set(cx, cy, cz);
          if (typeof ctl.update === 'function') ctl.update();
        }
      } catch { /* */ }
    }, 800);
    return () => window.clearTimeout(t);
  }, [tipSignature]);

  // Auto-fit ONCE when the graph first becomes populated. After that, the
  // camera stays put across keystrokes / clicks / slider drags so the view
  // doesn't keep snapping back. The user can re-orient with orbit/pan/zoom.
  const hasFitOnceRef = useRef(false);
  useEffect(() => {
    if (graphData.nodes.length === 0) {
      hasFitOnceRef.current = false; // re-arm for next prompt session
      return;
    }
    if (hasFitOnceRef.current) return;
    const fg = fgRef.current as
      | { zoomToFit: (ms?: number, padding?: number, filter?: unknown) => void }
      | null;
    if (!fg) return;
    type ZoomFitFn = (
      ms?: number,
      padding?: number,
      filter?: (n: { isTip?: boolean; isActive?: boolean; kind?: string }) => boolean
    ) => void;
    const fitter = fg.zoomToFit as unknown as ZoomFitFn;
    const activeOnly = (n: { isTip?: boolean; isActive?: boolean; kind?: string }) =>
      !!n.isTip || (n.kind === 'candidate' && !!n.isActive);
    const t = window.setTimeout(() => {
      try {
        fitter(800, 100, activeOnly);
        hasFitOnceRef.current = true;
      } catch { /* unmounted */ }
    }, 1500);
    return () => window.clearTimeout(t);
  }, [graphData]);

  if (!tipNode) return <FallbackOverlay message="Loading..." />;
  if (tipNode.status === 'error') {
    return <FallbackOverlay message={`Inference error: ${tipNode.error}`} isError />;
  }
  // Empty-prompt case is the only "fallback to text" we keep — nothing to render.
  // For the in-flight first inference, we mount the empty canvas (stars + thinking
  // pulse) and let nodes fade in when data arrives. No more screen flashing.
  if (!hasAnyData && tipNode.prompt === '') {
    return <FallbackOverlay message="Type a prompt below to see the mesh." />;
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      style={{
        // Layered gradient: subtle accent halo at the focal point, fading to
        // deep ink at the edges. Uses CSS vars so it retints with the accent.
        background: `
          radial-gradient(ellipse 65% 50% at 50% 55%, rgba(var(--mesh-accent) / 0.10) 0%, transparent 70%),
          radial-gradient(ellipse at 50% 55%, rgb(8, 26, 42) 0%, rgb(5, 17, 30) 38%, rgb(3, 8, 20) 72%, rgb(1, 4, 10) 100%)
        `
      }}
    >
      {/* Faint horizon grid plane — adds spatial anchoring without dominating */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(var(--mesh-accent) / 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--mesh-accent) / 0.06) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage:
            'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.6) 70%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.6) 70%, transparent 100%)'
        }}
      />
      <ForceGraph3D
        ref={fgRef as never}
        width={size?.width}
        height={size?.height}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        showNavInfo={false}
        controlType="orbit"
        nodeThreeObject={(node) => makeSprite(node as unknown as GraphNode, heatmap, accentRGB)}
        nodeThreeObjectExtend={false}
        linkColor={(l) => linkColor(l as unknown as GraphLink, accentRGB)}
        linkOpacity={1}
        linkWidth={(l) => {
          const link = l as unknown as GraphLink;
          if (link.isTopFan) return 2.5;
          if (link.isActiveFan && link.alive) return 0.9 + 1.2 * link.intensity;
          return 0.3 + 0.4 * link.intensity;
        }}
        linkDirectionalParticles={0}
        d3AlphaDecay={0.04}
        d3AlphaMin={0.005}
        d3VelocityDecay={0.45}
        cooldownTime={Infinity}
        warmupTicks={0}
        enableNodeDrag={false}
        onEngineTick={() => {
          // The library mutates x/y/z on the node objects we passed in.
          const nodes = graphDataRef.current.nodes;
          for (const n of nodes) {
            if (n.x !== undefined && n.y !== undefined && n.z !== undefined) {
              positionsRef.current.set(n.id, { x: n.x, y: n.y, z: n.z });
            }
          }
        }}
        onNodeHover={(node) => {
          const n = node as unknown as GraphNode | null;
          if (
            !n ||
            (n.kind !== 'candidate' && n.kind !== 'lookahead') ||
            !n.treeNodeId ||
            n.candidateIndex === undefined
          ) {
            setHover(null, null);
            document.body.style.cursor = '';
            return;
          }
          setHover(n.treeNodeId, n.candidateIndex);
          document.body.style.cursor = 'pointer';
        }}
        onNodeClick={(node) => {
          const n = node as unknown as GraphNode;
          if (
            (n.kind !== 'candidate' && n.kind !== 'lookahead') ||
            !n.treeNodeId ||
            !n.candidate
          ) return;
          // Click any candidate — active, historical, OR lookahead — to advance
          // the chain to that point. Clicking a deep lookahead candidate
          // collapses the predicted path into the chain in one move.
          expand(n.treeNodeId, n.candidate);
        }}
      />

      {/* Holo scan-line overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(var(--mesh-accent) / 0.04) 0px, rgba(var(--mesh-accent) / 0.04) 1px, transparent 2px, transparent 4px)',
          mixBlendMode: 'screen'
        }}
      />
      {/* Vignette for that holo-display feel */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 55%, transparent 40%, rgba(0,0,0,0.45) 100%)'
        }}
      />

      {isThinking && (
        <div className="pointer-events-none absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full border border-mesh-edge/60 bg-mesh-panel/80 px-3 py-1 backdrop-blur">
          <span className="inline-block h-1.5 w-1.5 animate-mesh-pulse rounded-full bg-mesh-accent shadow-[0_0_8px_rgb(var(--mesh-accent))]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mesh-dim">thinking</span>
        </div>
      )}

      {/* Confidence ring — top-1 probability of the current tip's distribution. */}
      <ConfidenceRing />

      {/* Heatmap legend — only when heatmap mode is on. */}
      {heatmap && <HeatmapLegend />}

      {/* Top-left controls: recenter + fullscreen */}
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <button
          onClick={() => {
            const fg = fgRef.current as
              | {
                  controls: () => {
                    target?: { set: (x: number, y: number, z: number) => void };
                    update?: () => void;
                  };
                  zoomToFit: (ms?: number, padding?: number, filter?: unknown) => void;
                }
              | null;
            if (!fg) return;
            try {
              const [cx, cy, cz] = computeCentroid();
              const ctl = fg.controls();
              if (ctl?.target) {
                ctl.target.set(cx, cy, cz);
                if (typeof ctl.update === 'function') ctl.update();
              }
            } catch { /* */ }
            try {
              const fitter = fg.zoomToFit as unknown as (
                ms?: number,
                padding?: number,
                filter?: (n: { isTip?: boolean; isActive?: boolean; kind?: string }) => boolean
              ) => void;
              fitter(700, 100, (n) => !!n.isTip || (n.kind === 'candidate' && !!n.isActive));
            } catch { /* */ }
          }}
          className="mesh-btn mesh-btn-ghost backdrop-blur"
        >
          recenter
        </button>
        <button
          onClick={() => {
            const el = containerRef.current;
            if (!el) return;
            if (document.fullscreenElement) {
              document.exitFullscreen?.();
            } else {
              el.requestFullscreen?.();
            }
          }}
          className="mesh-btn mesh-btn-ghost backdrop-blur"
        >
          fullscreen
        </button>
      </div>

      {/* Pan / orbit hint, fades after a few seconds */}
      <div
        className="pointer-events-none absolute bottom-4 left-4 font-mono text-[10px] uppercase tracking-[0.2em] text-mesh-mute"
        style={{ animation: 'fadeOut 8s ease-in 4s forwards' }}
      >
        drag = orbit · right-click = pan · scroll = zoom
      </div>
      <style>{`
        @keyframes fadeOut { to { opacity: 0; } }
      `}</style>
    </div>
  );
}

// HUD: a circular gauge showing the model's confidence in its top-1 candidate.
// Reads the live distribution from the store, applies the user's temperature,
// and animates the arc length.
function ConfidenceRing() {
  const tipNode = useStore((s) => s.nodes[s.tipNodeId]);
  const temperature = useStore((s) => s.sampling.temperature);
  if (!tipNode?.candidates || tipNode.candidates.length === 0) return null;
  const probs = (() => {
    const T = Math.max(temperature, 1e-6);
    const ls = tipNode.candidates!.map((c) => c.logit / T);
    const max = Math.max(...ls);
    const exps = ls.map((l) => Math.exp(l - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / sum);
  })();
  const top1 = probs[0];
  const top2 = probs[1] ?? 0;
  const ratio = top1 / Math.max(top1 + top2, 1e-6);
  // Visualize as an arc 0..1 of the top-1 mass vs top-2 (decisiveness).
  const r = 22;
  const c = 2 * Math.PI * r;
  const dash = c * Math.max(0.04, ratio);
  return (
    <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-2 rounded-md border border-mesh-edge/60 bg-mesh-panel/70 px-2.5 py-1.5 backdrop-blur">
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} stroke="rgba(var(--mesh-edge) / 0.6)" strokeWidth="3" fill="none" />
        <circle
          cx="26"
          cy="26"
          r={r}
          stroke="rgb(var(--mesh-accent))"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90 26 26)"
          style={{ transition: 'stroke-dasharray 380ms ease', filter: 'drop-shadow(0 0 4px rgb(var(--mesh-accent)))' }}
        />
        <text x="26" y="28" textAnchor="middle" className="font-mono" fill="rgb(var(--mesh-fg))" fontSize="11">
          {Math.round(top1 * 100)}%
        </text>
      </svg>
      <div className="flex flex-col leading-tight">
        <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-mesh-mute">top-1 conf</span>
        <span className="font-mono text-[10px] text-mesh-dim">vs #2: {Math.round(top2 * 100)}%</span>
      </div>
    </div>
  );
}

// Compact gradient bar with min/max labels — readable at a glance.
function HeatmapLegend() {
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-2 rounded-md border border-mesh-edge/60 bg-mesh-panel/70 px-3 py-1.5 backdrop-blur">
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-mesh-mute">low</span>
      <span
        className="block h-2 w-32 rounded"
        style={{
          background:
            'linear-gradient(90deg, rgb(60,88,220) 0%, rgb(180,64,200) 35%, rgb(240,130,110) 70%, rgb(255,220,90) 100%)'
        }}
      />
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-mesh-mute">high · prob</span>
    </div>
  );
}
