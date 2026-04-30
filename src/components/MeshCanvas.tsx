import type { ReactNode } from 'react';
import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { score } from '../sampling';
import { renderToken } from '../tokens';
import type { CandidateToken, InputToken, TreeNode } from '../types';

const CHAIN_SPACING = 1.6;
const MIN_R = 0.18;
const MAX_R = 0.52;
const TOP_HALO_R = 0.62;
const VISIBLE_FAN = 12;
const FAN_RADIUS = 1.4;

interface ChainBubble {
  key: string;
  text: string;
  position: [number, number, number];
  radius: number;
  decay: number;
}

interface FanBubble {
  key: string;
  candidateIndex: number;
  candidate: CandidateToken;
  prob: number;
  alive: boolean;
  rank: number;
  position: [number, number, number];
  radius: number;
  isTop: boolean;
  treeNodeId: string;
  isActive: boolean;
  isChosen: boolean;
}

interface Edge {
  key: string;
  from: [number, number, number];
  to: [number, number, number];
  opacity: number;
  width: number;
  color: string;
}

function decayFor(distance: number): number {
  return Math.pow(0.78, distance);
}

function buildScene(
  tipNodeId: string,
  nodes: Record<string, TreeNode>,
  sampling: ReturnType<typeof useStore.getState>['sampling']
): { chain: ChainBubble[]; fans: FanBubble[]; edges: Edge[]; tipPosition: [number, number, number] } | null {
  const tipNode = nodes[tipNodeId];
  if (!tipNode || !tipNode.inputTokens || !tipNode.candidates) return null;

  const treeChain: TreeNode[] = [];
  let cur: TreeNode | null = tipNode;
  while (cur) {
    treeChain.unshift(cur);
    cur = cur.parentId ? nodes[cur.parentId] ?? null : null;
  }

  const inputTokens: InputToken[] = tipNode.inputTokens;

  const chain: ChainBubble[] = inputTokens.map((tok, i) => {
    const distance = inputTokens.length - 1 - i;
    const decay = decayFor(distance);
    const radius = MIN_R + (MAX_R - MIN_R) * decay;
    return {
      key: `chain-${i}-${tok.id}`,
      text: tok.text,
      position: [i * CHAIN_SPACING, 0, 0],
      radius,
      decay
    };
  });

  const tipPosition: [number, number, number] = chain.length
    ? chain[chain.length - 1].position
    : [0, 0, 0];

  const fans: FanBubble[] = [];
  const edges: Edge[] = [];

  for (let chainIdx = 1; chainIdx < chain.length; chainIdx++) {
    edges.push({
      key: `chain-edge-${chainIdx}`,
      from: chain[chainIdx - 1].position,
      to: chain[chainIdx].position,
      opacity: 0.25 + 0.6 * chain[chainIdx].decay,
      width: 1.5 + 1.5 * chain[chainIdx].decay,
      color: '#7cb1ff'
    });
  }

  treeChain.forEach((tn, treeIdx) => {
    if (!tn.candidates || !tn.inputTokens) return;
    const fanPositionIndex = tn.inputTokens.length;
    const isActive = treeIdx === treeChain.length - 1;
    const fanCenterX = isActive
      ? fanPositionIndex * CHAIN_SPACING
      : (fanPositionIndex - 0.5) * CHAIN_SPACING;
    const fanDistance = inputTokens.length - tn.inputTokens.length;
    const fadeFactor = isActive ? 1.0 : Math.max(0.18, decayFor(fanDistance));

    const visible = Math.min(tn.candidates.length, VISIBLE_FAN);
    const scored = score(
      tn.candidates.map((c) => c.logit),
      sampling
    );
    const ordered = scored
      .map((s, i) => ({ ...s, candidate: tn.candidates![i], originalIndex: i }))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, visible);

    const chosenText = !isActive && fanPositionIndex < inputTokens.length
      ? inputTokens[fanPositionIndex].text
      : null;

    ordered.forEach((o, i) => {
      const isTop = o.rank === 0;
      const isChosen = chosenText !== null && o.candidate.text === chosenText;

      let position: [number, number, number];
      if (isActive && isTop) {
        position = [fanCenterX + FAN_RADIUS * 1.0, 0, 0.2];
      } else if (!isActive && isChosen) {
        position = [fanPositionIndex * CHAIN_SPACING, 0, 0];
      } else if (isActive) {
        const r = o.rank;
        const half = Math.ceil(r / 2);
        const above = r % 2 === 1;
        const yMag = Math.min(half * 0.55, 2.5);
        const xPull = Math.max(0.15, 0.7 - half * 0.05);
        const zJitter = (above ? 0.1 : -0.1) + ((r * 0.7) % 1 - 0.5) * 0.5;
        position = [fanCenterX + xPull, above ? yMag : -yMag, zJitter];
      } else {
        const r = i;
        const angle = r * (Math.PI * 2 * 0.32) + Math.PI / 5;
        const ringR = FAN_RADIUS * 0.55;
        position = [
          fanCenterX,
          Math.cos(angle) * ringR,
          Math.sin(angle) * ringR - 0.4
        ];
      }

      const radius = isTop && isActive
        ? TOP_HALO_R
        : MIN_R + (MAX_R - MIN_R) * Math.sqrt(o.prob) * fadeFactor;

      fans.push({
        key: `fan-${tn.id}-${o.candidate.id}`,
        candidateIndex: o.originalIndex,
        candidate: o.candidate,
        prob: o.prob,
        alive: o.alive,
        rank: o.rank,
        position,
        radius,
        isTop,
        treeNodeId: tn.id,
        isActive,
        isChosen
      });

      const fromCenter: [number, number, number] = [
        tn.inputTokens!.length === 0
          ? 0
          : (tn.inputTokens!.length - 1) * CHAIN_SPACING,
        0,
        0
      ];
      const baseOpacity = isActive
        ? o.alive
          ? 0.4 + 0.5 * o.prob
          : 0.08
        : isChosen
          ? 0.55 * fadeFactor
          : 0.12 * fadeFactor;
      edges.push({
        key: `fan-edge-${tn.id}-${o.candidate.id}`,
        from: fromCenter,
        to: position,
        opacity: baseOpacity,
        width: isTop && isActive ? 2 : 1,
        color: '#7cb1ff'
      });
    });
  });

  return { chain, fans, edges, tipPosition };
}

