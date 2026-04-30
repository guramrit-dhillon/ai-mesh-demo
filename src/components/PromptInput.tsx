import { useEffect, useState } from 'react';
import { useStore } from '../store';

// Wait until the user pauses before re-inferring. Shorter feels responsive
// but causes the candidate distribution to thrash on every keystroke (each
// tokenization produces a different top-K). 400ms catches natural typing
// pauses between words while still feeling snappy.
const DEBOUNCE_MS = 400;

export function PromptInput() {
  const setPrompt = useStore((s) => s.setPrompt);
  // Read the prompt at the *current tip*, not the typed root prompt — that way
  // clicking a candidate (which advances the tip) is reflected in the textarea.
  const tipPrompt = useStore((s) => s.nodes[s.tipNodeId]?.prompt ?? s.prompt);
  const [localValue, setLocalValue] = useState(tipPrompt);

  // Pull external changes (tip advances via click) into the textarea.
  useEffect(() => {
    setLocalValue(tipPrompt);
  }, [tipPrompt]);

  // Debounce user typing back to the store.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (localValue !== tipPrompt) setPrompt(localValue);
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [localValue, tipPrompt, setPrompt]);

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
