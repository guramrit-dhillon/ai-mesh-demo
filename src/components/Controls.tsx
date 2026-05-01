import { useStore } from '../store';
import { useAutoplay } from '../hooks/useAutoplay';

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

interface ToggleProps {
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
  hint?: string;
}

function Toggle({ label, on, onChange, hint }: ToggleProps) {
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
      <span
        className={`relative h-4 w-7 rounded-full transition ${
          on ? 'bg-mesh-accent' : 'bg-mesh-edge'
        }`}
        style={{ boxShadow: on ? '0 0 10px rgb(var(--mesh-accent))' : 'none' }}
      >
        <span
          className="absolute top-0.5 h-3 w-3 rounded-full bg-mesh-ink transition-all"
          style={{ left: on ? 14 : 2 }}
        />
      </span>
    </button>
  );
}

export function Controls() {
  const sampling = useStore((s) => s.sampling);
  const setSampling = useStore((s) => s.setSampling);
  const autoplay = useStore((s) => s.autoplay);
  const heatmap = useStore((s) => s.heatmap);
  const setAutoplay = useStore((s) => s.setAutoplay);
  const setHeatmap = useStore((s) => s.setHeatmap);

  // Drives the autoplay timer — lives here so it only ticks while the
  // predictions panel is mounted.
  useAutoplay();

  return (
    <div className="mesh-panel space-y-4 rounded-lg p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mesh-accent">
        sampling
      </div>

      <Slider
        label="Temperature"
        value={sampling.temperature}
        min={0.1}
        max={2.0}
        step={0.05}
        display={sampling.temperature.toFixed(2)}
        onChange={(v) => setSampling({ temperature: v })}
      />
      <Slider
        label="Top-K"
        value={sampling.topK}
        min={1}
        max={50}
        step={1}
        display={String(sampling.topK)}
        onChange={(v) => setSampling({ topK: v })}
      />
      <Slider
        label="Top-P"
        value={sampling.topP}
        min={0.05}
        max={1.0}
        step={0.01}
        display={sampling.topP.toFixed(2)}
        onChange={(v) => setSampling({ topP: v })}
      />

      <div className="mesh-divider" />

      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mesh-accent">
        view
      </div>

      <div className="space-y-2">
        <Toggle
          label="Autoplay"
          on={autoplay}
          onChange={setAutoplay}
          hint="Walks the top-1 chain forward"
        />
        <Toggle
          label="Heatmap"
          on={heatmap}
          onChange={setHeatmap}
          hint="Color tokens by probability"
        />
      </div>

      {autoplay && (
        <div className="rounded border border-mesh-accent/30 bg-mesh-accent/5 p-2 text-[10px] text-mesh-dim">
          <span className="text-mesh-accent">▶</span> generating top-1 every ~0.9s. Toggle off to stop.
        </div>
      )}
    </div>
  );
}
