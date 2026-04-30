import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { useStore } from '../store';
import { score } from '../sampling';
import { renderToken } from '../tokens';
import type { CandidateToken, TreeNode } from '../types';

const VISIBLE_PER_NODE = 24;
const CHAIN_SPACING = 18;

interface GraphNode {
  id: string;
  kind: 'chain' | 'candidate';
  text: string;
  alive: boolean;
  isTop: boolean;
  isActive: boolean;
  isChosen: boolean;
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
  sampling: ReturnType<typeof useStore.getState>['sampling']
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

  inputTokens.forEach((tok, i) => {
    const distance = inputTokens.length - 1 - i;
    const decay = decayFor(distance);
    const id = `chain-${i}-${tok.id}`;
    chainNodeIds.push(id);
    nodes.push({
      id,
      kind: 'chain',
      text: tok.text,
      alive: true,
      isTop: false,
      isActive: false,
      isChosen: false,
      decay,
      prob: 1,
      rank: i,
      fx: i * CHAIN_SPACING,
      fy: 0,
      fz: 0
    });
    if (i > 0) {
      links.push({
        source: chainNodeIds[i - 1],
        target: id,
        alive: true,
        isChain: true,
        isTopFan: false,
        intensity: 0.85 + 0.15 * decay
      });
    }
  });

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

    const anchorChainNodeId = chainNodeIds[Math.max(fanPositionIndex - 1, 0)];

    ordered.forEach((o) => {
      const isTop = o.rank === 0;
      const isChosen = chosenText !== null && o.candidate.text === chosenText;
      const id = `fan-${tn.id}-${o.candidate.id}`;
      nodes.push({
        id,
        kind: 'candidate',
        text: o.candidate.text,
        alive: o.alive,
        isTop,
        isActive,
        isChosen,
        decay: fadeFactor,
        prob: o.prob,
        rank: o.rank,
        treeNodeId: tn.id,
        candidateIndex: o.originalIndex,
        candidate: o.candidate
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
        intensity
      });
    });
  });

  return { nodes, links };
}

function tokenColor(node: GraphNode): string {
  if (node.kind === 'chain') {
    // Brighter chain tokens — clamp to a higher floor so even old context is legible
    const t = 0.7 + 0.3 * node.decay;
    return `rgb(${Math.round(165 * t)}, ${Math.round(205 * t)}, ${Math.round(255 * t)})`;
  }
  if (node.isTop && node.isActive) return '#ffffff';
  if (node.isActive) {
    if (!node.alive) return '#475569';
    const t = 0.7 + 0.3 * node.prob;
    return `rgb(${Math.round(180 * t)}, ${Math.round(215 * t)}, ${Math.round(255 * t)})`;
  }
  if (node.isChosen) return '#a5c8ff';
  return '#3f546e';
}

function tokenSize(node: GraphNode): number {
  if (node.kind === 'chain') return 3.5 + 4.5 * node.decay;
  if (node.isTop && node.isActive) return 11;
  if (node.isActive) return 4 + 7 * Math.sqrt(node.prob);
  if (node.isChosen) return 5;
  return 3 + 2.5 * node.decay;
}

