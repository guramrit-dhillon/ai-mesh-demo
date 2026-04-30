import { useStore } from '../store';
import { score } from '../sampling';
import { renderToken } from '../tokens';

export function MathPanel() {
  const node = useStore((s) =>
    s.hoveredNodeId ? s.nodes[s.hoveredNodeId] ?? null : null
  );
  const candidateIndex = useStore((s) => s.hoveredCandidateIndex);
  const sampling = useStore((s) => s.sampling);

  if (!node || node.candidates === null || candidateIndex === null) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-500">
        Hover a bubble to see its logit, softmax probability, and rank.
      </div>
    );
  }

  const logits = node.candidates.map((c) => c.logit);
  const scored = score(logits, sampling);
  const target = scored[candidateIndex];
  const candidate = node.candidates[candidateIndex];

  return (
    <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-300">
      <div className="text-sm font-mono text-slate-100">{renderToken(candidate.text)}</div>
      <div className="flex justify-between">
        <span>Raw logit</span>
        <span className="font-mono">{candidate.logit.toFixed(3)}</span>
      </div>
      <div className="flex justify-between">
        <span>Softmax prob (T={sampling.temperature.toFixed(2)})</span>
        <span className="font-mono">{(target.prob * 100).toFixed(2)}%</span>
      </div>
      <div className="flex justify-between">
        <span>Rank</span>
        <span className="font-mono">#{target.rank + 1} of {node.candidates.length}</span>
      </div>
      <div className="flex justify-between">
        <span>Status</span>
        <span className={target.alive ? 'text-emerald-400' : 'text-slate-500'}>
          {target.alive ? 'kept by top-k/top-p' : 'cut by sampling'}
        </span>
      </div>
    </div>
  );
}
