import { useStore } from '../store';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (next: number) => void;
}

function Slider({ label, value, min, max, step, display, onChange }: SliderProps) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
        <span className="uppercase tracking-wide">{label}</span>
        <span className="font-mono text-slate-200">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-cyan-400"
      />
    </label>
  );
}

export function EmbeddingsControls() {
  const spread = useStore((s) => s.embeddingSpread);
  const textSize = useStore((s) => s.embeddingTextSize);
  const setSpread = useStore((s) => s.setEmbeddingSpread);
  const setTextSize = useStore((s) => s.setEmbeddingTextSize);
  const realEmbeddings = useStore((s) => s.realEmbeddings);
  const realEmbeddingProgress = useStore((s) => s.realEmbeddingProgress);
  const setRealEmbeddings = useStore((s) => s.setRealEmbeddings);
  const setRealEmbeddingProgress = useStore((s) => s.setRealEmbeddingProgress);

  const isLoading = realEmbeddingProgress !== null && realEmbeddingProgress.ratio < 1;

  const loadReal = async () => {
    setRealEmbeddingProgress({ step: 'starting', ratio: 0.01 });
    try {
      const { computeRealEmbeddings } = await import('../embeddings/realEmbeddings');
      const points = await computeRealEmbeddings((step, ratio) => {
        setRealEmbeddingProgress({ step, ratio });
      });
      setRealEmbeddings(points);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRealEmbeddingProgress({ step: `error: ${message}`, ratio: 0 });
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/60 p-3">
      <div className="rounded border border-cyan-400/20 bg-cyan-500/5 p-2 text-[10px] text-cyan-200/80">
        {realEmbeddings ? (
          <span>
            <span className="font-semibold text-cyan-300">real</span> — embeddings from{' '}
            <code>all-MiniLM-L6-v2</code>, projected to 3D via PCA in your browser.
          </span>
        ) : (
          <span>
            <span className="font-semibold text-amber-300">synthetic</span> — hand-curated cluster centers.
            Click below to compute real model embeddings.
          </span>
        )}
      </div>

      {!realEmbeddings && (
        <button
          onClick={loadReal}
          disabled={isLoading}
          className="w-full rounded border border-cyan-400/40 bg-cyan-500/15 px-3 py-2 text-[11px] uppercase tracking-wider text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-60"
        >
          {isLoading
            ? `${realEmbeddingProgress?.step ?? '…'} (${Math.round((realEmbeddingProgress?.ratio ?? 0) * 100)}%)`
            : 'load real embeddings (~80 MB)'}
        </button>
      )}

      {realEmbeddings && (
        <button
          onClick={() => {
            setRealEmbeddings(null);
            setRealEmbeddingProgress(null);
          }}
          className="w-full rounded border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 hover:bg-slate-700/60"
        >
          back to synthetic
        </button>
      )}

      <Slider
        label="Spread"
        value={spread}
        min={0.4}
        max={4.0}
        step={0.05}
        display={`${spread.toFixed(2)}×`}
        onChange={setSpread}
      />
      <Slider
        label="Text size"
        value={textSize}
        min={1.5}
        max={8.0}
        step={0.1}
        display={textSize.toFixed(1)}
        onChange={setTextSize}
      />
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => {
            setSpread(1);
            setTextSize(3.5);
          }}
          className="flex-1 rounded border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-wider text-cyan-200/80 hover:bg-cyan-500/20"
        >
          reset
        </button>
        <button
          onClick={() => {
            setSpread(2.5);
            setTextSize(5);
          }}
          className="flex-1 rounded border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-wider text-cyan-200/80 hover:bg-cyan-500/20"
        >
          spread out
        </button>
      </div>
    </div>
  );
}
