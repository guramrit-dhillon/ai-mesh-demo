import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { buildEmbeddingPoints, categoryColor } from '../embeddings/data';
import { useStore } from '../store';
import { useAccentRGB, rgba } from '../theme/accent';

interface ScatterNode {
  id: string;
  text: string;
  category: string;
  color: string;
  isMatch: boolean;
  isPickedA: boolean;
  isPickedB: boolean;
  fx: number;
  fy: number;
  fz: number;
  ox: number; // pre-spread original coords (used for cosine sim)
  oy: number;
  oz: number;
}

interface ScatterLink {
  source: string;
  target: string;
  isDistance: boolean;
}

export function EmbeddingsCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<unknown>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const spread = useStore((s) => s.embeddingSpread);
  const textSize = useStore((s) => s.embeddingTextSize);
  const realEmbeddings = useStore((s) => s.realEmbeddings);
  const search = useStore((s) => s.embeddingSearch);
  const twoD = useStore((s) => s.embeddingTwoD);
  const pickedA = useStore((s) => s.embeddingDistanceA);
  const pickedB = useStore((s) => s.embeddingDistanceB);
  const pickPoint = useStore((s) => s.pickDistancePoint);
  const accentRGB = useAccentRGB();
  const accentHex = `rgb(${accentRGB[0]}, ${accentRGB[1]}, ${accentRGB[2]})`;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setSize({ width: w, height: h });
    };
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const graphData = useMemo<{ nodes: ScatterNode[]; links: ScatterLink[] }>(() => {
    const points = realEmbeddings ?? buildEmbeddingPoints();
    const q = search.trim().toLowerCase();
    const nodes: ScatterNode[] = points.map((p) => {
      const id = `${p.category}/${p.text}`;
      const isMatch = q.length > 0 && p.text.toLowerCase().includes(q);
      return {
        id,
        text: p.text,
        category: p.category,
        color: categoryColor(p.category),
        isMatch,
        isPickedA: id === pickedA,
        isPickedB: id === pickedB,
        fx: p.x * spread,
        // 2D mode flattens y into a horizontal plane along x/z so the camera
        // can read it head-on. We keep z slightly active so a tiny camera
        // wiggle doesn't look like it broke depth.
        fy: twoD ? 0 : p.y * spread,
        fz: p.z * spread,
        ox: p.x,
        oy: p.y,
        oz: p.z
      };
    });
    const links: ScatterLink[] = [];
    if (pickedA && pickedB) {
      links.push({ source: pickedA, target: pickedB, isDistance: true });
    }
    return { nodes, links };
  }, [spread, realEmbeddings, search, twoD, pickedA, pickedB]);

  // Cosine similarity of the picked pair (computed from original PCA vectors).
  const distanceInfo = useMemo(() => {
    if (!pickedA || !pickedB) return null;
    const a = graphData.nodes.find((n) => n.id === pickedA);
    const b = graphData.nodes.find((n) => n.id === pickedB);
    if (!a || !b) return null;
    const dot = a.ox * b.ox + a.oy * b.oy + a.oz * b.oz;
    const na = Math.hypot(a.ox, a.oy, a.oz);
    const nb = Math.hypot(b.ox, b.oy, b.oz);
    const cos = dot / Math.max(na * nb, 1e-9);
    const dist = Math.hypot(a.ox - b.ox, a.oy - b.oy, a.oz - b.oz);
    return { aText: a.text, bText: b.text, cos, dist };
  }, [graphData.nodes, pickedA, pickedB]);

  // One-time scene dressing — same vocabulary as the predictions canvas.
  useEffect(() => {
    const fg = fgRef.current as
      | {
          scene: () => THREE.Scene;
          postProcessingComposer?: () => { addPass: (p: unknown) => void };
          zoomToFit: (ms?: number, padding?: number) => void;
          controls: () => { target?: { set: (x: number, y: number, z: number) => void }; update?: () => void };
        }
      | null;
    if (!fg) return;
    const perf = useStore.getState().perfMode;
    const scene = fg.scene();
    const STAR_TAG = 'embed-stars';
    if (!scene.children.find((c) => c.name === STAR_TAG)) {
      const starGeom = new THREE.BufferGeometry();
      const count = perf === 'low' ? 1500 : 5000;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = 500 + Math.random() * 1500;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      starGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const [sr, sg, sb] = accentRGB;
      const stars = new THREE.Points(
        starGeom,
        new THREE.PointsMaterial({
          color: new THREE.Color(sr / 255, sg / 255, sb / 255),
          size: 1.2,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.6
        })
      );
      stars.name = STAR_TAG;
      scene.add(stars);
    }
    if (perf !== 'low' && fg.postProcessingComposer) {
      try {
        const composer = fg.postProcessingComposer();
        composer.addPass(
          new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.6, 0.55)
        );
      } catch { /* */ }
    }
    setTimeout(() => {
      try { fg.zoomToFit(800, 60); } catch { /* */ }
      try {
        const ctl = fg.controls();
        if (ctl?.target) {
          ctl.target.set(0, 0, 0);
          ctl.update?.();
        }
      } catch { /* */ }
    }, 400);
  }, []);

  // Retint stars on accent change.
  useEffect(() => {
    const fg = fgRef.current as { scene?: () => THREE.Scene } | null;
    if (!fg?.scene) return;
    let scene: THREE.Scene;
    try { scene = fg.scene(); } catch { return; }
    const stars = scene.children.find((c) => c.name === 'embed-stars') as THREE.Points | undefined;
    if (stars) {
      const [r, g, b] = accentRGB;
      const mat = stars.material as THREE.PointsMaterial;
      mat.color.setRGB(r / 255, g / 255, b / 255);
      mat.needsUpdate = true;
    }
  }, [accentRGB]);

  // Camera fly-to: when the user types a search and there are hits, re-frame
  // around the matching cluster centroid. Tight zoom into the match keeps the
  // exploration fluid.
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) return;
    const matches = graphData.nodes.filter((n) => n.isMatch);
    if (matches.length === 0) return;
    const cx = matches.reduce((s, n) => s + n.fx, 0) / matches.length;
    const cy = matches.reduce((s, n) => s + n.fy, 0) / matches.length;
    const cz = matches.reduce((s, n) => s + n.fz, 0) / matches.length;
    const fg = fgRef.current as
      | {
          controls: () => {
            target?: { set: (x: number, y: number, z: number) => void };
            update?: () => void;
          };
          cameraPosition: (
            pos: { x: number; y: number; z: number },
            lookAt?: { x: number; y: number; z: number },
            ms?: number
          ) => void;
        }
      | null;
    if (!fg) return;
    try {
      // Pull the camera toward the centroid along its current direction.
      fg.cameraPosition({ x: cx + 110, y: cy + 60, z: cz + 110 }, { x: cx, y: cy, z: cz }, 700);
      const ctl = fg.controls();
      if (ctl?.target) {
        ctl.target.set(cx, cy, cz);
        ctl.update?.();
      }
    } catch { /* */ }
  }, [search, graphData.nodes]);

  // 2D toggle — orient camera straight down the y axis.
  useEffect(() => {
    const fg = fgRef.current as
      | {
          cameraPosition: (
            pos: { x: number; y: number; z: number },
            lookAt?: { x: number; y: number; z: number },
            ms?: number
          ) => void;
        }
      | null;
    if (!fg) return;
    if (twoD) {
      try { fg.cameraPosition({ x: 0, y: 220, z: 0.0001 }, { x: 0, y: 0, z: 0 }, 700); } catch { /* */ }
    } else {
      try { fg.cameraPosition({ x: 110, y: 110, z: 220 }, { x: 0, y: 0, z: 0 }, 700); } catch { /* */ }
    }
  }, [twoD]);

  // Fade-in animation loop.
  useEffect(() => {
    let raf = 0;
    const FADE_MS = 600;
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

  const matchCount = search.trim() ? graphData.nodes.filter((n) => n.isMatch).length : 0;
  const searchActive = search.trim().length > 0;

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
        nodeThreeObject={(node) => {
          const n = node as unknown as ScatterNode;
          const wrapper = new THREE.Group();

          // Color/size logic — match emphasis, picked emphasis, otherwise default.
          let color = n.color;
          let height = textSize;
          let weight = '500';
          if (searchActive) {
            if (n.isMatch) {
              color = '#ffd87a';
              height = textSize * 1.5;
              weight = '700';
            } else {
              color = '#2c3a4a';
              height = textSize * 0.85;
            }
          }
          if (n.isPickedA || n.isPickedB) {
            // A = current accent color, B = violet contrast (always violet
            // regardless of accent so the pair stays visually distinct).
            color = n.isPickedA ? accentHex : '#a78bfa';
            height = textSize * 1.6;
            weight = '700';
          }

          const sprite = new SpriteText(n.text);
          sprite.color = color;
          sprite.fontFace = 'ui-monospace, monospace';
          sprite.fontWeight = weight;
          sprite.textHeight = height;
          sprite.material.depthWrite = false;
          sprite.material.transparent = true;
          sprite.padding = 1;
          wrapper.add(sprite);

          // Selection halo for picked points.
          if (n.isPickedA || n.isPickedB) {
            const haloCanvas = document.createElement('canvas');
            haloCanvas.width = 256;
            haloCanvas.height = 256;
            const ctx = haloCanvas.getContext('2d')!;
            const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
            const stop = n.isPickedA ? rgba(accentRGB, 0.6) : 'rgba(167,139,250,0.6)';
            grad.addColorStop(0, stop);
            grad.addColorStop(0.5, 'rgba(0,0,0,0.0)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 256, 256);
            const haloMat = new THREE.SpriteMaterial({
              map: new THREE.CanvasTexture(haloCanvas),
              transparent: true,
              depthWrite: false,
              blending: THREE.AdditiveBlending
            });
            const halo = new THREE.Sprite(haloMat);
            halo.scale.set(28, 28, 1);
            wrapper.add(halo);
          }

          wrapper.scale.setScalar(0.001);
          wrapper.userData.__fadeStart = performance.now();
          return wrapper;
        }}
        nodeThreeObjectExtend={false}
        linkColor={(l) => {
          const link = l as unknown as ScatterLink;
          return link.isDistance ? 'rgba(255, 184, 77, 0.85)' : 'rgba(0,0,0,0)';
        }}
        linkWidth={(l) => ((l as unknown as ScatterLink).isDistance ? 1.4 : 0)}
        linkOpacity={1}
        cooldownTime={0}
        warmupTicks={0}
        enableNodeDrag={false}
        onNodeClick={(node) => {
          const n = node as unknown as ScatterNode;
          pickPoint(n.id);
        }}
        onNodeHover={(node) => {
          document.body.style.cursor = node ? 'pointer' : '';
        }}
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(var(--mesh-accent) / 0.04) 0px, rgba(var(--mesh-accent) / 0.04) 1px, transparent 2px, transparent 4px)',
          mixBlendMode: 'screen'
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 55%, transparent 40%, rgba(0,0,0,0.45) 100%)'
        }}
      />

      <div className="pointer-events-none absolute bottom-4 left-4 font-mono text-[10px] uppercase tracking-[0.18em] text-mesh-mute">
        embedding space — {twoD ? '2d projection' : '3d projection'}
      </div>

      {searchActive && (
        <div className="pointer-events-none absolute right-4 top-4 rounded-md border border-mesh-edge/60 bg-mesh-panel/70 px-3 py-1.5 backdrop-blur">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mesh-mute">
            matches:
          </span>
          <span className="ml-2 font-mono text-[11px] text-mesh-fg">{matchCount}</span>
        </div>
      )}

      {distanceInfo && (
        <div className="pointer-events-none absolute bottom-4 right-4 max-w-xs rounded-md border border-mesh-warm/40 bg-mesh-warm/5 px-3 py-2 backdrop-blur">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-mesh-warm">
            distance
          </div>
          <div className="mt-1 font-mono text-[11px] text-mesh-fg">
            <span className="text-mesh-accent">{distanceInfo.aText}</span>
            <span className="mx-2 text-mesh-mute">↔</span>
            <span style={{ color: '#a78bfa' }}>{distanceInfo.bText}</span>
          </div>
          <div className="mt-1 flex gap-3 font-mono text-[10px] text-mesh-dim">
            <span>cos = <span className="text-mesh-fg">{distanceInfo.cos.toFixed(3)}</span></span>
            <span>‖Δ‖ = <span className="text-mesh-fg">{distanceInfo.dist.toFixed(2)}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}
