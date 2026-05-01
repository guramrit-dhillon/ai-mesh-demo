import { useStore, type VizMode } from '../store';

const MODES: { id: VizMode; label: string; available: boolean }[] = [
  { id: 'predictions', label: 'predictions', available: true },
  { id: 'embeddings', label: 'embeddings', available: true },
  { id: 'attention', label: 'attention', available: false },
  { id: 'logit-lens', label: 'logit lens', available: false }
];

export function ModeSwitcher() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  return (
    <div className="absolute right-4 bottom-4 flex items-center gap-1 rounded-full border border-cyan-400/20 bg-slate-950/60 p-1 backdrop-blur-sm">
      {MODES.map((m) => {
        const active = m.id === mode;
        return (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            disabled={!m.available && active === false ? false : false}
            className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-wider transition ${
              active
                ? 'bg-cyan-500/30 text-cyan-100'
                : m.available
                  ? 'text-cyan-200/60 hover:bg-cyan-500/10'
                  : 'text-slate-500/60 hover:bg-slate-700/30'
            }`}
          >
            {m.label}
            {!m.available && <span className="ml-1 text-[8px] opacity-60">·soon</span>}
          </button>
        );
      })}
    </div>
  );
}
