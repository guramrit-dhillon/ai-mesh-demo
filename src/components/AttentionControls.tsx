import { useState } from 'react';
import { useStore } from '../store';
import { renderToken } from '../tokens';

export function AttentionControls() {
  const result = useStore((s) => s.attentionResult);
  const progress = useStore((s) => s.attentionProgress);
  const setResult = useStore((s) => s.setAttentionResult);
  const setProgress = useStore((s) => s.setAttentionProgress);
  const tipPrompt = useStore((s) => s.nodes[s.tipNodeId]?.prompt ?? s.prompt);
  const [activeTargetId, setActiveTargetId] = useState<number | null>(null);

  const isLoading = progress !== null && progress.ratio < 1;

  // Recompute lets the user re-target attribution at any of the top-5
  // alternative predictions without re-typing the prompt.
  const compute = async (targetId?: number) => {
    if (!tipPrompt.trim()) {
      setProgress({ step: 'enter a prompt first', ratio: 0 });
      return;
    }
    setProgress({ step: 'starting', ratio: 0.01 });
    setActiveTargetId(targetId ?? null);
    let succeeded = false;
    try {
      const { computeAttention } = await import('../attention/computeAttention');
      const r = await computeAttention(
        tipPrompt,
        (step, ratio) => setProgress({ step, ratio }),
        targetId !== undefined ? { targetId } : {}
      );
      setResult(r);
      succeeded = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setProgress({ step: `error: ${message}`, ratio: 0 });
    } finally {
      if (succeeded) setProgress(null);
    }
  };

  return (
    <div className="mesh-panel space-y-4 rounded-lg p-4">
      <div className="rounded border border-mesh-accent/20 bg-mesh-accent/5 p-2 text-[10px] text-mesh-dim">
        <span className="font-semibold text-mesh-accent">attention</span> via input ablation —
        each input token is removed in turn and the prediction shift is measured.
        Larger bar = the model relied on it more.
      </div>

      <button onClick={() => compute()} disabled={isLoading} className="mesh-btn w-full">
        {isLoading
          ? `${progress?.step ?? '…'} (${Math.round((progress?.ratio ?? 0) * 100)}%)`
          : result
            ? 'recompute attention'
            : 'compute attention'}
      </button>

      {result && (
        <>
          <div className="mesh-divider" />

          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mesh-accent">
            target token
          </div>
          <div className="rounded border border-mesh-edge/70 bg-mesh-panel/40 p-2 text-[10px] text-mesh-dim">
            Right now we're asking: which input tokens push the model toward
            <span className="ml-1 font-mono text-mesh-warm">{renderToken(result.baselineTopText)}</span>?
            Try a different target:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {result.topCandidates.map((c) => {
              const isActive =
                (activeTargetId === null && c.text === result.baselineTopText) ||
                activeTargetId === c.id;
              return (
                <button
                  key={c.id}
                  disabled={isLoading || isActive}
                  onClick={() => compute(c.id)}
                  className={`flex items-center gap-2 rounded border px-2 py-1 font-mono text-[10px] transition ${
                    isActive
                      ? 'border-mesh-warm/50 bg-mesh-warm/10 text-mesh-warm'
                      : 'border-mesh-edge/70 bg-mesh-panel/40 text-mesh-dim hover:border-mesh-accent/50 hover:text-mesh-fg disabled:opacity-50'
                  }`}
                >
                  <span>{renderToken(c.text)}</span>
                  <span className="text-mesh-mute">{Math.round(c.prob * 100)}%</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              setResult(null);
              setProgress(null);
              setActiveTargetId(null);
            }}
            className="mesh-btn mesh-btn-ghost w-full"
          >
            clear
          </button>
        </>
      )}

      <div className="text-[10px] leading-relaxed text-mesh-mute">
        Caveat: this isn't the model's internal self-attention — those weights
        aren't exposed by the public ONNX. It's an input-attribution proxy
        that uses the next-token logits we already have.
      </div>
    </div>
  );
}
