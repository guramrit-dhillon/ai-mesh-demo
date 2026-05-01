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
  attribution: number;
  isPrediction: boolean;
  fx: number;
  fy: number;
  fz: number;
}

const TOKEN_SPACING = 14;

// Map attribution (0..1) to a color from cool slate (low) to hot amber (high).
function attributionColor(a: number): string {
  // 0 → #5b6b7a (slate), 1 → #ffb84d (amber-orange)
  const lo = [0x5b, 0x6b, 0x7a];
  const hi = [0xff, 0xb8, 0x4d];
  const r = Math.round(lo[0] + (hi[0] - lo[0]) * a);
  const g = Math.round(lo[1] + (hi[1] - lo[1]) * a);
  const b = Math.round(lo[2] + (hi[2] - lo[2]) * a);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function AttentionCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<unknown>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const result = useStore((s) => s.attentionResult);
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

  const graphData = useMemo(() => {
    if (!result) return { nodes: [], links: [] };
    const N = result.inputTokens.length;
    const halfWidth = ((N - 1) * TOKEN_SPACING) / 2;
    const inputNodes: ScatterNode[] = result.inputTokens.map((t, i) => ({
      id: `in-${i}`,
      text: renderToken(t.text),
      attribution: t.attribution,
      isPrediction: false,
      fx: i * TOKEN_SPACING - halfWidth,
      fy: 0,
      fz: 0
    }));
    // Predicted next-token sits above and to the right, like an output target.
    const predNode: ScatterNode = {
      id: 'pred',
      text: `→ ${renderToken(result.baselineTopText)}`,
      attribution: 1,
      isPrediction: true,
      fx: halfWidth + TOKEN_SPACING * 1.2,
      fy: 18,
      fz: 0
    };
    return { nodes: [...inputNodes, predNode], links: [] };
  }, [result]);

  // One-time scene dressing: stars, bloom, framing.
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
    const STAR_TAG = 'attention-stars';
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
          new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.8, 0.45)
        );
      } catch {
        /* */
      }
    }
  }, []);

  // Retint stars when accent changes (separate from one-shot scene init).
  useEffect(() => {
    const fg = fgRef.current as { scene?: () => THREE.Scene } | null;
    if (!fg?.scene) return;
    let scene: THREE.Scene;
    try { scene = fg.scene(); } catch { return; }
    const stars = scene.children.find((c) => c.name === 'attention-stars') as THREE.Points | undefined;
    if (stars) {
      const [r, g, b] = accentRGB;
      const mat = stars.material as THREE.PointsMaterial;
      mat.color.setRGB(r / 255, g / 255, b / 255);
      mat.needsUpdate = true;
    }
  }, [accentRGB]);

  // Re-frame whenever a new result lands.
  useEffect(() => {
    const fg = fgRef.current as
      | {
          zoomToFit: (ms?: number, padding?: number) => void;
          controls: () => { target?: { set: (x: number, y: number, z: number) => void }; update?: () => void };
          cameraPosition: (pos: { x: number; y: number; z: number }, lookAt?: { x: number; y: number; z: number }, ms?: number) => void;
        }
      | null;
    if (!fg || !result) return;
    setTimeout(() => {
      try { fg.zoomToFit(800, 80); } catch { /* */ }
      try {
        const ctl = fg.controls();
        if (ctl?.target) {
          ctl.target.set(0, 4, 0);
          ctl.update?.();
        }
      } catch { /* */ }
    }, 200);
  }, [result]);

  // Fade-in animation for newly-mounted sprites.
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
            sprite.color = n.isPrediction ? accentHex : attributionColor(n.attribution);
            sprite.fontFace = 'JetBrains Mono, ui-monospace, monospace';
            sprite.fontWeight = n.isPrediction ? '600' : '500';
            // Input tokens grow with attribution (3.0 → 6.5). Prediction is fixed.
            sprite.textHeight = n.isPrediction ? 5.5 : 3.0 + n.attribution * 3.5;
            sprite.material.depthWrite = false;
            sprite.material.transparent = true;
            sprite.padding = 1;
            group.add(sprite);

            // Bar above each input token — height encodes attribution.
            if (!n.isPrediction && n.attribution > 0.02) {
              const barH = 0.5 + n.attribution * 7;
              const barGeom = new THREE.PlaneGeometry(1.6, barH);
              const barMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(attributionColor(n.attribution)),
                transparent: true,
                opacity: 0.65,
                depthWrite: false,
                side: THREE.DoubleSide
              });
              const bar = new THREE.Mesh(barGeom, barMat);
              bar.position.set(0, 6 + barH / 2, 0);
              group.add(bar);
            }

            // Subtle ground line so the row reads as an axis.
            if (!n.isPrediction) {
              const dotGeom = new THREE.CircleGeometry(0.6, 16);
              const dotMat = new THREE.MeshBasicMaterial({
                color: 0x335060,
                transparent: true,
                opacity: 0.6,
                depthWrite: false
              });
              const dot = new THREE.Mesh(dotGeom, dotMat);
              dot.position.set(0, -3.5, 0);
              dot.rotation.x = -Math.PI / 2;
              group.add(dot);
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
          <div className="font-display text-sm uppercase tracking-[0.2em] text-mesh-accent">attention</div>
          <div className="max-w-md px-6 text-center text-[11px] leading-relaxed text-mesh-mute">
            Type a prompt below, then click <span className="text-mesh-accent">compute attention</span> to see
            which input tokens the model relied on most when picking its next word.
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

      {result && (
        <div className="pointer-events-none absolute bottom-4 left-4 max-w-md font-mono text-[10px] uppercase tracking-[0.18em] text-mesh-mute">
          attention via input ablation —
          <span className="ml-1 text-mesh-warm">
            top-1 prediction: {renderToken(result.baselineTopText)}
          </span>
          <span className="ml-2 text-mesh-dim">
            (p ≈ {(result.baselineTopProb * 100).toFixed(1)}%)
          </span>
        </div>
      )}
    </div>
  );
}
