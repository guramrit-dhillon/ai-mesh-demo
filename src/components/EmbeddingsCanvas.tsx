import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { buildEmbeddingPoints, categoryColor } from '../embeddings/data';
import { useStore } from '../store';

interface ScatterNode {
  id: string;
  text: string;
  category: string;
  color: string;
  fx: number;
  fy: number;
  fz: number;
}

export function EmbeddingsCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<unknown>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const spread = useStore((s) => s.embeddingSpread);
  const textSize = useStore((s) => s.embeddingTextSize);
  const realEmbeddings = useStore((s) => s.realEmbeddings);

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
    // Prefer real embeddings (computed in-browser via MiniLM) when loaded;
    // otherwise fall back to the synthetic clustered dataset.
    const points = realEmbeddings ?? buildEmbeddingPoints();
    const nodes: ScatterNode[] = points.map((p) => ({
      id: `${p.category}/${p.text}`,
      text: p.text,
      category: p.category,
      color: categoryColor(p.category),
      fx: p.x * spread,
      fy: p.y * spread,
      fz: p.z * spread
    }));
    return { nodes, links: [] };
  }, [spread, realEmbeddings]);

  // One-time: stars, grid floor, bloom — same holographic vocabulary as the
  // predictions mode so the two views feel like the same product.
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
    const scene = fg.scene();
    const STAR_TAG = 'embed-stars';
    if (!scene.children.find((c) => c.name === STAR_TAG)) {
      const starGeom = new THREE.BufferGeometry();
      const count = 5000;
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
      const stars = new THREE.Points(
        starGeom,
        new THREE.PointsMaterial({ color: 0x7ce4ff, size: 1.2, sizeAttenuation: true, transparent: true, opacity: 0.6 })
      );
      stars.name = STAR_TAG;
      scene.add(stars);
    }
    if (fg.postProcessingComposer) {
      try {
        const composer = fg.postProcessingComposer();
        // Lighter bloom for embeddings — many sprites packed into a cube,
        // so heavy bloom would just merge them into a white blob.
        composer.addPass(
          new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.6, 0.55)
        );
      } catch {
        /* */
      }
    }
    // Initial frame
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

  // Fade-in animation loop (matches MeshCanvas behavior).
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
        const eased = 1 - Math.pow(1 - t, 3);
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
          const sprite = new SpriteText(n.text);
          sprite.color = n.color;
          sprite.fontFace = 'ui-monospace, monospace';
          sprite.fontWeight = '500';
          sprite.textHeight = textSize;
          sprite.material.depthWrite = false;
          sprite.material.transparent = true;
          sprite.padding = 1;
          const wrapper = new THREE.Group();
          wrapper.add(sprite);
          wrapper.scale.setScalar(0.001);
          wrapper.userData.__fadeStart = performance.now();
          return wrapper;
        }}
        nodeThreeObjectExtend={false}
        linkColor={() => 'rgba(0,0,0,0)'}
        linkOpacity={0}
        cooldownTime={0}
        warmupTicks={0}
        enableNodeDrag={false}
      />

      {/* Holo overlay — scan lines + vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(125, 235, 255, 0.04) 0px, rgba(125, 235, 255, 0.04) 1px, transparent 2px, transparent 4px)',
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

      <div className="pointer-events-none absolute bottom-4 left-4 text-[10px] uppercase tracking-wider text-cyan-200/60">
        embedding space — clusters by meaning
      </div>
    </div>
  );
}
