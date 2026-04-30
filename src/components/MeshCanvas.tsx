import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useStore } from '../store';
import { score } from '../sampling';
import { renderToken } from '../tokens';
import type { CandidateToken, TreeNode } from '../types';

interface GraphNode {
  id: string;
  treeNodeId: string;
  candidateIndex: number;
  candidate: CandidateToken;
  prob: number;
  alive: boolean;
  rank: number;
  isRoot: boolean;
}

interface GraphLink {
  source: string;
  target: string;
  alive: boolean;
}

const MIN_R = 6;
const MAX_R = 26;
const VISIBLE_PER_NODE = 12;

function buildGraph(
  nodes: Record<string, TreeNode>,
  rootId: string,
  sampling: ReturnType<typeof useStore.getState>['sampling']
): { nodes: GraphNode[]; links: GraphLink[] } {
  const gNodes: GraphNode[] = [];
  const gLinks: GraphLink[] = [];

  function visit(treeNodeId: string, parentCandidateId: string | null, depth: number): void {
    const tn = nodes[treeNodeId];
    if (!tn || !tn.candidates) return;

    const visibleCount = Math.min(tn.candidates.length, VISIBLE_PER_NODE);
    const scored = score(
      tn.candidates.map((c) => c.logit),
      sampling
    );

    for (let i = 0; i < visibleCount; i++) {
      const cand: CandidateToken = tn.candidates[i];
      const s = scored[i];
      const gid = `${treeNodeId}#${i}`;
      gNodes.push({
        id: gid,
        treeNodeId,
        candidateIndex: i,
        candidate: cand,
        prob: s.prob,
        alive: s.alive,
        rank: s.rank,
        isRoot: depth === 0 && i === 0
      });

      if (parentCandidateId) {
        gLinks.push({ source: parentCandidateId, target: gid, alive: s.alive });
      }

      const childTreeNodeId = `${treeNodeId}/${cand.id}`;
      if (nodes[childTreeNodeId]) {
        visit(childTreeNodeId, gid, depth + 1);
      }
    }
  }

  visit(rootId, null, 0);
  return { nodes: gNodes, links: gLinks };
}

export function MeshCanvas() {
  const nodes = useStore((s) => s.nodes);
  const rootId = useStore((s) => s.rootNodeId);
  const sampling = useStore((s) => s.sampling);
  const expand = useStore((s) => s.expand);
  const setHover = useStore((s) => s.setHover);

  const rootNode = nodes[rootId];

  const graphData = useMemo(
    () => buildGraph(nodes, rootId, sampling),
    [nodes, rootId, sampling]
  );

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
    <div ref={containerRef} className="h-full w-full">
      <ForceGraph2D
        width={size.width}
        height={size.height}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        cooldownTicks={120}
        d3VelocityDecay={0.35}
        linkColor={(l: { alive?: boolean }) =>
          l.alive ? 'rgba(91,157,255,0.5)' : 'rgba(91,157,255,0.1)'
        }
        linkWidth={1}
        nodeRelSize={1}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const n = node as unknown as GraphNode & { x?: number; y?: number };
          if (n.x === undefined || n.y === undefined) return;
          const r = MIN_R + (MAX_R - MIN_R) * Math.sqrt(n.prob);
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = n.alive
            ? `rgba(91,157,255,${0.3 + 0.7 * n.prob})`
            : 'rgba(91,157,255,0.08)';
          ctx.fill();
          ctx.strokeStyle = n.alive ? 'rgba(91,157,255,0.9)' : 'rgba(91,157,255,0.25)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = n.alive ? '#fff' : '#64748b';
          ctx.font = `${11 / globalScale}px ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(renderToken(n.candidate.text), n.x, n.y);
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          const n = node as unknown as GraphNode & { x?: number; y?: number };
          if (n.x === undefined || n.y === undefined) return;
          const r = MIN_R + (MAX_R - MIN_R) * Math.sqrt(n.prob);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
          ctx.fill();
        }}
        onNodeClick={(node) => {
          const n = node as unknown as GraphNode;
          expand(n.treeNodeId, n.candidate);
        }}
        onNodeHover={(node) => {
          if (!node) {
            setHover(null, null);
            return;
          }
          const n = node as unknown as GraphNode;
          setHover(n.treeNodeId, n.candidateIndex);
        }}
      />
    </div>
  );
}
