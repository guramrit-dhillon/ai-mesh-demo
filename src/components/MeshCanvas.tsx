import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { score } from '../sampling';
import { renderToken } from '../tokens';
import type { CandidateToken, InputToken } from '../types';

const MIN_R = 6;
const MAX_R = 28;
const TOP_HALO_R = 36;
const CHAIN_SPACING = 110;
const FAN_VERTICAL_SPACING = 50;
const FAN_GAP = 110;
const VISIBLE_FAN = 12;
const PADDING_LEFT = 60;

interface ChainBubble {
  key: string;
  text: string;
  x: number;
  y: number;
  r: number;
  decay: number;
}

interface FanBubble {
  key: string;
  candidateIndex: number;
  candidate: CandidateToken;
  prob: number;
  alive: boolean;
  rank: number;
  x: number;
  y: number;
  r: number;
}

function decayFor(distance: number): number {
  return Math.pow(0.78, distance);
}

function buildChain(inputTokens: InputToken[], centerY: number): ChainBubble[] {
  return inputTokens.map((tok, i) => {
    const distance = inputTokens.length - 1 - i;
    const decay = decayFor(distance);
    const r = MIN_R + (MAX_R - MIN_R) * decay;
    return {
      key: `chain-${i}`,
      text: tok.text,
      x: PADDING_LEFT + i * CHAIN_SPACING,
      y: centerY,
      r,
      decay
    };
  });
}

