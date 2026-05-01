import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { useStore } from '../store';
import { renderToken } from '../tokens';
import { useAccentRGB } from '../theme/accent';

interface ScatterNode {
  id: string;
  text: string;
  kind: 'context' | 'pred' | 'actual';
  prob: number;
  rank: number;
  hit: boolean; // top-1 matched the actual next token
  fx: number;
  fy: number;
  fz: number;
}

const STEP_SPACING = 16;

export function LogitLensCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<unknown>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const result = useStore((s) => s.logitLensResult);
  const accentRGB = useAccentRGB();

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

  const graphData = useMemo(() => {
    if (!result) return { nodes: [], links: [] };
    const N = result.steps.length;
    const halfWidth = ((N - 1) * STEP_SPACING) / 2;

    const nodes: ScatterNode[] = [];
    result.steps.forEach((step, i) => {
      const x = i * STEP_SPACING - halfWidth;
      const top1 = step.topPredictions[0];
      const hit =
        step.actualNext !== null && top1 && top1.text === step.actualNext;

      // Context label below: shows the trailing fragment of the prefix.
      nodes.push({
        id: `ctx-${i}`,
        text: step.contextTail || '∅',
        kind: 'context',
        prob: 1,
        rank: 0,
        hit: !!hit,
        fx: x,
        fy: -10,
        fz: 0
      });

      // Top-3 predictions stacked above. y grows with rank → top-1 closest to ctx.
      step.topPredictions.forEach((p, r) => {
        nodes.push({
          id: `pred-${i}-${r}`,
          text: renderToken(p.text),
          kind: 'pred',
          prob: p.prob,
          rank: r,
          hit: r === 0 && !!hit,
          fx: x,
          fy: 6 + r * 6,
          fz: 0
        });
      });

      // Actual next token as a separate marker — when it matches top-1 we
      // tint it green; when it doesn't we tint it amber so the misses pop.
      if (step.actualNext !== null) {
        nodes.push({
          id: `actual-${i}`,
          text: `↦ ${renderToken(step.actualNext)}`,
          kind: 'actual',
          prob: 1,
          rank: 0,
          hit: !!hit,
          fx: x,
          fy: 30,
          fz: 0
        });
      }
    });

    return { nodes, links: [] };
  }, [result]);

  // Stars + bloom dressing.
  useEffect(() => {
    const fg = fgRef.current as
      | {
          scene: () => THREE.Scene;
          postProcessingComposer?: () => { addPass: (p: unknown) => void };
        }
      | null;
    if (!fg) return;
    const perf = useStore.getState().perfMode;
    const scene = fg.scene();
    const STAR_TAG = 'logit-lens-stars';
    if (!scene.children.find((c) => c.name === STAR_TAG)) {
      const starGeom = new THREE.BufferGeometry();
      const count = perf === 'low' ? 1200 : 4000;
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
          size: 1.0,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.55
        })
      );
      stars.name = STAR_TAG;
      scene.add(stars);
    }
    if (perf !== 'low' && fg.postProcessingComposer) {
      try {
        const composer = fg.postProcessingComposer();
        composer.addPass(
          new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.7, 0.5)
        );
      } catch {
        /* */
      }
    }
  }, []);

  // Retint stars when accent changes.
  useEffect(() => {
    const fg = fgRef.current as { scene?: () => THREE.Scene } | null;
    if (!fg?.scene) return;
    let scene: THREE.Scene;
    try { scene = fg.scene(); } catch { return; }
    const stars = scene.children.find((c) => c.name === 'logit-lens-stars') as THREE.Points | undefined;
    if (stars) {
      const [r, g, b] = accentRGB;
      const mat = stars.material as THREE.PointsMaterial;
      mat.color.setRGB(r / 255, g / 255, b / 255);
      mat.needsUpdate = true;
    }
  }, [accentRGB]);

  // Frame whenever result changes.
  useEffect(() => {
    const fg = fgRef.current as
      | {
          zoomToFit: (ms?: number, padding?: number) => void;
          controls: () => { target?: { set: (x: number, y: number, z: number) => void }; update?: () => void };
        }
      | null;
    if (!fg || !result) return;
    setTimeout(() => {
      try { fg.zoomToFit(800, 80); } catch { /* */ }
      try {
        const ctl = fg.controls();
        if (ctl?.target) {
          ctl.target.set(0, 8, 0);
          ctl.update?.();
        }
      } catch { /* */ }
    }, 200);
  }, [result]);

  // Fade-in animation.
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

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      style={{
        background:
          'radial-gradient(ellipse at 50% 55%, #0a2a3e 0%, #061829 38%, #030914 70%, #01040a 100%)'
      }}
    >
      {result ? (
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
            const group = new THREE.Group();
            const sprite = new SpriteText(n.text);

            if (n.kind === 'context') {
              sprite.color = '#9bc4d6';
              sprite.fontWeight = '500';
              sprite.textHeight = 2.8;
            } else if (n.kind === 'actual') {
              sprite.color = n.hit ? '#7be39a' : '#ffb84d';
              sprite.fontWeight = '600';
              sprite.textHeight = 3.4;
            } else {
              // prediction
              const intensity = Math.min(1, n.prob * 3);
              const alpha = 0.45 + intensity * 0.55;
              const [ar, ag, ab] = accentRGB;
              sprite.color =
                n.rank === 0
                  ? n.hit
                    ? `rgba(123, 227, 154, ${alpha})`
                    : `rgba(${ar}, ${ag}, ${ab}, ${alpha})`
                  : `rgba(150, 180, 200, ${alpha * 0.85})`;
              sprite.fontWeight = n.rank === 0 ? '600' : '500';
              sprite.textHeight = 3.2 - n.rank * 0.5;
            }
            sprite.fontFace = 'JetBrains Mono, ui-monospace, monospace';
            sprite.material.depthWrite = false;
            sprite.material.transparent = true;
            sprite.padding = 1;
            group.add(sprite);

            // Surprise marker: gold ring under the actual-token where the
            // model's top-1 didn't match. Easy at-a-glance "model was wrong".
            if (n.kind === 'actual' && !n.hit) {
              const ringCanvas = document.createElement('canvas');
              ringCanvas.width = 256;
              ringCanvas.height = 256;
              const ctx = ringCanvas.getContext('2d')!;
              const grad = ctx.createRadialGradient(128, 128, 60, 128, 128, 128);
              grad.addColorStop(0, 'rgba(0,0,0,0)');
              grad.addColorStop(0.55, 'rgba(255, 184, 77, 0.45)');
              grad.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = grad;
              ctx.fillRect(0, 0, 256, 256);
              const ringMat = new THREE.SpriteMaterial({
                map: new THREE.CanvasTexture(ringCanvas),
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending
              });
              const ring = new THREE.Sprite(ringMat);
              ring.scale.set(18, 18, 1);
              group.add(ring);
            }

            group.scale.setScalar(0.001);
            group.userData.__fadeStart = performance.now();
            return group;
          }}
          nodeThreeObjectExtend={false}
          linkColor={() => 'rgba(0,0,0,0)'}
          linkOpacity={0}
          cooldownTime={0}
          warmupTicks={0}
          enableNodeDrag={false}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-mesh-dim">
          <div className="font-display text-sm uppercase tracking-[0.2em] text-mesh-accent">logit lens</div>
          <div className="max-w-md px-6 text-center text-[11px] leading-relaxed text-mesh-mute">
            Type a prompt below, then click <span className="text-mesh-accent">compute logit lens</span> to
            see what the model would have predicted at each position in the prompt.
          </div>
        </div>
      )}

      {/* Holo overlay */}
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
          background: 'radial-gradient(ellipse at 50% 55%, transparent 40%, rgba(0,0,0,0.45) 100%)'
        }}
      />

      {result && <TrajectoryChart />}

      {result && (
        <div className="pointer-events-none absolute bottom-4 left-4 max-w-md font-mono text-[10px] uppercase tracking-[0.18em] text-mesh-mute">
          progressive prefix predictions —
          <span className="ml-1 text-mesh-good">green</span> = top-1 matched,
          <span className="ml-1 text-mesh-warm">amber</span> = model was surprised
        </div>
      )}
    </div>
  );
}

