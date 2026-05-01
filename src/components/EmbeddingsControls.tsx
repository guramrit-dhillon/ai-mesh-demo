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
      <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em]">
        <span className="text-mesh-mute">{label}</span>
        <span className="text-mesh-fg">{display}</span>
      </div>
      <input
        type="range"
        className="mesh-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Toggle({ label, on, onChange, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`group flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition ${
        on
          ? 'border-mesh-accent/50 bg-mesh-accent/10'
          : 'border-mesh-edge/60 bg-mesh-panel/40 hover:border-mesh-accent/30'
      }`}
    >
      <div className="flex flex-col">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mesh-fg">{label}</span>
        {hint && <span className="mt-0.5 text-[10px] text-mesh-mute">{hint}</span>}
      </div>
      <span className={`relative h-4 w-7 rounded-full transition ${on ? 'bg-mesh-accent' : 'bg-mesh-edge'}`}>
        <span className="absolute top-0.5 h-3 w-3 rounded-full bg-mesh-ink transition-all" style={{ left: on ? 14 : 2 }} />
      </span>
    </button>
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
  const search = useStore((s) => s.embeddingSearch);
  const setSearch = useStore((s) => s.setEmbeddingSearch);
  const twoD = useStore((s) => s.embeddingTwoD);
  const setTwoD = useStore((s) => s.setEmbeddingTwoD);
  const pickedA = useStore((s) => s.embeddingDistanceA);
  const pickedB = useStore((s) => s.embeddingDistanceB);
  const clearDistance = useStore((s) => s.clearDistance);

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
    <div className="mesh-panel space-y-4 rounded-lg p-4">
      <div className="rounded border border-mesh-accent/20 bg-mesh-accent/5 p-2 text-[10px] text-mesh-dim">
        {realEmbeddings ? (
          <span>
            <span className="font-semibold text-mesh-accent">real</span> — embeddings from{' '}
            <code className="text-mesh-fg">all-MiniLM-L6-v2</code>, projected to 3D via PCA in your browser.
          </span>
        ) : (
          <span>
            <span className="font-semibold text-mesh-warm">synthetic</span> — hand-curated cluster centers.
            Click below to compute real model embeddings.
          </span>
        )}
      </div>

      {!realEmbeddings && (
        <button onClick={loadReal} disabled={isLoading} className="mesh-btn w-full">
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
          className="mesh-btn mesh-btn-ghost w-full"
        >
          back to synthetic
        </button>
      )}

      <div className="mesh-divider" />

      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mesh-accent">
        explore
      </div>

      {/* Search input */}
      <div>
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-mesh-mute">
          Search
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="find a token…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-mesh-edge/70 bg-mesh-ink/60 px-3 py-1.5 pr-7 font-mono text-[12px] text-mesh-fg placeholder:text-mesh-mute focus:border-mesh-accent/60 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-mesh-mute hover:text-mesh-fg"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <Toggle label="2D projection" on={twoD} onChange={setTwoD} hint="Flatten the y-axis for a top-down view" />

      <div className="mesh-divider" />

      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-mesh-accent">
        <span>distance tool</span>
        {(pickedA || pickedB) && (
          <button onClick={clearDistance} className="text-[9px] text-mesh-mute hover:text-mesh-fg">
            reset
          </button>
        )}
      </div>
      <div className="rounded border border-mesh-edge/70 bg-mesh-panel/40 p-2 font-mono text-[10px] leading-relaxed text-mesh-dim">
        {!pickedA && <>Click any point to pick <span className="text-mesh-accent">A</span>.</>}
        {pickedA && !pickedB && <>Now click another point for <span style={{ color: '#a78bfa' }}>B</span>.</>}
        {pickedA && pickedB && <>Pair locked. Click any point to start over.</>}
      </div>

      <div className="mesh-divider" />

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
          className="mesh-btn mesh-btn-ghost flex-1"
        >
          reset
        </button>
        <button
          onClick={() => {
            setSpread(2.5);
            setTextSize(5);
          }}
          className="mesh-btn mesh-btn-ghost flex-1"
        >
          spread out
        </button>
      </div>
    </div>
  );
}
