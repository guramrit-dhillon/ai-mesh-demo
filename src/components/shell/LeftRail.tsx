import { useStore, type VizMode } from '../../store';
import { Wordmark } from '../brand/Wordmark';
import { ModeIcon } from './ModeIcon';

const MODES: { id: VizMode; label: string; sub: string }[] = [
  { id: 'predictions', label: 'Predictions', sub: 'next-token mesh' },
  { id: 'embeddings', label: 'Embeddings', sub: 'semantic space' },
  { id: 'attention', label: 'Attention', sub: 'input attribution' },
  { id: 'logit-lens', label: 'Logit Lens', sub: 'per-prefix preds' }
];

interface Props {
  onOpenSettings: () => void;
}

export function LeftRail({ onOpenSettings }: Props) {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);

  return (
    <aside className="mesh-panel flex w-[220px] flex-col rounded-lg p-4">
      <div className="px-1">
        <Wordmark size="md" showTagline={false} />
      </div>

      <div className="mesh-divider my-5" />

      <div className="flex-1 space-y-1">
        <div className="px-2 pb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-mesh-mute">
          Lenses
        </div>
        {MODES.map((m) => {
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition ${
                active
                  ? 'bg-mesh-accent/15 text-mesh-fg'
                  : 'text-mesh-dim hover:bg-mesh-edge/30 hover:text-mesh-fg'
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-6 -translate-y-1/2 rounded-r-full bg-mesh-accent"
                  style={{ width: 3, boxShadow: '0 0 8px rgb(var(--mesh-accent))' }}
                />
              )}
              <ModeIcon
                mode={m.id}
                className={active ? 'text-mesh-accent' : 'text-mesh-mute group-hover:text-mesh-accent/80'}
              />
              <div className="flex flex-col leading-tight">
                <span className="text-[12px] font-semibold tracking-wide">{m.label}</span>
                <span className="text-[9px] uppercase tracking-[0.18em] text-mesh-mute">{m.sub}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mesh-divider my-3" />

      <button
        onClick={onOpenSettings}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-[11px] uppercase tracking-[0.18em] text-mesh-dim transition hover:bg-mesh-edge/30 hover:text-mesh-fg"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Settings
      </button>

      <div className="mt-2 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-mesh-mute">
        v0.2 · gpt-2 · int8
      </div>
    </aside>
  );
}
