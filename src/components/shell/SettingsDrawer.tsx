import { useEffect } from 'react';
import { useStore } from '../../store';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ACCENTS: { id: 'cyan' | 'violet' | 'emerald' | 'amber'; label: string; preview: string }[] = [
  { id: 'cyan', label: 'Cyan', preview: 'rgb(124, 228, 255)' },
  { id: 'violet', label: 'Violet', preview: 'rgb(167, 139, 250)' },
  { id: 'emerald', label: 'Emerald', preview: 'rgb(110, 231, 183)' },
  { id: 'amber', label: 'Amber', preview: 'rgb(251, 191, 36)' }
];

const STORAGE_KEY = 'mesh-settings-v1';

interface PersistedSettings {
  accent?: 'cyan' | 'violet' | 'emerald' | 'amber';
  perfMode?: 'high' | 'low';
}

export function SettingsDrawer({ open, onClose }: Props) {
  const accent = useStore((s) => s.accent);
  const perfMode = useStore((s) => s.perfMode);
  const setAccent = useStore((s) => s.setAccent);
  const setPerfMode = useStore((s) => s.setPerfMode);

  // Restore from localStorage on first mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedSettings;
      if (parsed.accent) setAccent(parsed.accent);
      if (parsed.perfMode) setPerfMode(parsed.perfMode);
    } catch { /* ignore corrupted entries */ }
  }, [setAccent, setPerfMode]);

  // Reflect current settings on the document root so :root[data-accent=…]
  // selectors in index.css take effect, and persist to localStorage.
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
    document.documentElement.setAttribute('data-perf', perfMode);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ accent, perfMode }));
    } catch { /* */ }
  }, [accent, perfMode]);

  // ESC closes the drawer.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-mesh-ink/60 backdrop-blur-sm transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={`mesh-panel fixed right-0 top-0 z-50 flex h-full w-[360px] flex-col gap-5 rounded-none border-l border-y-0 p-6 transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="font-display text-base font-semibold tracking-wider text-mesh-fg">
            Settings
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-mesh-mute transition hover:bg-mesh-edge/30 hover:text-mesh-fg"
            aria-label="Close settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>

        <div className="mesh-divider" />

        {/* Accent picker */}
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mesh-accent">
            Accent
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ACCENTS.map((a) => {
              const active = accent === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setAccent(a.id)}
                  className={`group flex items-center gap-3 rounded-md border px-3 py-2 transition ${
                    active
                      ? 'border-mesh-fg/60 bg-mesh-panel/80'
                      : 'border-mesh-edge/60 bg-mesh-panel/40 hover:border-mesh-edge/90'
                  }`}
                >
                  <span
                    className="block h-4 w-4 rounded-full"
                    style={{
                      background: a.preview,
                      boxShadow: active ? `0 0 12px ${a.preview}` : `0 0 4px ${a.preview}`
                    }}
                  />
                  <span className="font-mono text-[11px] uppercase tracking-wider text-mesh-fg">
                    {a.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Perf mode */}
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mesh-accent">
            Performance
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPerfMode('high')}
              className={`flex flex-col items-start gap-1 rounded-md border px-3 py-2 transition ${
                perfMode === 'high'
                  ? 'border-mesh-fg/60 bg-mesh-panel/80'
                  : 'border-mesh-edge/60 bg-mesh-panel/40 hover:border-mesh-edge/90'
              }`}
            >
              <span className="font-mono text-[11px] uppercase tracking-wider text-mesh-fg">High</span>
              <span className="text-left text-[10px] text-mesh-mute">Full bloom & 6k stars</span>
            </button>
            <button
              onClick={() => setPerfMode('low')}
              className={`flex flex-col items-start gap-1 rounded-md border px-3 py-2 transition ${
                perfMode === 'low'
                  ? 'border-mesh-fg/60 bg-mesh-panel/80'
                  : 'border-mesh-edge/60 bg-mesh-panel/40 hover:border-mesh-edge/90'
              }`}
            >
              <span className="font-mono text-[11px] uppercase tracking-wider text-mesh-fg">Low</span>
              <span className="text-left text-[10px] text-mesh-mute">Skip bloom, fewer stars</span>
            </button>
          </div>
          <div className="mt-2 text-[10px] leading-relaxed text-mesh-mute">
            Performance changes apply on the next lens switch (the canvas
            re-mounts). Toggle a different lens and back to see the effect.
          </div>
        </div>

        <div className="mesh-divider" />

        <div className="rounded border border-mesh-edge/60 bg-mesh-panel/40 p-3 text-[11px] leading-relaxed text-mesh-dim">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-mesh-accent">
            About
          </div>
          MESH runs GPT-2 (int8) entirely in your browser via{' '}
          <code className="text-mesh-fg">@huggingface/transformers</code>. No prompts ever leave your device.
        </div>

        <div className="mt-auto flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.2em] text-mesh-mute">
          <span>v0.2 · 2026</span>
          <span>esc to close</span>
        </div>
      </aside>
    </>
  );
}
