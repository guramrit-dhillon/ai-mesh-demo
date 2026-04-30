import { useMemo } from 'react';
import { useStore } from '../store';
import { score } from '../sampling';
import { renderToken } from '../tokens';
import type { CandidateToken, TreeNode } from '../types';

const COLUMN_WIDTH = 180;
const NODE_VERTICAL_SPACING = 40;
const MAX_BUBBLE_R = 26;
const MIN_BUBBLE_R = 6;

interface LaidOutBubble {
  nodeId: string;
  candidateIndex: number;
  candidate: CandidateToken;
  prob: number;
  alive: boolean;
  rank: number;
  x: number;
  y: number;
  r: number;
}

interface LaidOutEdge {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  alive: boolean;
}

function layout(
  nodes: Record<string, TreeNode>,
  rootId: string,
  sampling: ReturnType<typeof useStore.getState>['sampling']
): { bubbles: LaidOutBubble[]; edges: LaidOutEdge[]; width: number; height: number } {
  const bubbles: LaidOutBubble[] = [];
  const edges: LaidOutEdge[] = [];
  let maxColumn = 0;
  let maxRow = 0;

  function place(nodeId: string, depth: number, parentBubble: { x: number; y: number } | null): void {
    const node = nodes[nodeId];
    if (!node || !node.candidates) return;
    const x = depth * COLUMN_WIDTH + 80;
    const scored = score(node.candidates.map((c) => c.logit), sampling);
    const visibleCount = Math.min(node.candidates.length, 12);
    const startY = -(visibleCount - 1) * NODE_VERTICAL_SPACING / 2;
    for (let i = 0; i < visibleCount; i++) {
      const candidate: CandidateToken = node.candidates[i];
      const s = scored[i];
      const y = startY + i * NODE_VERTICAL_SPACING + 200 + depth * 0;
      const r = MIN_BUBBLE_R + (MAX_BUBBLE_R - MIN_BUBBLE_R) * Math.sqrt(s.prob);
      bubbles.push({
        nodeId,
        candidateIndex: i,
        candidate,
        prob: s.prob,
        alive: s.alive,
        rank: s.rank,
        x,
        y,
        r
      });
      if (parentBubble) {
        edges.push({
          fromX: parentBubble.x,
          fromY: parentBubble.y,
          toX: x,
          toY: y,
          alive: s.alive
        });
      }
      maxColumn = Math.max(maxColumn, x + r + 20);
      maxRow = Math.max(maxRow, y + r + 20);

      const childId = `${nodeId}/${candidate.id}`;
      if (nodes[childId]) {
        place(childId, depth + 1, { x, y });
      }
    }
  }

  place(rootId, 0, null);
  return { bubbles, edges, width: Math.max(maxColumn, 600), height: Math.max(maxRow + 100, 500) };
}

export function MeshCanvas() {
  const nodes = useStore((s) => s.nodes);
  const rootId = useStore((s) => s.rootNodeId);
  const sampling = useStore((s) => s.sampling);
  const expand = useStore((s) => s.expand);
  const setHover = useStore((s) => s.setHover);

  const rootNode = nodes[rootId];

  const { bubbles, edges, width, height } = useMemo(
    () => layout(nodes, rootId, sampling),
    [nodes, rootId, sampling]
  );

  if (!rootNode || rootNode.status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Computing distribution...
      </div>
    );
  }

  if (rootNode.status === 'error') {
    return (
      <div className="flex h-full items-center justify-center text-red-400">
        Inference error: {rootNode.error}
      </div>
    );
  }

  if (!rootNode.candidates || rootNode.candidates.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Type a prompt below to see the mesh.
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto">
      <svg width={width} height={height} className="block">
        {edges.map((e, i) => (
          <line
            key={i}
            x1={e.fromX}
            y1={e.fromY}
            x2={e.toX}
            y2={e.toY}
            stroke="#5b9dff"
            strokeOpacity={e.alive ? 0.4 : 0.1}
          />
        ))}
        {bubbles.map((b) => (
          <g
            key={`${b.nodeId}-${b.candidateIndex}`}
            onMouseEnter={() => setHover(b.nodeId, b.candidateIndex)}
            onMouseLeave={() => setHover(null, null)}
            onClick={() => expand(b.nodeId, b.candidate)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={b.x}
              cy={b.y}
              r={b.r}
              fill="#5b9dff"
              fillOpacity={b.alive ? 0.3 + 0.7 * b.prob : 0.08}
              stroke="#5b9dff"
              strokeOpacity={b.alive ? 0.9 : 0.2}
            />
            <text
              x={b.x}
              y={b.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="ui-monospace, monospace"
              fontSize="11"
              fill={b.alive ? '#fff' : '#64748b'}
            >
              {renderToken(b.candidate.text)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
