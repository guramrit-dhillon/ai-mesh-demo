import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
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
      key: `chain-${i}`,
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
        position = [fanCenterX + FAN_RADIUS * 0.7, 0, 0];
      } else if (!isActive && isChosen) {
        position = [fanPositionIndex * CHAIN_SPACING, 0, 0];
      } else {
        const angleStep = (2 * Math.PI) / Math.max(visible - (isActive ? 1 : 0), 1);
        const angleIdx = isActive ? i - 1 : i;
        const angle = angleIdx * angleStep + (isActive ? 0 : Math.PI / 6);
        const r = isActive ? FAN_RADIUS : FAN_RADIUS * 0.7;
        position = [fanCenterX, Math.cos(angle) * r, Math.sin(angle) * r];
      }

      const radius = isTop && isActive
        ? TOP_HALO_R
        : MIN_R + (MAX_R - MIN_R) * Math.sqrt(o.prob) * fadeFactor;

      fans.push({
        key: `fan-${tn.id}-${o.originalIndex}`,
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
        key: `fan-edge-${tn.id}-${o.originalIndex}`,
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

interface BubbleVizProps {
  position: [number, number, number];
  radius: number;
  fillColor: string;
  emissive: string;
  emissiveIntensity: number;
  opacity: number;
}

function Bubble({ position, radius, fillColor, emissive, emissiveIntensity, opacity }: BubbleVizProps) {
  return (
    <mesh position={position}>
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
      <ambientLight intensity={0.45} />
      <pointLight position={[tipPosition[0], 3, 4]} intensity={0.9} color="#a5c8ff" />
      <pointLight position={[tipPosition[0] - 4, -2, 2]} intensity={0.4} color="#5b9dff" />

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

      {chain.map((b) => (
        <group key={b.key} position={b.position}>
          <Bubble
            position={[0, 0, 0]}
            radius={b.radius}
            fillColor="#1e293b"
            emissive="#3b82f6"
            emissiveIntensity={0.15 + 0.4 * b.decay}
            opacity={0.55 + 0.4 * b.decay}
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
        </group>
      ))}

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
        return (
          <group
            key={f.key}
            position={f.position}
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
              <mesh>
                <sphereGeometry args={[f.radius * 1.35, 32, 32]} />
                <meshBasicMaterial color="#5b9dff" transparent opacity={0.12} />
              </mesh>
            )}
            <Bubble
              position={[0, 0, 0]}
              radius={f.radius}
              fillColor="#5b9dff"
              emissive="#7cb1ff"
              emissiveIntensity={emissiveBoost}
              opacity={fillOpacity}
            />
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
        );
      })}
    </>
  );
}

export function MeshCanvas() {
  const tipNode = useStore((s) => s.nodes[s.tipNodeId]);

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

  if (tipNode.status === 'loading' && tipNode.prompt === '') {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Type a prompt below to see the mesh.
      </div>
    );
  }

  if (tipNode.status === 'loading' || !tipNode.candidates) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Computing distribution...
      </div>
    );
  }

  const tokensLength = tipNode.inputTokens?.length ?? 0;
  const cameraTarget: [number, number, number] = [
    tokensLength * CHAIN_SPACING * 0.55,
    0,
    0
  ];

  return (
    <div className="h-full w-full" style={{ background: 'radial-gradient(ellipse at center, #0b1224 0%, #050810 80%)' }}>
      <Canvas camera={{ position: [cameraTarget[0], 2.5, 7], fov: 45 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
        <OrbitControls
          target={cameraTarget}
          enableDamping
          dampingFactor={0.08}
          minDistance={3}
          maxDistance={25}
        />
      </Canvas>
    </div>
  );
}
