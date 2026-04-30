import { useEffect, useState } from 'react';
import { useStore } from '../store';

const DEBOUNCE_MS = 150;

export function PromptInput() {
  const setPrompt = useStore((s) => s.setPrompt);
  const storedPrompt = useStore((s) => s.prompt);
  const [localValue, setLocalValue] = useState(storedPrompt);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (localValue !== storedPrompt) setPrompt(localValue);
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [localValue, storedPrompt, setPrompt]);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
      <label className="mb-2 block text-xs uppercase tracking-wide text-slate-400">
        Prompt
      </label>
      <textarea
        className="h-24 w-full resize-none rounded bg-slate-950/60 p-2 font-mono text-sm text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Type to see GPT-2's next-token distribution..."
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
      />
    </div>
  );
}
