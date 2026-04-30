# LLM Visualizer — Design Spec

**Date:** 2026-04-30
**Status:** Draft, pending user review

## 1. Goal

A single-page React web app that visualizes the **next-token probability mesh** of a real Large Language Model in real time as the user types. Bubbles representing candidate tokens grow brighter with higher probability and dim with lower; clicking a bubble extends the prompt with that token and grows the mesh deeper. Sliders for temperature, top-k, and top-p re-shape the distribution live, making the softmax/sampling math directly visible.

The app exists to demystify "scoring, softmax, and sampling" — the user can see, not just read about, why an LLM picks one token over another.

## 2. Scope

### In scope (Tier 1)

- Real, in-browser inference using **GPT-2 (small)** via `@xenova/transformers` v3, loading the pre-built `Xenova/gpt2` ONNX (`decoder_model_merged_quantized.onnx`, ~122 MB, cached after first visit).
- **Interactive Tree** mesh: top-K next tokens fanned right of the cursor. Clicking any bubble appends that token to the prompt and grows its own top-K children — the user builds the mesh manually.
- **Sampling math panel** showing the math for the hovered bubble: raw logit, softmax probability, rank, and the effect of the current sampling parameters.
- **Live sliders** for temperature (0.1–2.0), top-k (1–50), and top-p (0.05–1.0). Adjustment immediately re-brightens / dims existing bubbles (no new inference required — distributions are recomputed from cached logits).
- **Auto-infer-on-type** with 150 ms debounce. The current end-of-prompt's distribution is always reflected.
- A bottom-left input area for the prompt itself.

### Out of scope (clean seams for later)

- **Tier 2** (attention heatmaps over input tokens). Requires custom ONNX re-export with `output_attentions=True` plus dropping below the `transformers.js` high-level API to read attention tensors via `onnxruntime-web` directly. Reserved for a follow-up.
- **Tier 3** (hidden-state PCA, per-layer logit lens). Requires `output_hidden_states=True` re-export + JS PCA. Skipped.
- Multiple-model selection, prompt sharing/saving, mobile-first layout, internationalization, accessibility past basic keyboard navigation.
- Server-side anything. The app is a static site.

## 3. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Where the model runs | In-browser via `@xenova/transformers` (WASM/WebGPU) | No backend, no API costs, share as a static URL. GPT-2 quality is dated but math is fully authentic. |
| Mesh shape | Interactive Tree (click-to-expand top-K) | User-validated. Avoids combinatorial blow-up of fully-expanded beam trees while still feeling like a "mesh." |
| Math depth | Tier 1 (sampling-only) | Tier 2/3 each require custom ONNX exports + lower-level inference code (~3–7 days extra each). Tier 1 covers the user's stated interest ("scoring, softmax") with zero infra cost. |
| Inference cadence | 150 ms debounced auto-infer | Matches the original ask ("whenever I type"). 150 ms balances responsiveness against duplicate inference for fast typists. |
| Sampling controls | Live temperature, top-k, top-p sliders | Recomputing softmax from cached logits is O(vocab). Slider drag stays at 60 fps without re-running the model. |
| Frontend framework | React 18 + Vite + TypeScript | User asked for React. Vite gives fast HMR + simple static-site builds. |
| State management | Zustand | Lightweight, no boilerplate, fits the small surface area. |
| Styling | Tailwind CSS | Speed of iteration, consistent dark-mode palette. |
| Tree rendering | Hand-rolled SVG with simple horizontal layout | Click-to-expand pattern doesn't need force-directed; predictable layout reads better. |
| Inference threading | Web Worker | Keeps the UI thread responsive while ONNX runs. |

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ App (React)                                                       │
│                                                                    │
│  ┌──────────────┐   ┌────────────────────┐   ┌────────────────┐  │
│  │ Prompt Input │ → │   Mesh Canvas      │ ← │  Math Panel    │  │
│  │ (debounced)  │   │   (SVG tree)       │   │  (hovered      │  │
│  │              │   │                    │   │   bubble)      │  │
│  └──────────────┘   └────────────────────┘   └────────────────┘  │
│         │                    ↑                       ↑            │
│         │                    │                       │            │
│         ▼                    │                       │            │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Sampling Controls (temperature / top-k / top-p sliders)    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│         │                    ↑                                    │
│         │   {prompt}         │  {logits, tokens}                   │
│         │   {expand path}    │                                    │
│         ▼                    │                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Zustand store: prompt, treeNodes, hovered, samplingParams  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│         │                    ↑                                    │
│         │   postMessage      │  postMessage                       │
└─────────┼────────────────────┼────────────────────────────────────┘
          ▼                    │
