# MESH

> A live look inside language models — running entirely in your browser.

MESH renders the internals of GPT-2 as four interactive 3D scenes. Type a prompt and watch the next-token distribution, the embedding space, the input tokens that drove the prediction, and the model's per-position confidence — all powered by the public Xenova/gpt2 ONNX bundle, no server round-trips.

## Lenses

| Lens | What it shows |
|---|---|
| **Predictions** | Live next-token mesh. Click any candidate to branch. Top-1 chain auto-extends when the model is confident. Toggle **autoplay** to walk forward, **heatmap** to color by probability. |
| **Embeddings** | Tokens as points in semantic 3D space. Search to fly to a match, click two points for a cosine-distance readout, switch to a 2D top-down view. Optional: load real `all-MiniLM-L6-v2` embeddings (~80 MB). |
| **Attention** | Input-attribution via per-token ablation. Pick any of the top-5 predicted next tokens as the target — the bars retell the story of which inputs drove that choice. |
| **Logit Lens** | Progressive prefix predictions. At every position in your prompt, what would the model have predicted next? Surprise positions (top-1 ≠ actual) get gold rings + an amber dot on the trajectory chart. |

## Quick start

```bash
npm install
npm run dev
```

First load downloads ~268 MB of model weights into your browser cache. Subsequent loads are instant.

## Stack

- React 18 + TypeScript + Vite
- `@huggingface/transformers` v3 — in-browser ONNX inference (WASM/WebGPU)
- `react-force-graph-3d` + `three.js` for the holographic scenes
- Zustand for state, Tailwind for the HUD, JetBrains Mono / Inter / Space Grotesk for type
- Web Worker isolation for the model so the UI stays responsive during forward passes

## What's honest

- **Predictions** are real top-50 logits from GPT-2, sampled with the temperature/top-k/top-p you set. Numbers come from `softmax(logits / T)`.
- **Embeddings** synthetic dataset is hand-curated cluster centers (clearly labeled). Real embeddings come from MiniLM-L6-v2 and a PCA computed in your browser via power iteration.
- **Attention** is *input-attribution*, not the model's internal self-attention weights. Those aren't surfaced by the public Xenova ONNX. We measure prediction-shift after ablating each input token — a model-agnostic proxy that uses only the next-token logits we already have.
- **Logit Lens** here means *position-wise* (run inference at each prefix length), not the classical *layer-wise* variant. Hidden states aren't exposed by the public ONNX either, so we slice across positions instead.

Both attention and logit-lens caveats are surfaced in their controls panel.

## Scripts

```bash
npm run dev       # Vite dev server
npm run build     # tsc + vite build
npm run preview   # serve the built bundle
npm test          # vitest
```

## Layout

```
src/
├── App.tsx                       — shell: left rail + top bar + stage + sidebar + prompt
├── store.ts                      — Zustand: prompt tree, modes, controls, autoplay
├── inference/                    — worker + client (streaming + raw single-shot APIs)
├── sampling.ts                   — softmax / top-k / top-p
├── tokens.ts                     — BPE token rendering
├── attention/                    — ablation-based attribution
├── logitLens/                    — progressive prefix predictions
├── embeddings/                   — synthetic data + real MiniLM + PCA
├── components/
│   ├── shell/                    — LeftRail, TopBar, SettingsDrawer, StageEffects, ModeIcon
│   ├── brand/                    — Wordmark
│   ├── MeshCanvas.tsx            — predictions stage
│   ├── EmbeddingsCanvas.tsx      — embeddings stage
│   ├── AttentionCanvas.tsx       — attention stage
│   └── LogitLensCanvas.tsx       — logit-lens stage
├── hooks/useAutoplay.ts          — top-1 walker
└── styles/index.css              — MESH design tokens, mesh-panel/btn/range/divider
```

## Why "MESH"?

The name picks up the visualization — every prompt fans out into a mesh of possible next tokens. It also reads as the studio name for the project: a small toolkit for *meshing* with model internals.