function hashPhase(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return (h % 10000) / 10000;
}

function FloatingGroup({
  targetPosition,
  phase,
  ampX = 0.04,
  ampY = 0.06,
  ampZ = 0.04,
  speed = 0.55,
  lerpSpeed = 5,
  children
}: {
  targetPosition: [number, number, number];
  phase: number;
  ampX?: number;
  ampY?: number;
  ampZ?: number;
  speed?: number;
  lerpSpeed?: number;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const current = useRef(new THREE.Vector3(...targetPosition));
  const target = useRef(new THREE.Vector3(...targetPosition));

  target.current.set(...targetPosition);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const lerpFactor = Math.min(delta * lerpSpeed, 1);
    current.current.lerp(target.current, lerpFactor);
    const t = state.clock.getElapsedTime();
    ref.current.position.set(
      current.current.x + Math.sin(t * speed + phase * 6.28) * ampX,
      current.current.y + Math.sin(t * (speed * 0.85) + phase * 9.42) * ampY,
      current.current.z + Math.cos(t * (speed * 0.7) + phase * 5.0) * ampZ
    );
  });

  return <group ref={ref}>{children}</group>;
}

function BreathingMesh({
  radius,
  fillColor,
  emissive,
  emissiveIntensity,
  opacity,
  phase,
  amplitude = 0.025,
  speed = 1.1
}: {
  radius: number;
  fillColor: string;
  emissive: string;
  emissiveIntensity: number;
  opacity: number;
  phase: number;
  amplitude?: number;
  speed?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const s = 1 + Math.sin(t * speed + phase * 6.28) * amplitude;
    ref.current.scale.set(s, s, s);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshStandardMaterial
        color={fillColor}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        roughness={0.35}
        metalness={0.1}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}

function FloorGrid({ length }: { length: number }) {
  const positions = useMemo(() => {
    const verts: number[] = [];
    const span = Math.max(length * CHAIN_SPACING, 8);
    const half = span / 2;
    const step = 0.5;
    for (let x = -2; x <= span + 2; x += step) {
      verts.push(x, -1.6, -half, x, -1.6, half);
    }
    for (let z = -half; z <= half; z += step) {
      verts.push(-2, -1.6, z, span + 2, -1.6, z);
    }
    return new Float32Array(verts);
  }, [length]);

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#1e3a8a" transparent opacity={0.15} />
    </lineSegments>
  );
}