┌─────────────────────────────────────────────────────────────────┐
│ Inference Worker (Web Worker)                                    │
│                                                                   │
│  • Loads Xenova/gpt2 via @xenova/transformers (cached in IDB)    │
│  • Tokenizes incoming prompt                                     │
│  • Runs forward pass → returns top-K logits + token strings      │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Module boundaries

- **`src/inference/worker.ts`** — owns the model lifecycle. One job at a time; new jobs cancel pending. Posts `{type: 'distribution', logits, tokens, prompt}`.
- **`src/inference/client.ts`** — main-thread client of the worker; exposes a `requestDistribution(prompt)` function that returns a `Promise<Distribution>` and cancels any in-flight request.
- **`src/store.ts`** — Zustand store. Owns `prompt`, `treeNodes` (a map keyed by path), `hoveredNodeId`, `samplingParams: {temperature, topK, topP}`. Pure functions.
- **`src/sampling.ts`** — pure: takes raw logits + params, returns probabilities and the active mask (which tokens survive top-k/top-p). Used by both Mesh and Math Panel.
- **`src/components/MeshCanvas.tsx`** — SVG tree renderer. Reads tree from store, renders bubbles with size/opacity from sampling.ts. Click handler dispatches `expandNode(path, token)`.
- **`src/components/MathPanel.tsx`** — reads `hoveredNodeId` from store; renders logit, softmax curve, top-k cut line, top-p cut line.
- **`src/components/Controls.tsx`** — three sliders, bound directly to `samplingParams`.
- **`src/components/PromptInput.tsx`** — textarea, debounced onChange, dispatches `setPrompt`.
- **`src/App.tsx`** — composes the layout and handles initial model-load loading state.

Each file has one clear job, one main exported symbol, and can be understood without reading the others.

### Data flow

**On prompt change (debounced 150 ms):**
1. `PromptInput` writes new prompt to store.
2. A store subscriber calls `requestDistribution(prompt)` on the worker client.
3. Worker tokenizes, runs forward pass, returns top-K logits + token strings.
4. Client writes a fresh root node to store: `{path: [], children: [{token, logit, ...}]}`.

**On bubble click (expand):**
1. `MeshCanvas` calls `expandNode(path, token)`.
2. Store appends the token onto the existing prompt path and adds a placeholder child node `{loading: true}`.
3. Subscriber calls `requestDistribution(prompt + appendedTokens)`.
4. Result populates the placeholder's children.

**On slider change:**
1. `Controls` writes new `samplingParams` to store.
2. `MeshCanvas` and `MathPanel` re-render. `sampling.ts` recomputes probs/masks from cached logits — no worker call.

### State machine: bubble lifecycle

```
[fresh] → click → [loading] → worker resolves → [expanded]
                            → worker rejects → [error] → click again → [loading]
```

A node's `children` array is the only thing that changes during expansion. Probability values are derived; we don't store them in the tree, only the raw logits.

## 5. Error handling

