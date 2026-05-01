import { useStore } from '../store';

export function LogitLensControls() {
  const result = useStore((s) => s.logitLensResult);
  const progress = useStore((s) => s.logitLensProgress);
  const setResult = useStore((s) => s.setLogitLensResult);
  const setProgress = useStore((s) => s.setLogitLensProgress);
  const tipPrompt = useStore((s) => s.nodes[s.tipNodeId]?.prompt ?? s.prompt);

  const isLoading = progress !== null && progress.ratio < 1;

  const compute = async () => {
    if (!tipPrompt.trim()) {
      setProgress({ step: 'enter a prompt first', ratio: 0 });
      return;
    }
    setProgress({ step: 'starting', ratio: 0.01 });
    let succeeded = false;
    try {
      const { computeLogitLens } = await import('../logitLens/computeLogitLens');
      const r = await computeLogitLens(tipPrompt, (step, ratio) => {
        setProgress({ step, ratio });
      });
      setResult(r);
      succeeded = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setProgress({ step: `error: ${message}`, ratio: 0 });
    } finally {
      // Clear progress on success only — failure cases keep the error string
      // around so the panel can render it. Putting this in `finally` (instead
      // of inside the try) means a throw in `setResult` itself still ends up
      // with a stable progress state instead of leaving the spinner running.
      if (succeeded) setProgress(null);
    }
  };

  // Quick stats for the panel readout when a result is loaded.
  const stats = (() => {
    if (!result) return null;
    const total = result.steps.length;
    const hits = result.steps.filter(
      (s) => s.actualNext !== null && s.topPredictions[0]?.text === s.actualNext
    ).length;
    const checked = result.steps.filter((s) => s.actualNext !== null).length;
    return { total, hits, checked };
  })();

  return (
    <div className="mesh-panel space-y-4 rounded-lg p-4">
      <div className="rounded border border-mesh-accent/20 bg-mesh-accent/5 p-2 text-[10px] text-mesh-dim">
        <span className="font-semibold text-mesh-accent">logit lens</span> — at each position in your prompt,
        the model's top-3 predictions for the next token. Green when the model
        guessed the actual next word; amber when it was surprised.
      </div>

      <button onClick={compute} disabled={isLoading} className="mesh-btn w-full">
        {isLoading
          ? `${progress?.step ?? '…'} (${Math.round((progress?.ratio ?? 0) * 100)}%)`
          : result
            ? 'recompute logit lens'
            : 'compute logit lens'}
      </button>

      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="positions" value={String(stats.total)} />
          <Stat label="hits" value={`${stats.hits}/${stats.checked}`} accent="good" />
          <Stat
            label="hit rate"
            value={stats.checked === 0 ? '—' : `${Math.round((stats.hits / stats.checked) * 100)}%`}
          />
        </div>
      )}

      {result && (
        <button
          onClick={() => {
            setResult(null);
            setProgress(null);
          }}
          className="mesh-btn mesh-btn-ghost w-full"
        >
          clear
        </button>
      )}

      <div className="text-[10px] leading-relaxed text-mesh-mute">
        Caveat: the classic "logit lens" reads the residual stream at each
        layer. The public Xenova/gpt2 ONNX doesn't expose hidden states, so
        this variant slices across <em>positions</em> instead — the same
        question ("when did the model commit?") asked along a different axis.
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'good' }) {
  return (
    <div className="rounded border border-mesh-edge/60 bg-mesh-panel/40 p-2 text-center">
      <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-mesh-mute">{label}</div>
      <div className={`mt-1 font-mono text-[14px] ${accent === 'good' ? 'text-mesh-good' : 'text-mesh-fg'}`}>
        {value}
      </div>
    </div>
  );
}