function PulsingTopBubble({
  position,
  radius,
  fillColor,
  emissive
}: {
  position: [number, number, number];
  radius: number;
  fillColor: string;
  emissive: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const pulse = 1 + Math.sin(t * 2.2) * 0.04;
    ref.current.scale.set(pulse, pulse, pulse);
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[radius, 48, 48]} />
      <meshStandardMaterial
        color={fillColor}
        emissive={emissive}
        emissiveIntensity={1.8}
        roughness={0.2}
        metalness={0.15}
        transparent
        opacity={0.95}
      />
    </mesh>
  );
}

function Scene() {
  const tipNodeId = useStore((s) => s.tipNodeId);
  const nodes = useStore((s) => s.nodes);
  const sampling = useStore((s) => s.sampling);
  const expand = useStore((s) => s.expand);
  const setHover = useStore((s) => s.setHover);

  const sceneData = useMemo(
    () => buildScene(tipNodeId, nodes, sampling),
    [tipNodeId, nodes, sampling]
  );

  if (!sceneData) return null;
  const { chain, fans, edges, tipPosition } = sceneData;

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[tipPosition[0], 3, 4]} intensity={1.2} color="#a5c8ff" distance={20} decay={1.5} />
      <pointLight position={[tipPosition[0] - 4, -2, 3]} intensity={0.5} color="#5b9dff" distance={15} decay={2} />
      <pointLight position={[tipPosition[0] + 4, 2, -3]} intensity={0.3} color="#7c3aed" distance={12} decay={2} />

      <FloorGrid length={chain.length} />
      <Stars radius={50} depth={30} count={1500} factor={2} fade speed={0.5} />

      {edges.map((e) => (
        <Line
          key={e.key}
          points={[e.from, e.to]}
          color={e.color}
          opacity={e.opacity}
          transparent
          lineWidth={e.width}
          dashed={false}
        />
      ))}

      {chain.map((b) => {
        const phase = hashPhase(b.key);
        return (
          <FloatingGroup
            key={b.key}
            targetPosition={b.position}
            phase={phase}
            ampX={0.06 * b.decay}
            ampY={0.1 * b.decay}
            ampZ={0.06 * b.decay}
            speed={0.42}
          >
            <BreathingMesh
              radius={b.radius}
              fillColor="#1e293b"
              emissive="#3b82f6"
              emissiveIntensity={0.15 + 0.4 * b.decay}
              opacity={0.55 + 0.4 * b.decay}
              phase={phase}
              amplitude={0.018 * b.decay}
              speed={0.85}
            />
            <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
              <div
                style={{
                  color: '#cbd5e1',
                  opacity: 0.45 + 0.55 * b.decay,
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: `${Math.max(11, 9 + 6 * b.decay)}px`,
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  textShadow: '0 1px 4px rgba(0,0,0,0.6)'
                }}
              >
                {renderToken(b.text)}
              </div>
            </Html>
          </FloatingGroup>
        );
      })}

      {fans.map((f) => {
        const fillOpacity = f.isActive
          ? f.alive
            ? f.isTop
              ? 0.95
              : 0.45 + 0.5 * f.prob
            : 0.1
          : f.isChosen
            ? 0.7
            : 0.18;
        const emissiveBoost = f.isActive
          ? f.isTop
            ? 1.6
            : 0.6 + 0.7 * f.prob
          : f.isChosen
            ? 0.7
            : 0.15;
        const phase = hashPhase(f.key);
        const ampScale = f.isActive ? (f.isTop ? 0.5 : 1) : 0.5;
        return (
          <FloatingGroup
            key={f.key}
            targetPosition={f.position}
            phase={phase}
            ampX={0.18 * ampScale}
            ampY={0.22 * ampScale}
            ampZ={0.16 * ampScale}
            speed={0.6 + (phase - 0.5) * 0.25}
          >
            <group
              onPointerOver={(e) => {
                e.stopPropagation();
                setHover(f.treeNodeId, f.candidateIndex);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHover(null, null);
                document.body.style.cursor = '';
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (f.isActive) expand(f.treeNodeId, f.candidate);
              }}
            >
              {f.isTop && f.isActive && (
                <>
                  <mesh>
                    <sphereGeometry args={[f.radius * 1.55, 32, 32]} />
                    <meshBasicMaterial color="#7cb1ff" transparent opacity={0.08} />
                  </mesh>
                  <mesh>
                    <sphereGeometry args={[f.radius * 1.25, 32, 32]} />
                    <meshBasicMaterial color="#a5c8ff" transparent opacity={0.14} />
                  </mesh>
                  <PulsingTopBubble
                    position={[0, 0, 0]}
                    radius={f.radius}
                    fillColor="#5b9dff"
                    emissive="#a5c8ff"
                  />
                </>
              )}
              {!(f.isTop && f.isActive) && (
                <BreathingMesh
                  radius={f.radius}
                  fillColor="#5b9dff"
                  emissive="#7cb1ff"
                  emissiveIntensity={emissiveBoost}
                  opacity={fillOpacity}
                  phase={phase}
                  amplitude={0.03 * ampScale}
                  speed={0.95 + phase * 0.4}
                />
              )}
              <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
                <div
                  style={{
                    color: f.alive || f.isChosen ? '#ffffff' : '#475569',
                    opacity: f.isActive ? (f.alive ? 1 : 0.5) : f.isChosen ? 0.85 : 0.5,
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: f.isTop && f.isActive ? '14px' : '11px',
                    fontWeight: f.isTop && f.isActive ? 600 : 400,
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    textShadow: '0 1px 4px rgba(0,0,0,0.7)'
                  }}
                >
                  {renderToken(f.candidate.text)}
                </div>
              </Html>
            </group>
          </FloatingGroup>
        );
      })}
    </>
  );
}