- **First-load model download fails** (network, HF Hub down) → show a retry button with the error reason. The model URL is fixed; no fallback model in P0.
- **Worker crash** (rare, OOM-like) → catch postMessage error, mark the affected node `error: true`, allow click-retry.
- **No WebGPU available** → `transformers.js` falls back to WASM automatically. We don't expose this; just log to console.
- **User types past model context** (1024 tokens for GPT-2) → truncate from the left in the worker. Show a small banner "Truncating earlier text — GPT-2 has a 1024-token context."
- **Browser storage quota exceeded** (model can't cache) → log and continue; subsequent loads will re-download. Not a P0 surfaced error.

We deliberately do **not** add fallbacks for: missing IndexedDB, very old browsers, JS disabled. The app's audience is engineers with modern browsers; failing loud is fine.

## 6. Testing

- **No automated tests for components in P0.** UI is exploratory; a screenshot test would be brittle and the visual feel is the product.
- **Unit tests for `sampling.ts`** — pure function with clear math invariants. Cover: temperature scaling preserves rank; top-k retains exactly k items; top-p cumulative sum threshold; numerical stability at temperature near 0.
- **Manual smoke checklist** before shipping:
  1. Type "The cat sat on the" → expect "the" / "a" / "his" type tokens dominant
  2. Move temperature 1.0 → 0.1 → top-1 bubble approaches probability 1.0; rest dim
  3. Move temperature 1.0 → 2.0 → distribution flattens
  4. Set top-k = 1 → only one bubble lit
  5. Click a non-greedy bubble → that path is appended to prompt, new top-K appears
  6. Reload page → model loads from IndexedDB cache (faster than first load)

## 7. File layout

```
llm-visualizer/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.cjs
├── public/
│   └── (no model files — transformers.js fetches from HF Hub)
├── src/
│   ├── main.tsx                    # React entry
│   ├── App.tsx                     # Layout + model-load state
│   ├── store.ts                    # Zustand store
│   ├── sampling.ts                 # Pure: logits → probs + masks
│   ├── inference/
│   │   ├── worker.ts               # Web Worker: model lifecycle
│   │   └── client.ts               # Main-thread API to worker
│   ├── components/
│   │   ├── PromptInput.tsx
│   │   ├── MeshCanvas.tsx
│   │   ├── MathPanel.tsx
│   │   ├── Controls.tsx
│   │   └── ModelLoadOverlay.tsx
│   └── styles/
│       └── index.css               # Tailwind directives
└── docs/superpowers/specs/2026-04-30-llm-visualizer-design.md  # this doc
```

## 8. Open questions / risks

- **GPT-2 quality:** GPT-2 small (~125M params) makes lots of "boring" predictions for short prompts ("the" / "," / "a" dominate the next-token distribution heavily). This is honest behavior but may underwhelm. Mitigation: ship a few seed prompts ("Once upon a time", "The capital of France is") so first-time users see interesting distributions.
- **First-load cost:** ~122 MB download is significant on slow networks. Mitigation: ModelLoadOverlay shows a clear progress bar and explains "one-time, cached after." No P0 fix beyond UX clarity.
- **Tree explosion:** Even with click-to-expand, a curious user can grow a wide deep tree. Mitigation: expand state stays under a few hundred nodes for any realistic exploration; if it ever feels heavy, add an "auto-collapse siblings on expand" toggle in v2.
- **Tokenizer surprises:** GPT-2 byte-pair tokens can render as unprintable bytes or partial words (`Ġthe`, `Ġcat`). Need a small render helper that converts BPE tokens to displayable strings (replace `Ġ` with a visible space marker; show raw bytes for non-printable).

## 9. What "done" looks like

A user opens the URL, waits ~10–60 s for the model to download once, sees a bottom-left textarea and an empty mesh canvas. They type "The cat sat on the" and after 150 ms a fan of bubbles appears: "the" largest and brightest, "a", "his", "my" smaller and dimmer. They drag the temperature slider to 0.3 and watch all bubbles except "the" fade. They drag it back to 1.0, click "a", and a new fan grows showing what comes after "The cat sat on a". Hovering "a" shows the math panel light up: raw logit -2.1, softmax probability 0.21, rank #2, currently above the top-p=0.9 cut.

That's the full Tier 1 experience.