function linkColor(link: GraphLink): string {
  const i = Math.min(1, link.intensity);
  if (link.isChain) {
    return `rgba(150, 200, 255, ${0.4 + 0.6 * i})`;
  }
  if (link.isTopFan) {
    return `rgba(180, 220, 255, ${0.5 + 0.5 * i})`;
  }
  return `rgba(120, 175, 255, ${0.18 * i + 0.05})`;
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
    return group;
  }

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
  const [size, setSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const graphData: GraphData = useMemo(
    () => buildGraphData(tipNodeId, storeNodes, sampling) ?? { nodes: [], links: [] },
    [tipNodeId, storeNodes, sampling]
  );

  useEffect(() => {
    const fg = fgRef.current as
      | {
          d3Force: (name: string) => unknown;
          scene: () => THREE.Scene;
          zoomToFit: (ms?: number, padding?: number) => void;
        }
      | null;
    if (!fg) return;
    // Add a starfield to the underlying THREE scene once.
    const scene = fg.scene();
    const STAR_TAG = 'llm-viz-stars';
    const existing = scene.children.find((c) => c.name === STAR_TAG);
    if (!existing) {
      const starGeom = new THREE.BufferGeometry();
      const starCount = 4000;
      const positions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const r = 600 + Math.random() * 1200;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      starGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const starMat = new THREE.PointsMaterial({
        color: 0xb6c8ff,
        size: 1.2,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.7
      });
      const stars = new THREE.Points(starGeom, starMat);
      stars.name = STAR_TAG;
      scene.add(stars);
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

    // Re-fit camera shortly after physics restart so the freshly-laid-out
    // graph fills the view.
    const t = window.setTimeout(() => {
      try {
        fg.zoomToFit(800, 60);
      } catch {
        /* fg may have unmounted */
      }
    }, 1200);
    return () => window.clearTimeout(t);
  }, [graphData]);

  if (!tipNode) return <FallbackOverlay message="Loading..." />;
  if (tipNode.status === 'error') {
    return <FallbackOverlay message={`Inference error: ${tipNode.error}`} isError />;
  }
  if (!hasAnyData && tipNode.prompt === '') {
    return <FallbackOverlay message="Type a prompt below to see the mesh." />;
  }
  if (!hasAnyData) {
    return <FallbackOverlay message="Computing distribution..." />;
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      style={{
        background:
          'radial-gradient(ellipse at 50% 50%, #0f1a3d 0%, #060b22 50%, #02030a 100%)'
      }}
    >
      <ForceGraph3D
        ref={fgRef as never}
        width={size.width}
        height={size.height}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        showNavInfo={false}
        nodeThreeObject={(node) => makeSprite(node as unknown as GraphNode)}
        nodeThreeObjectExtend={false}
        linkColor={(l) => linkColor(l as unknown as GraphLink)}
        linkOpacity={1}
        linkWidth={(l) => {
          const link = l as unknown as GraphLink;
          if (link.isChain) return 1.6;
          if (link.isTopFan) return 1.2;
          return 0.4 + 0.5 * link.intensity;
        }}
        linkDirectionalParticles={(l) => {
          const link = l as unknown as GraphLink;
          if (link.isTopFan) return 4;
          if (link.isChain) return 2;
          return 0;
        }}
        linkDirectionalParticleWidth={(l) => {
          const link = l as unknown as GraphLink;
          return link.isTopFan ? 2.2 : 1.2;
        }}
        linkDirectionalParticleSpeed={(l) => {
          const link = l as unknown as GraphLink;
          return link.isTopFan ? 0.012 : 0.006;
        }}
        linkDirectionalParticleColor={() => '#cfe2ff'}
        d3AlphaDecay={0.025}
        d3VelocityDecay={0.4}
        cooldownTicks={300}
        warmupTicks={50}
        enableNodeDrag={false}
        onNodeHover={(node) => {
          const n = node as unknown as GraphNode | null;
          if (!n || n.kind !== 'candidate' || !n.treeNodeId || n.candidateIndex === undefined) {
            setHover(null, null);
            document.body.style.cursor = '';
            return;
          }
          setHover(n.treeNodeId, n.candidateIndex);
          document.body.style.cursor = 'pointer';
        }}
        onNodeClick={(node) => {
          const n = node as unknown as GraphNode;
          if (n.kind !== 'candidate' || !n.isActive || !n.treeNodeId || !n.candidate) return;
          expand(n.treeNodeId, n.candidate);
        }}
      />
      {isThinking && (
        <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 backdrop-blur-sm">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-300" />
          <span className="text-[10px] uppercase tracking-wider text-blue-200/80">thinking</span>
        </div>
      )}
    </div>
  );
}