// Confidence trajectory: top-1 probability across the prefix axis. Drawn as a
// path with surprise positions marked in amber. Reads the result from the
// store so it stays in sync with the scene.
function TrajectoryChart() {
  const result = useStore((s) => s.logitLensResult);
  if (!result || result.steps.length === 0) return null;

  const W = 280;
  const H = 80;
  const PAD_X = 12;
  const PAD_Y = 10;

  const N = result.steps.length;
  const xFor = (i: number) => PAD_X + (i / Math.max(1, N - 1)) * (W - 2 * PAD_X);
  const yFor = (p: number) => H - PAD_Y - p * (H - 2 * PAD_Y);

  const points = result.steps.map((s, i) => {
    const top1 = s.topPredictions[0]?.prob ?? 0;
    const matched = s.actualNext !== null && s.topPredictions[0]?.text === s.actualNext;
    return { i, x: xFor(i), y: yFor(top1), p: top1, matched, surprise: s.actualNext !== null && !matched };
  });

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath =
    `${path} L ${points[points.length - 1].x.toFixed(1)} ${H - PAD_Y} L ${points[0].x.toFixed(1)} ${H - PAD_Y} Z`;

  const surpriseCount = points.filter((p) => p.surprise).length;

  return (
    <div className="pointer-events-none absolute right-4 top-4 rounded-md border border-mesh-edge/60 bg-mesh-panel/75 p-2.5 backdrop-blur">
      <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.2em]">
        <span className="text-mesh-mute">top-1 confidence by position</span>
        <span className="text-mesh-warm">{surpriseCount} surprise{surpriseCount === 1 ? '' : 's'}</span>
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Reference grid */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line key={p} x1={PAD_X} x2={W - PAD_X} y1={yFor(p)} y2={yFor(p)} stroke="rgba(var(--mesh-edge) / 0.5)" strokeDasharray="2 4" />
        ))}
        {/* Area under curve */}
        <path d={areaPath} fill="rgba(var(--mesh-accent) / 0.12)" />
        {/* Curve */}
        <path d={path} fill="none" stroke="rgb(var(--mesh-accent))" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 3px rgb(var(--mesh-accent)))' }} />
        {/* Markers */}
        {points.map((p) => (
          <circle
            key={p.i}
            cx={p.x}
            cy={p.y}
            r={p.surprise ? 3.5 : p.matched ? 2.6 : 2}
            fill={p.surprise ? 'rgb(var(--mesh-warm))' : p.matched ? 'rgb(var(--mesh-good))' : 'rgb(var(--mesh-accent))'}
            stroke="rgb(var(--mesh-ink))"
            strokeWidth="1"
          />
        ))}
        {/* Y-axis labels */}
        <text x={PAD_X - 2} y={yFor(1) + 3} fontSize="8" fill="rgb(var(--mesh-mute))" textAnchor="end" fontFamily="JetBrains Mono">100%</text>
        <text x={PAD_X - 2} y={yFor(0) + 3} fontSize="8" fill="rgb(var(--mesh-mute))" textAnchor="end" fontFamily="JetBrains Mono">0%</text>
      </svg>
    </div>
  );
}
