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
      <div className="mesh-panel rounded-lg p-3 text-[11px] text-mesh-mute">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mesh-accent">
          inspector
        </div>
        <p className="mt-2 leading-relaxed">
          Hover a bubble to see its logit, softmax probability, and rank.
        </p>
      </div>
    );
  }

  const logits = node.candidates.map((c) => c.logit);
  const scored = score(logits, sampling);
  const target = scored[candidateIndex];
  const candidate = node.candidates[candidateIndex];

  return (
    <div className="mesh-panel space-y-2.5 rounded-lg p-4 text-[11px] text-mesh-dim">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mesh-accent">
        inspector
      </div>
      <div className="font-mono text-base text-mesh-fg">{renderToken(candidate.text)}</div>
      <Row label="Raw logit" value={candidate.logit.toFixed(3)} />
      <Row label={`Softmax prob (T=${sampling.temperature.toFixed(2)})`} value={`${(target.prob * 100).toFixed(2)}%`} />
      <Row label="Rank" value={`#${target.rank + 1} of ${node.candidates.length}`} />
      <div className="flex justify-between">
        <span className="text-mesh-mute">Status</span>
        <span className={`font-mono ${target.alive ? 'text-mesh-good' : 'text-mesh-mute'}`}>
          {target.alive ? 'kept' : 'cut'}
        </span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-mesh-mute">{label}</span>
      <span className="font-mono text-mesh-fg">{value}</span>
    </div>
  );
}
