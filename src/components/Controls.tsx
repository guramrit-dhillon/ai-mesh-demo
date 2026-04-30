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
        className="w-full accent-blue-500"
      />
    </label>
  );
}

export function Controls() {
  const sampling = useStore((s) => s.sampling);
  const setSampling = useStore((s) => s.setSampling);
  return (
    <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/60 p-3">
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
        label="Top-k"
        value={sampling.topK}
        min={1}
        max={50}
        step={1}
        display={String(sampling.topK)}
        onChange={(v) => setSampling({ topK: v })}
      />
      <Slider
        label="Top-p"
        value={sampling.topP}
        min={0.05}
        max={1.0}
        step={0.01}
        display={sampling.topP.toFixed(2)}
        onChange={(v) => setSampling({ topP: v })}
      />
    </div>
  );
}