function buildFan(
  candidates: CandidateToken[],
  sampling: ReturnType<typeof useStore.getState>['sampling'],
  tipX: number,
  centerY: number
): FanBubble[] {
  const visible = Math.min(candidates.length, VISIBLE_FAN);
  const scored = score(
    candidates.map((c) => c.logit),
    sampling
  );
  const ordered = scored
    .map((s, i) => ({ ...s, candidate: candidates[i], originalIndex: i }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, visible);

  const rankZero = ordered.find((o) => o.rank === 0);
  const others = ordered.filter((o) => o.rank !== 0);

  const fan: FanBubble[] = [];

  if (rankZero) {
    const r = TOP_HALO_R;
    fan.push({
      key: `fan-${rankZero.originalIndex}`,
      candidateIndex: rankZero.originalIndex,
      candidate: rankZero.candidate,
      prob: rankZero.prob,
      alive: rankZero.alive,
      rank: rankZero.rank,
      x: tipX + FAN_GAP,
      y: centerY,
      r
    });
  }

  const halfCount = others.length;
  const startY = centerY - ((halfCount - 1) * FAN_VERTICAL_SPACING) / 2 - FAN_VERTICAL_SPACING * 0.6;
  others.forEach((o, idx) => {
    const r = MIN_R + (MAX_R - MIN_R) * Math.sqrt(o.prob);
    const isAbove = idx < halfCount / 2;
    const offsetIdx = isAbove ? idx : idx + 1;
    const y = startY + offsetIdx * FAN_VERTICAL_SPACING;
    const x = tipX + FAN_GAP + (isAbove ? -20 : 20);
    fan.push({
      key: `fan-${o.originalIndex}`,
      candidateIndex: o.originalIndex,
      candidate: o.candidate,
      prob: o.prob,
      alive: o.alive,
      rank: o.rank,
      x,
      y,
      r
    });
  });

  return fan;
}

export function MeshCanvas() {
  const tipNodeId = useStore((s) => s.tipNodeId);
  const tipNode = useStore((s) => s.nodes[s.tipNodeId]);
  const sampling = useStore((s) => s.sampling);
  const expand = useStore((s) => s.expand);
  const setHover = useStore((s) => s.setHover);

  const containerRef = useRef<HTMLDivElement>(null);
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

  if (!tipNode || tipNode.status === 'loading' || !tipNode.inputTokens || !tipNode.candidates) {
    if (tipNode?.status === 'error') {
      return (
        <div className="flex h-full items-center justify-center text-red-400">
          Inference error: {tipNode.error}
        </div>
      );
    }
    if (tipNode && tipNode.status === 'loading' && tipNode.prompt === '') {
      return (
        <div className="flex h-full items-center justify-center text-slate-500">
          Type a prompt below to see the mesh.
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Computing distribution...
      </div>
    );
  }

  const centerY = Math.max(size.height / 2, 240);
  const chain = buildChain(tipNode.inputTokens, centerY);
  const tip = chain[chain.length - 1];
  const tipX = tip ? tip.x : PADDING_LEFT;
  const fan = buildFan(tipNode.candidates, sampling, tipX, centerY);

  const svgWidth = Math.max(size.width, tipX + FAN_GAP + 120);
  const svgHeight = Math.max(size.height, 520);

  return (
    <div ref={containerRef} className="h-full w-full overflow-auto">
      <svg width={svgWidth} height={svgHeight} className="block">
        {chain.map((b, i) => {
          if (i === 0) return null;
          const prev = chain[i - 1];
          return (
            <line
              key={`chain-edge-${i}`}
              x1={prev.x}
              y1={prev.y}
              x2={b.x}
              y2={b.y}
              stroke="#5b9dff"
              strokeOpacity={0.15 + 0.6 * b.decay}
              strokeWidth={1 + 1.5 * b.decay}
            />
          );
        })}

        {fan.map((f) => (
          <line
            key={`fan-edge-${f.key}`}
            x1={tip ? tip.x : 0}
            y1={tip ? tip.y : centerY}
            x2={f.x}
            y2={f.y}
            stroke="#5b9dff"
            strokeOpacity={f.alive ? 0.35 + 0.45 * f.prob : 0.08}
            strokeWidth={f.rank === 0 ? 2 : 1}
          />
        ))}

        {chain.map((b) => (
          <g key={b.key}>
            <circle
              cx={b.x}
              cy={b.y}
              r={b.r}
              fill="#1e293b"
              fillOpacity={0.3 + 0.5 * b.decay}
              stroke="#5b9dff"
              strokeOpacity={0.25 + 0.65 * b.decay}
              strokeWidth={1.5}
            />
            <text
              x={b.x}
              y={b.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="ui-monospace, monospace"
              fontSize={Math.max(9, 8 + 5 * b.decay)}
              fill="#cbd5e1"
              opacity={0.4 + 0.6 * b.decay}
            >
              {renderToken(b.text)}
            </text>
          </g>
        ))}

        {fan
          .slice()
          .sort((a, b) => (a.rank === 0 ? 1 : 0) - (b.rank === 0 ? 1 : 0))
          .map((f) => {
            const isTop = f.rank === 0;
            return (
              <g
                key={f.key}
                onMouseEnter={() => setHover(tipNodeId, f.candidateIndex)}
                onMouseLeave={() => setHover(null, null)}
                onClick={() => expand(tipNodeId, f.candidate)}
                style={{ cursor: 'pointer' }}
              >
                {isTop && (
                  <circle
                    cx={f.x}
                    cy={f.y}
                    r={f.r + 8}
                    fill="none"
                    stroke="#5b9dff"
                    strokeOpacity={0.25}
                    strokeWidth={2}
                  />
                )}
                <circle
                  cx={f.x}
                  cy={f.y}
                  r={f.r}
                  fill="#5b9dff"
                  fillOpacity={f.alive ? (isTop ? 0.95 : 0.3 + 0.6 * f.prob) : 0.08}
                  stroke="#5b9dff"
                  strokeOpacity={f.alive ? 0.95 : 0.2}
                  strokeWidth={isTop ? 2 : 1}
                />
                <text
                  x={f.x}
                  y={f.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontFamily="ui-monospace, monospace"
                  fontSize={isTop ? 13 : 11}
                  fontWeight={isTop ? 600 : 400}
                  fill={f.alive ? '#fff' : '#64748b'}
                >
                  {renderToken(f.candidate.text)}
                </text>
              </g>
            );
          })}
      </svg>
    </div>
  );
}
