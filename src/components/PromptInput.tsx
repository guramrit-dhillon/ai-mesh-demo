import { useEffect, useState } from 'react';
import { useStore } from '../store';

const DEBOUNCE_MS = 400;

const SUGGESTIONS = [
  'The quick brown fox',
  'In the year 2050,',
  "I'm going to",
  'The capital of France is',
  'Once upon a time'
];

export function PromptInput() {
  const setPrompt = useStore((s) => s.setPrompt);
  const tipPrompt = useStore((s) => s.nodes[s.tipNodeId]?.prompt ?? s.prompt);
  const tipNode = useStore((s) => s.nodes[s.tipNodeId]);
  const [localValue, setLocalValue] = useState(tipPrompt);

  useEffect(() => {
    setLocalValue(tipPrompt);
  }, [tipPrompt]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (localValue !== tipPrompt) setPrompt(localValue);
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [localValue, tipPrompt, setPrompt]);

  const isLoading = tipNode?.status === 'loading';

  return (
    <div className="mesh-panel mesh-corner-bracket flex items-center gap-4 rounded-lg p-3 pr-4">
      <div className="flex flex-col items-center justify-center px-2">
        <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-mesh-mute">prompt</span>
        <span className="mt-1 block h-2 w-2 rounded-full" style={{
          background: isLoading ? 'rgb(var(--mesh-warm))' : 'rgb(var(--mesh-accent))',
          boxShadow: isLoading
            ? '0 0 10px rgb(var(--mesh-warm))'
            : '0 0 10px rgb(var(--mesh-accent))'
        }} />
      </div>

      <div className="flex-1">
        <textarea
          className="h-16 w-full resize-none rounded bg-mesh-ink/60 p-2 font-mono text-sm text-mesh-fg outline-none placeholder:text-mesh-mute focus:ring-1 focus:ring-mesh-accent/60"
          placeholder="Type to see the model's next-token distribution…"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          spellCheck={false}
        />
        {localValue.length === 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-mesh-mute">try:</span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setLocalValue(s)}
                className="rounded border border-mesh-edge/70 bg-mesh-panel/40 px-2 py-0.5 font-mono text-[10px] text-mesh-dim transition hover:border-mesh-accent/60 hover:text-mesh-fg"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 pl-2 font-mono text-[9px] uppercase tracking-[0.2em] text-mesh-mute">
        <span>{localValue.length} chars</span>
        <span>~{Math.max(1, Math.round(localValue.length / 4))} tokens</span>
      </div>
    </div>
  );
}
