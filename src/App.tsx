import { Controls } from './components/Controls';
import { EmbeddingsCanvas } from './components/EmbeddingsCanvas';
import { EmbeddingsControls } from './components/EmbeddingsControls';
import { MathPanel } from './components/MathPanel';
import { MeshCanvas } from './components/MeshCanvas';
import { ModeSwitcher } from './components/ModeSwitcher';
import { ModelLoadOverlay } from './components/ModelLoadOverlay';
import { PromptInput } from './components/PromptInput';
import { useStore } from './store';

export default function App() {
  const mode = useStore((s) => s.mode);
  return (
    <div className="relative grid h-full grid-cols-[1fr_320px] grid-rows-[1fr_auto] gap-3 bg-slate-950 p-3 text-slate-100">
      <div className="relative col-span-1 row-span-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/40">
        {mode === 'predictions' && <MeshCanvas />}
        {mode === 'embeddings' && <EmbeddingsCanvas />}
        {(mode === 'attention' || mode === 'logit-lens') && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
            <div className="text-sm uppercase tracking-wider text-cyan-300">
              {mode === 'attention' ? 'attention' : 'logit lens'} — coming soon
            </div>
            <div className="max-w-md px-6 text-center text-xs text-slate-500">
              {mode === 'attention'
                ? 'Requires a custom ONNX re-export of GPT-2 with output_attentions=True. The current Xenova/gpt2 ONNX does not surface decoder self-attention.'
                : "Each layer's hidden state projected through the unembedding matrix to see what the model 'thinks' the next token is at each layer. Requires output_hidden_states=True."}
            </div>
          </div>
        )}
        <ModeSwitcher />
      </div>
      <div className="col-span-1 row-span-1 flex flex-col gap-3 overflow-y-auto">
        {mode === 'predictions' && (
          <>
            <Controls />
            <MathPanel />
          </>
        )}
        {mode === 'embeddings' && (
          <>
            <EmbeddingsControls />
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-300">
              <div className="mb-2 text-[10px] uppercase tracking-wider text-cyan-300">embedding space</div>
              <p className="leading-relaxed text-slate-400">
                Each token is a point in semantic 3D space. Tokens with similar meanings cluster together — animals near other animals, colors near colors, emotions near emotions.
              </p>
              <p className="mt-3 text-[10px] text-slate-500">
                Showing curated semantic clusters. Drag <em>spread</em> to pull clusters apart and read individual labels. To swap in real GPT-2 token embeddings, see <code className="text-cyan-300">scripts/extract_embeddings.py</code>.
              </p>
            </div>
          </>
        )}
      </div>
      <div className="col-span-2 row-span-1">
        <PromptInput />
      </div>
      <ModelLoadOverlay />
    </div>
  );
}
