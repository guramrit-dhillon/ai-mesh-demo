import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { useStore } from '../store';
import { score } from '../sampling';
import { renderToken } from '../tokens';
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

function tokenColor(node: GraphNode): string {
  // Animus / holo-map cyan palette
  if (node.kind === 'chain') {
    const t = 0.7 + 0.3 * node.decay;
    return `rgb(${Math.round(140 * t)}, ${Math.round(230 * t)}, ${Math.round(255 * t)})`;
  }
  if (node.kind === 'lookahead') {
    if (node.isTop) {
      // Lookahead top-1: bright aqua-mint, easy to spot at any depth
      return `rgb(140, 255, 230)`;
    }
    // Non-top lookahead: keep visibility floor so deep levels are still legible
    const t = Math.max(0.55, node.decay * (0.6 + 0.4 * node.prob));
    return `rgb(${Math.round(110 * t + 80)}, ${Math.round(200 * t + 55)}, ${Math.round(225 * t + 30)})`;
  }
  if (node.isTop && node.isActive) return '#e8fbff';
  if (node.isActive) {
    if (!node.alive) return '#3a5066';
    const t = 0.65 + 0.35 * node.prob;
    return `rgb(${Math.round(120 * t)}, ${Math.round(225 * t)}, ${Math.round(255 * t)})`;
  }
  if (node.isChosen) return '#7ce4ff';
  return '#33536b';
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

function linkColor(link: GraphLink): string {
  // Cyan/teal links for the holo-map look
  const i = Math.min(1, link.intensity);
  if (link.isChain) {
    return `rgba(120, 235, 255, ${0.4 + 0.6 * i})`;
  }
  if (link.isTopFan) {
    return `rgba(180, 250, 255, ${0.55 + 0.45 * i})`;
  }
  if (link.isLookahead) {
    const a = 0.12 + 0.5 * i;
    return `rgba(140, 230, 220, ${a})`;
  }
  return `rgba(100, 200, 230, ${0.18 * i + 0.05})`;
}

// Tag a sprite/group so the global fade-in loop will scale it up from 0 to 1
// over ~500 ms with cubic ease-out. Without this, each newly-streamed
// candidate or lookahead node "pops" into the scene.
function tagFadeIn(obj: THREE.Object3D) {
  obj.scale.setScalar(0.001);
  obj.userData.__fadeStart = performance.now();
}

function makeSprite(node: GraphNode): THREE.Object3D {
  const sprite = new SpriteText(renderToken(node.text));
  const color = tokenColor(node);
  sprite.color = color;
  sprite.fontFace = 'ui-monospace, monospace';
  sprite.fontWeight = node.isTop && node.isActive ? '700' : '500';
  sprite.textHeight = tokenSize(node);
  sprite.material.depthWrite = false;
  sprite.material.transparent = true;
  sprite.padding = 1;

  if (node.isTop && node.isActive) {
    // Add a subtle glowing halo behind the text using a sprite with radial gradient
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = 256;
    haloCanvas.height = 256;
    const ctx = haloCanvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(165,200,255,0.55)');
    grad.addColorStop(0.5, 'rgba(120,175,255,0.18)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    const haloTex = new THREE.CanvasTexture(haloCanvas);
    const haloMat = new THREE.SpriteMaterial({
      map: haloTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(40, 40, 1);
    const group = new THREE.Group();
    group.add(halo);
    group.add(sprite);
    tagFadeIn(group);
    return group;
  }

  tagFadeIn(sprite);
  return sprite;
}

function FallbackOverlay({ message, isError }: { message: string; isError?: boolean }) {
  return (
    <div className={`flex h-full items-center justify-center ${isError ? 'text-red-400' : 'text-slate-500'}`}>
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
    // Nudge force-graph to ingest the new node set immediately. Without this
    // the library can sit on partial data when nodes arrive in waves
    // (incremental top-K, or a lookahead inference returning later).
    const fg = fgRef.current as { refresh?: () => void } | null;
    if (fg && typeof fg.refresh === 'function') {
      try { fg.refresh(); } catch { /* */ }
    }
  }, [graphData]);

  // Drive fade-in animation: traverse the THREE scene and ease tagged objects
  // from scale 0 → 1 over 500 ms. Each sprite/group is tagged on creation in
  // makeSprite and untagged once it reaches full size.
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
        // Cubic ease-out
        const eased = 1 - Math.pow(1 - t, 3);
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
    // Add a starfield to the underlying THREE scene once.
    const scene = fg.scene();
    const STAR_TAG = 'llm-viz-stars';
    const existing = scene.children.find((c) => c.name === STAR_TAG);
    if (!existing) {
      const starGeom = new THREE.BufferGeometry();
      const starCount = 6000;
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
      const starMat = new THREE.PointsMaterial({
        color: 0x7ce4ff,
        size: 1.4,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.6
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
      const grid = new THREE.GridHelper(800, 80, 0x4dd9ff, 0x1a4a66) as THREE.Object3D;
      // dispose-friendly material tweaks
      const gridLines = grid as unknown as { material?: { transparent: boolean; opacity: number } };
      if (gridLines.material) {
        gridLines.material.transparent = true;
        gridLines.material.opacity = 0.18;
      }
      grid.position.y = -120;
      grid.name = GRID_TAG;
      scene.add(grid);
    }

    // Stronger bloom — the holo look needs noticeable blooming on the bright text.
    if (fg.postProcessingComposer) {
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

  // Compute the rotation pivot — midpoint between the leftmost visible chain
  // bubble and a small offset to the right of the tip (where the active fan +
  // lookahead live). Rotation around this point keeps the visible content
  // pivoting in place rather than swinging around an off-center anchor.
  const chainLen = tipNode?.inputTokens?.length ?? 0;
  const visibleChain = Math.min(chainLen, MAX_VISIBLE_CHAIN);
  // Chain spans x = (1 - visibleChain) * CHAIN_SPACING ... 0; fan extends to the right of 0
  // We bias slightly right of geometric center so the camera looks at the active region.
  const pivotX = visibleChain > 0
    ? ((1 - visibleChain) * CHAIN_SPACING) / 2 + 6
    : 0;

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
    try {
      const ctl = fg.controls();
      if (ctl?.target) {
        ctl.target.set(pivotX, 0, 0);
        if (typeof ctl.update === 'function') ctl.update();
      }
    } catch { /* unmounted or no controls yet */ }
  }, [tipSignature, pivotX]);

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
        background:
          'radial-gradient(ellipse at 50% 55%, #0a2a3e 0%, #061829 38%, #030914 70%, #01040a 100%)'
      }}
    >
      <ForceGraph3D
        ref={fgRef as never}
        width={size?.width}
        height={size?.height}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        showNavInfo={false}
        controlType="orbit"
        nodeThreeObject={(node) => makeSprite(node as unknown as GraphNode)}
        nodeThreeObjectExtend={false}
        linkColor={(l) => linkColor(l as unknown as GraphLink)}
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
            'repeating-linear-gradient(0deg, rgba(125, 235, 255, 0.04) 0px, rgba(125, 235, 255, 0.04) 1px, transparent 2px, transparent 4px)',
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
        <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 backdrop-blur-sm">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
          <span className="text-[10px] uppercase tracking-wider text-cyan-200/80">thinking</span>
        </div>
      )}

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
              const ctl = fg.controls();
              if (ctl?.target) {
                ctl.target.set(pivotX, 0, 0);
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
          className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-wider text-cyan-200/80 backdrop-blur-sm hover:bg-cyan-500/20"
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
          className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-wider text-cyan-200/80 backdrop-blur-sm hover:bg-cyan-500/20"
        >
          fullscreen
        </button>
      </div>

      {/* Pan / orbit hint, fades after a few seconds */}
      <div
        className="pointer-events-none absolute bottom-4 left-4 text-[10px] uppercase tracking-wider text-cyan-200/40"
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