export function MeshCanvas() {
  const tipNode = useStore((s) => s.nodes[s.tipNodeId]);
  const isThinking =
    !!tipNode && (tipNode.status === 'loading' || !tipNode.candidates);
  const hasAnyData = !!tipNode?.candidates && !!tipNode?.inputTokens;

  if (!tipNode) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  if (tipNode.status === 'error') {
    return (
      <div className="flex h-full items-center justify-center text-red-400">
        Inference error: {tipNode.error}
      </div>
    );
  }

  // First-load state: nothing to render yet.
  if (!hasAnyData && tipNode.prompt === '') {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Type a prompt below to see the mesh.
      </div>
    );
  }

  if (!hasAnyData) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Computing distribution...
      </div>
    );
  }

  const tokensLength = tipNode.inputTokens?.length ?? 0;
  const totalSpan = tokensLength * CHAIN_SPACING + FAN_RADIUS * 2;
  const cameraTarget: [number, number, number] = [
    Math.max((tokensLength * CHAIN_SPACING + FAN_RADIUS) / 2, 1.5),
    0.1,
    0
  ];
  const fov = 42;
  const fitDistance = totalSpan / (2 * Math.tan((fov * Math.PI) / 360)) + 1.5;
  const cameraDistance = Math.max(fitDistance, 5);

  return (
    <div
      className="relative h-full w-full"
      style={{
        background:
          'radial-gradient(ellipse at 60% 50%, #0b1438 0%, #060a1c 55%, #02030a 100%)'
      }}
    >
      <Canvas
        camera={{
          position: [cameraTarget[0] - 0.5, 1.8, cameraDistance],
          fov
        }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
        <OrbitControls
          target={cameraTarget}
          enableDamping
          dampingFactor={0.08}
          minDistance={3}
          maxDistance={25}
          maxPolarAngle={Math.PI * 0.7}
        />
      </Canvas>
      {isThinking && (
        <div
          className="pointer-events-none absolute right-4 top-4 flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 backdrop-blur-sm"
          style={{ animation: 'pulse 1.4s ease-in-out infinite' }}
        >
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-300" />
          <span className="text-[10px] uppercase tracking-wider text-blue-200/80">
            thinking
          </span>
        </div>
      )}
    </div>
  );
}
