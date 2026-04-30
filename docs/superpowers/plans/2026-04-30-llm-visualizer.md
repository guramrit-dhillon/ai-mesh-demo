# LLM Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static React + Vite single-page web app that runs GPT-2 in the browser via `@huggingface/transformers` and visualizes the next-token probability mesh as the user types, with live temperature / top-k / top-p sliders that re-shape the distribution.

**Architecture:** Pure client-side. React 18 + TypeScript + Vite. Zustand for state. Tailwind for styles. A Web Worker owns the model and returns top-K logits per inference; the main thread caches logits per tree node and recomputes probabilities locally whenever sampling parameters change (no extra inference). The "mesh" is an SVG tree that the user grows by clicking bubbles.

**Tech Stack:**
- React 18 + TypeScript
- Vite 5
- Tailwind CSS 3
- Zustand 4
- `@huggingface/transformers` v3 (loads `Xenova/gpt2`, ~122 MB quantized ONNX, cached in IndexedDB after first visit)
- Vitest for unit tests on `sampling.ts`

**Reference:** See `docs/superpowers/specs/2026-04-30-llm-visualizer-design.md` for the full design.

---

## Task 1: Scaffold the project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `tailwind.config.cjs`
- Create: `postcss.config.cjs`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles/index.css`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "llm-visualizer",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview --host",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@huggingface/transformers": "^3.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@huggingface/transformers'] }
});
```

- [ ] **Step 5: Create `tailwind.config.cjs`**

```js
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: []
};
```

- [ ] **Step 6: Create `postcss.config.cjs`**

```js
module.exports = {
  plugins: { tailwindcss: {}, autoprefixer: {} }
};
```

- [ ] **Step 7: Create `index.html`**

```html
<!doctype html>
<html lang="en" class="bg-slate-950 text-slate-100">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LLM Visualizer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Create `src/styles/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; }
```

- [ ] **Step 9: Create `src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 10: Create placeholder `src/App.tsx`**

```tsx
export default function App() {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-slate-400">LLM Visualizer — scaffolding live.</p>
    </div>
  );
}
```

- [ ] **Step 11: Create `.gitignore`**

```
node_modules
dist
.DS_Store
*.log
.superpowers
.claude
```

- [ ] **Step 12: Install dependencies**

Run: `cd /Users/guramrit/projects/llm-visualizer && npm install`
Expected: deps install without errors. Some peer-dep warnings are acceptable.

- [ ] **Step 13: Run dev server and verify scaffold**

Run: `npm run dev` in one terminal.
Open `http://localhost:5173` in a browser.
Expected: dark page with text "LLM Visualizer — scaffolding live."

- [ ] **Step 14: Initialize git and commit**

```bash
cd /Users/guramrit/projects/llm-visualizer
git init
git add package.json tsconfig.json tsconfig.node.json vite.config.ts tailwind.config.cjs postcss.config.cjs index.html .gitignore src/ docs/
git commit -m "feat: scaffold Vite + React + TS + Tailwind project"
```

---

## Task 2: Define core types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

```ts
export interface SamplingParams {
  temperature: number;
  topK: number;
  topP: number;
}

export interface CandidateToken {
  id: number;
  text: string;
  logit: number;
}

export interface TreeNode {
  id: string;
  parentId: string | null;
  prompt: string;
  candidates: CandidateToken[] | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
}

export interface DistributionRequest {
  type: 'distribution-request';
  nodeId: string;
  prompt: string;
}

export interface DistributionResponse {
  type: 'distribution-response';
  nodeId: string;
  candidates: CandidateToken[];
}

export interface DistributionError {
  type: 'distribution-error';
  nodeId: string;
  error: string;
}

export interface ModelStatus {
  type: 'model-status';
  status: 'loading' | 'ready' | 'error';
  progress?: number;
  error?: string;
}

export type WorkerOutbound = DistributionResponse | DistributionError | ModelStatus;
export type WorkerInbound = DistributionRequest;
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: define core types for tree, sampling, and worker protocol"
```

---

## Task 3: Sampling math (TDD)

**Files:**
- Create: `src/sampling.ts`
- Create: `src/sampling.test.ts`

- [ ] **Step 1: Write the failing tests in `src/sampling.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { softmax, applyTopKTopP, score } from './sampling';

describe('softmax', () => {
  it('sums to 1 within float epsilon', () => {
    const probs = softmax([1, 2, 3, 4], 1.0);
    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it('preserves rank order', () => {
    const probs = softmax([0.1, -1, 2.5, 0.3], 1.0);
    expect(probs[2]).toBeGreaterThan(probs[0]);
    expect(probs[0]).toBeGreaterThan(probs[3]);
    expect(probs[3]).toBeGreaterThan(probs[1]);
  });

  it('approaches one-hot at argmax as temperature shrinks', () => {
    const probs = softmax([1, 5, 2], 0.05);
    expect(probs[1]).toBeGreaterThan(0.99);
  });

  it('flattens toward uniform as temperature grows', () => {
    const probs = softmax([1, 5, 2], 100);
    expect(Math.max(...probs) - Math.min(...probs)).toBeLessThan(0.05);
  });

  it('is numerically stable for large logits', () => {
    const probs = softmax([1000, 1001, 999], 1.0);
    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
    expect(probs.every((p) => Number.isFinite(p))).toBe(true);
  });
});

describe('applyTopKTopP', () => {
  it('top-k=1 retains only the argmax', () => {
    const alive = applyTopKTopP([0.5, 0.3, 0.15, 0.05], 1, 1.0);
    expect(alive).toEqual([true, false, false, false]);
  });

  it('top-k=N retains all when N >= length', () => {
    const alive = applyTopKTopP([0.5, 0.3, 0.15, 0.05], 10, 1.0);
    expect(alive).toEqual([true, true, true, true]);
  });

  it('top-p stops once cumulative crosses threshold', () => {
    const alive = applyTopKTopP([0.5, 0.3, 0.15, 0.05], 100, 0.7);
    expect(alive).toEqual([true, true, false, false]);
  });

  it('top-p=1 retains all', () => {
    const alive = applyTopKTopP([0.5, 0.3, 0.15, 0.05], 100, 1.0);
    expect(alive).toEqual([true, true, true, true]);
  });

  it('top-k and top-p combine (whichever is more restrictive wins)', () => {
    const alive = applyTopKTopP([0.5, 0.3, 0.15, 0.05], 2, 1.0);
    expect(alive).toEqual([true, true, false, false]);
  });

  it('handles unsorted input correctly (operates on sorted view)', () => {
    const alive = applyTopKTopP([0.05, 0.5, 0.15, 0.3], 100, 0.7);
    expect(alive).toEqual([false, true, false, true]);
  });
});

describe('score', () => {
  it('returns one entry per logit with correct rank', () => {
    const result = score([1, 5, 2, 4], { temperature: 1.0, topK: 4, topP: 1.0 });
    expect(result).toHaveLength(4);
    expect(result[1].rank).toBe(0);
    expect(result[3].rank).toBe(1);
    expect(result[2].rank).toBe(2);
    expect(result[0].rank).toBe(3);
  });

  it('marks alive=false for tokens cut by top-k', () => {
    const result = score([1, 5, 2, 4], { temperature: 1.0, topK: 2, topP: 1.0 });
    expect(result[1].alive).toBe(true);
    expect(result[3].alive).toBe(true);
    expect(result[2].alive).toBe(false);
    expect(result[0].alive).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `softmax`, `applyTopKTopP`, `score` are not exported (module not yet implemented).

- [ ] **Step 3: Implement `src/sampling.ts`**

```ts
import type { SamplingParams } from './types';

export interface ScoredToken {
  index: number;
  prob: number;
  alive: boolean;
  rank: number;
}

export function softmax(logits: number[], temperature: number): number[] {
  const T = Math.max(temperature, 1e-6);
  const scaled = logits.map((l) => l / T);
  const maxL = Math.max(...scaled);
  const exps = scaled.map((l) => Math.exp(l - maxL));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export function applyTopKTopP(probs: number[], topK: number, topP: number): boolean[] {
  const sortedIndices = probs
    .map((_, i) => i)
    .sort((a, b) => probs[b] - probs[a]);
  const alive = new Array(probs.length).fill(false);
  let cumulative = 0;
  let kept = 0;
  for (const idx of sortedIndices) {
    if (kept >= topK) break;
    alive[idx] = true;
    cumulative += probs[idx];
    kept += 1;
    if (cumulative >= topP) break;
  }
  return alive;
}

export function score(logits: number[], params: SamplingParams): ScoredToken[] {
  const probs = softmax(logits, params.temperature);
  const alive = applyTopKTopP(probs, params.topK, params.topP);
  const sortedIndices = probs
    .map((_, i) => i)
    .sort((a, b) => probs[b] - probs[a]);
  const rankByIndex = new Map<number, number>();
  sortedIndices.forEach((idx, rank) => rankByIndex.set(idx, rank));
  return logits.map((_, i) => ({
    index: i,
    prob: probs[i],
    alive: alive[i],
    rank: rankByIndex.get(i)!
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all 12 tests in `sampling.test.ts` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sampling.ts src/sampling.test.ts
git commit -m "feat: pure sampling math (softmax, top-k, top-p) with tests"
```

---

## Task 4: Inference worker

**Files:**
- Create: `src/inference/worker.ts`

- [ ] **Step 1: Create `src/inference/worker.ts`**

```ts
/// <reference lib="webworker" />
import { AutoTokenizer, AutoModelForCausalLM, env } from '@huggingface/transformers';
import type {
  CandidateToken,
  WorkerInbound,
  WorkerOutbound
} from '../types';

env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_ID = 'Xenova/gpt2';
const TOP_K = 50;

let tokenizerPromise: ReturnType<typeof AutoTokenizer.from_pretrained> | null = null;
let modelPromise: ReturnType<typeof AutoModelForCausalLM.from_pretrained> | null = null;

function post(msg: WorkerOutbound): void {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);
}

async function ensureModel(): Promise<void> {
  if (tokenizerPromise && modelPromise) return;
  post({ type: 'model-status', status: 'loading' });
  try {
    tokenizerPromise = AutoTokenizer.from_pretrained(MODEL_ID);
    modelPromise = AutoModelForCausalLM.from_pretrained(MODEL_ID, {
      dtype: 'q8'
    });
    await tokenizerPromise;
    await modelPromise;
    post({ type: 'model-status', status: 'ready' });
  } catch (err) {
    post({
      type: 'model-status',
      status: 'error',
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}

async function computeDistribution(prompt: string): Promise<CandidateToken[]> {
  const tokenizer = await tokenizerPromise!;
  const model = await modelPromise!;

  const safePrompt = prompt.length === 0 ? '\n' : prompt;
  const encoded = await tokenizer(safePrompt, { return_tensors: 'pt' });
  const out = await model(encoded);

  const logits = out.logits;
  const lastIndex = logits.dims[1] - 1;
  const lastSlice = logits.slice(null, [lastIndex, lastIndex + 1], null);
  const flat = Array.from(lastSlice.data as Float32Array);

  const indexed = flat.map((logit, id) => ({ id, logit }));
  indexed.sort((a, b) => b.logit - a.logit);
  const top = indexed.slice(0, TOP_K);

  return top.map(({ id, logit }) => ({
    id,
    logit,
    text: tokenizer.decode([id], { skip_special_tokens: false })
  }));
}

self.addEventListener('message', async (ev: MessageEvent<WorkerInbound>) => {
  const msg = ev.data;
  if (msg.type !== 'distribution-request') return;
  try {
    await ensureModel();
    const candidates = await computeDistribution(msg.prompt);
    post({ type: 'distribution-response', nodeId: msg.nodeId, candidates });
  } catch (err) {
    post({
      type: 'distribution-error',
      nodeId: msg.nodeId,
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

ensureModel().catch(() => { /* status already posted */ });
```

- [ ] **Step 2: Commit**

```bash
git add src/inference/worker.ts
git commit -m "feat: inference worker — loads GPT-2 and returns top-K logits"
```

---

## Task 5: Inference client

**Files:**
- Create: `src/inference/client.ts`

- [ ] **Step 1: Create `src/inference/client.ts`**

```ts
import type {
  CandidateToken,
  ModelStatus,
  WorkerInbound,
  WorkerOutbound
} from '../types';

type DistributionListener = (
  nodeId: string,
  candidates: CandidateToken[] | null,
  error: string | null
) => void;

type ModelStatusListener = (status: ModelStatus) => void;

let worker: Worker | null = null;
const distributionListeners = new Set<DistributionListener>();
const modelStatusListeners = new Set<ModelStatusListener>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (ev: MessageEvent<WorkerOutbound>) => {
    const msg = ev.data;
    if (msg.type === 'distribution-response') {
      for (const fn of distributionListeners) fn(msg.nodeId, msg.candidates, null);
    } else if (msg.type === 'distribution-error') {
      for (const fn of distributionListeners) fn(msg.nodeId, null, msg.error);
    } else if (msg.type === 'model-status') {
      for (const fn of modelStatusListeners) fn(msg);
    }
  });
  return worker;
}

export function requestDistribution(nodeId: string, prompt: string): void {
  const w = ensureWorker();
  const msg: WorkerInbound = { type: 'distribution-request', nodeId, prompt };
  w.postMessage(msg);
}

export function onDistribution(fn: DistributionListener): () => void {
  ensureWorker();
  distributionListeners.add(fn);
  return () => distributionListeners.delete(fn);
}

export function onModelStatus(fn: ModelStatusListener): () => void {
  ensureWorker();
  modelStatusListeners.add(fn);
  return () => modelStatusListeners.delete(fn);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/inference/client.ts
git commit -m "feat: main-thread client for the inference worker"
```

---

## Task 6: Zustand store

**Files:**
- Create: `src/store.ts`

- [ ] **Step 1: Create `src/store.ts`**

```ts
import { create } from 'zustand';
import type {
  CandidateToken,
  ModelStatus,
  SamplingParams,
  TreeNode
} from './types';
import { onDistribution, onModelStatus, requestDistribution } from './inference/client';

interface AppState {
  prompt: string;
  rootNodeId: string;
  nodes: Record<string, TreeNode>;
  hoveredNodeId: string | null;
  hoveredCandidateIndex: number | null;
  sampling: SamplingParams;
  modelStatus: ModelStatus['status'];
  modelError: string | null;

  setPrompt: (prompt: string) => void;
  setSampling: (next: Partial<SamplingParams>) => void;
  setHover: (nodeId: string | null, candidateIndex: number | null) => void;
  expand: (parentNodeId: string, candidate: CandidateToken) => void;
}

const ROOT_ID = 'root';

function makeNode(id: string, parentId: string | null, prompt: string): TreeNode {
  return { id, parentId, prompt, candidates: null, status: 'loading', error: null };
}

export const useStore = create<AppState>((set, get) => {
  onDistribution((nodeId, candidates, error) => {
    set((state) => {
      const node = state.nodes[nodeId];
      if (!node) return state;
      const next: TreeNode = error
        ? { ...node, status: 'error', error }
        : { ...node, status: 'ready', candidates };
      return { nodes: { ...state.nodes, [nodeId]: next } };
    });
  });

  onModelStatus((msg) => {
    set({ modelStatus: msg.status, modelError: msg.error ?? null });
  });

  return {
    prompt: '',
    rootNodeId: ROOT_ID,
    nodes: { [ROOT_ID]: makeNode(ROOT_ID, null, '') },
    hoveredNodeId: null,
    hoveredCandidateIndex: null,
    sampling: { temperature: 1.0, topK: 10, topP: 0.95 },
    modelStatus: 'loading',
    modelError: null,

    setPrompt: (prompt) => {
      const root = makeNode(ROOT_ID, null, prompt);
      set({ prompt, nodes: { [ROOT_ID]: root }, hoveredNodeId: null, hoveredCandidateIndex: null });
      requestDistribution(ROOT_ID, prompt);
    },

    setSampling: (next) => set({ sampling: { ...get().sampling, ...next } }),

    setHover: (nodeId, candidateIndex) => set({ hoveredNodeId: nodeId, hoveredCandidateIndex: candidateIndex }),

    expand: (parentNodeId, candidate) => {
      const parent = get().nodes[parentNodeId];
      if (!parent) return;
      const newPrompt = parent.prompt + candidate.text;
      const newId = `${parentNodeId}/${candidate.id}`;
      if (get().nodes[newId]) return;
      const node = makeNode(newId, parentNodeId, newPrompt);
      set({ nodes: { ...get().nodes, [newId]: node } });
      requestDistribution(newId, newPrompt);
    }
  };
});
```

- [ ] **Step 2: Commit**

```bash
git add src/store.ts
git commit -m "feat: zustand store wiring tree state to inference worker"
```

---

## Task 7: PromptInput component

**Files:**
- Create: `src/components/PromptInput.tsx`

- [ ] **Step 1: Create `src/components/PromptInput.tsx`**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PromptInput.tsx
git commit -m "feat: debounced prompt input"
```

---

## Task 8: Controls component

**Files:**
- Create: `src/components/Controls.tsx`

- [ ] **Step 1: Create `src/components/Controls.tsx`**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Controls.tsx
git commit -m "feat: temperature / top-k / top-p sliders"
```

---

## Task 9: Token rendering helper

**Files:**
- Create: `src/tokens.ts`

- [ ] **Step 1: Create `src/tokens.ts`**

GPT-2 BPE tokens render with `Ġ` for spaces and `Ċ` for newlines. We make these visible without losing meaning.

```ts
export function renderToken(raw: string): string {
  if (raw === '') return '∅';
  return raw
    .replace(/Ġ/g, '·')
    .replace(/Ċ/g, '↵')
    .replace(/	/g, '→');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tokens.ts
git commit -m "feat: BPE token render helper (Ġ → ·, Ċ → ↵)"
```

---

## Task 10: MathPanel component

**Files:**
- Create: `src/components/MathPanel.tsx`

- [ ] **Step 1: Create `src/components/MathPanel.tsx`**

```tsx
import { useStore } from '../store';
import { score } from '../sampling';
import { renderToken } from '../tokens';

export function MathPanel() {
  const node = useStore((s) =>
    s.hoveredNodeId ? s.nodes[s.hoveredNodeId] ?? null : null
  );
  const candidateIndex = useStore((s) => s.hoveredCandidateIndex);
  const sampling = useStore((s) => s.sampling);

  if (!node || node.candidates === null || candidateIndex === null) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-500">
        Hover a bubble to see its logit, softmax probability, and rank.
      </div>
    );
  }

  const logits = node.candidates.map((c) => c.logit);
  const scored = score(logits, sampling);
  const target = scored[candidateIndex];
  const candidate = node.candidates[candidateIndex];

  return (
    <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-300">
      <div className="text-sm font-mono text-slate-100">{renderToken(candidate.text)}</div>
      <div className="flex justify-between">
        <span>Raw logit</span>
        <span className="font-mono">{candidate.logit.toFixed(3)}</span>
      </div>
      <div className="flex justify-between">
        <span>Softmax prob (T={sampling.temperature.toFixed(2)})</span>
        <span className="font-mono">{(target.prob * 100).toFixed(2)}%</span>
      </div>
      <div className="flex justify-between">
        <span>Rank</span>
        <span className="font-mono">#{target.rank + 1} of {node.candidates.length}</span>
      </div>
      <div className="flex justify-between">
        <span>Status</span>
        <span className={target.alive ? 'text-emerald-400' : 'text-slate-500'}>
          {target.alive ? 'kept by top-k/top-p' : 'cut by sampling'}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MathPanel.tsx
git commit -m "feat: math panel for hovered bubble (logit / softmax / rank)"
```

---

## Task 11: MeshCanvas component

**Files:**
- Create: `src/components/MeshCanvas.tsx`

- [ ] **Step 1: Create `src/components/MeshCanvas.tsx`**

```tsx
import { useMemo } from 'react';
import { useStore } from '../store';
import { score } from '../sampling';
import { renderToken } from '../tokens';
import type { CandidateToken, TreeNode } from '../types';

const COLUMN_WIDTH = 180;
const NODE_VERTICAL_SPACING = 40;
const MAX_BUBBLE_R = 26;
const MIN_BUBBLE_R = 6;

interface LaidOutBubble {
  nodeId: string;
  candidateIndex: number;
  candidate: CandidateToken;
  prob: number;
  alive: boolean;
  rank: number;
  x: number;
  y: number;
  r: number;
}

interface LaidOutEdge {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  alive: boolean;
}

function layout(
  nodes: Record<string, TreeNode>,
  rootId: string,
  sampling: ReturnType<typeof useStore.getState>['sampling']
): { bubbles: LaidOutBubble[]; edges: LaidOutEdge[]; width: number; height: number } {
  const bubbles: LaidOutBubble[] = [];
  const edges: LaidOutEdge[] = [];
  let maxColumn = 0;
  let maxRow = 0;

  function place(nodeId: string, depth: number, parentBubble: { x: number; y: number } | null): void {
    const node = nodes[nodeId];
    if (!node || !node.candidates) return;
    const x = depth * COLUMN_WIDTH + 80;
    const scored = score(node.candidates.map((c) => c.logit), sampling);
    const visibleCount = Math.min(node.candidates.length, 12);
    const startY = -(visibleCount - 1) * NODE_VERTICAL_SPACING / 2;
    for (let i = 0; i < visibleCount; i++) {
      const candidate = node.candidates[i];
      const s = scored[i];
      const y = startY + i * NODE_VERTICAL_SPACING + 200 + depth * 0;
      const r = MIN_BUBBLE_R + (MAX_BUBBLE_R - MIN_BUBBLE_R) * Math.sqrt(s.prob);
      bubbles.push({
        nodeId,
        candidateIndex: i,
        candidate,
        prob: s.prob,
        alive: s.alive,
        rank: s.rank,
        x,
        y,
        r
      });
      if (parentBubble) {
        edges.push({
          fromX: parentBubble.x,
          fromY: parentBubble.y,
          toX: x,
          toY: y,
          alive: s.alive
        });
      }
      maxColumn = Math.max(maxColumn, x + r + 20);
      maxRow = Math.max(maxRow, y + r + 20);

      const childId = `${nodeId}/${candidate.id}`;
      if (nodes[childId]) {
        place(childId, depth + 1, { x, y });
      }
    }
  }

  place(rootId, 0, null);
  return { bubbles, edges, width: Math.max(maxColumn, 600), height: Math.max(maxRow + 100, 500) };
}

export function MeshCanvas() {
  const nodes = useStore((s) => s.nodes);
  const rootId = useStore((s) => s.rootNodeId);
  const sampling = useStore((s) => s.sampling);
  const expand = useStore((s) => s.expand);
  const setHover = useStore((s) => s.setHover);

  const rootNode = nodes[rootId];

  const { bubbles, edges, width, height } = useMemo(
    () => layout(nodes, rootId, sampling),
    [nodes, rootId, sampling]
  );

  if (!rootNode || rootNode.status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Computing distribution...
      </div>
    );
  }

  if (rootNode.status === 'error') {
    return (
      <div className="flex h-full items-center justify-center text-red-400">
        Inference error: {rootNode.error}
      </div>
    );
  }

  if (!rootNode.candidates || rootNode.candidates.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Type a prompt below to see the mesh.
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto">
      <svg width={width} height={height} className="block">
        {edges.map((e, i) => (
          <line
            key={i}
            x1={e.fromX}
            y1={e.fromY}
            x2={e.toX}
            y2={e.toY}
            stroke="#5b9dff"
            strokeOpacity={e.alive ? 0.4 : 0.1}
          />
        ))}
        {bubbles.map((b) => (
          <g
            key={`${b.nodeId}-${b.candidateIndex}`}
            onMouseEnter={() => setHover(b.nodeId, b.candidateIndex)}
            onMouseLeave={() => setHover(null, null)}
            onClick={() => expand(b.nodeId, b.candidate)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={b.x}
              cy={b.y}
              r={b.r}
              fill="#5b9dff"
              fillOpacity={b.alive ? 0.3 + 0.7 * b.prob : 0.08}
              stroke="#5b9dff"
              strokeOpacity={b.alive ? 0.9 : 0.2}
            />
            <text
              x={b.x}
              y={b.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="ui-monospace, monospace"
              fontSize="11"
              fill={b.alive ? '#fff' : '#64748b'}
            >
              {renderToken(b.candidate.text)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MeshCanvas.tsx
git commit -m "feat: SVG mesh canvas — interactive tree of next-token bubbles"
```

---

## Task 12: ModelLoadOverlay component

**Files:**
- Create: `src/components/ModelLoadOverlay.tsx`

- [ ] **Step 1: Create `src/components/ModelLoadOverlay.tsx`**

```tsx
import { useStore } from '../store';

export function ModelLoadOverlay() {
  const status = useStore((s) => s.modelStatus);
  const error = useStore((s) => s.modelError);

  if (status === 'ready') return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur">
      <div className="max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 text-center">
        {status === 'loading' && (
          <>
            <div className="mb-3 text-lg font-medium">Loading GPT-2...</div>
            <div className="text-sm text-slate-400">
              First visit downloads ~122 MB of model weights. Cached after this.
            </div>
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full w-1/3 animate-pulse bg-blue-500" />
            </div>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="mb-3 text-lg font-medium text-red-400">Model failed to load</div>
            <div className="font-mono text-xs text-slate-400">{error}</div>
            <button
              className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm hover:bg-blue-500"
              onClick={() => location.reload()}
            >
              Reload
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ModelLoadOverlay.tsx
git commit -m "feat: model load / error overlay"
```

---

## Task 13: Wire everything in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
import { Controls } from './components/Controls';
import { MathPanel } from './components/MathPanel';
import { MeshCanvas } from './components/MeshCanvas';
import { ModelLoadOverlay } from './components/ModelLoadOverlay';
import { PromptInput } from './components/PromptInput';

export default function App() {
  return (
    <div className="relative grid h-full grid-cols-[1fr_320px] grid-rows-[1fr_auto] gap-3 bg-slate-950 p-3 text-slate-100">
      <div className="col-span-1 row-span-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/40">
        <MeshCanvas />
      </div>
      <div className="col-span-1 row-span-1 flex flex-col gap-3 overflow-y-auto">
        <Controls />
        <MathPanel />
      </div>
      <div className="col-span-2 row-span-1">
        <PromptInput />
      </div>
      <ModelLoadOverlay />
    </div>
  );
}
```

- [ ] **Step 2: Run dev server and verify visually**

Run: `npm run dev`
Open `http://localhost:5173`.
Expected sequence:
1. Page renders with "Loading GPT-2..." overlay.
2. After ~10–60 s on first run, overlay disappears.
3. Empty mesh canvas shows "Type a prompt below to see the mesh."
4. Type "The cat sat on the" and wait 150 ms.
5. A fan of bubbles appears, with "the" or "ground" or similar largest and brightest.
6. Drag temperature slider to 0.1 — most bubbles dim, top one stays bright.
7. Drag top-k to 1 — only one bubble lit.
8. Restore sliders, click a non-greedy bubble — its top-K children grow rightward.
9. Hover any bubble — Math Panel shows logit, softmax %, rank, kept/cut status.

If any step fails, fix the issue inline (see Task 14 for the smoke checklist) before committing.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: compose app layout (mesh + controls + math + prompt + overlay)"
```

---

## Task 14: Smoke-test pass

**Files:** none (manual verification)

- [ ] **Step 1: Run the design-spec smoke checklist (section 6 of the spec)**

With `npm run dev` running:
1. Type "The cat sat on the" → expect "the" / "a" / " " type tokens dominant. **PASS / FAIL**
2. Move temperature 1.0 → 0.1 → top-1 bubble's brightness saturates; rest dim. **PASS / FAIL**
3. Move temperature 1.0 → 2.0 → distribution flattens. **PASS / FAIL**
4. Set top-k = 1 → only one bubble visibly alive. **PASS / FAIL**
5. Click a non-greedy bubble → that path appended; new top-K appears rightward. **PASS / FAIL**
6. Reload page → model loads from IndexedDB cache (much faster). **PASS / FAIL**

- [ ] **Step 2: Fix any FAIL inline**

Examples of likely fixes:
- If sliders don't redraw the mesh, confirm `MeshCanvas`'s `useMemo` dependency includes `sampling`.
- If clicked bubble doesn't expand, confirm `expand()` is called with the parent node id (not the candidate's id).
- If math panel shows nothing on hover, confirm `setHover` is wired in `MeshCanvas` and `hoveredNodeId` reads from the store in `MathPanel`.

- [ ] **Step 3: Verify build succeeds**

Run: `npm run build`
Expected: `dist/` produced with no TS errors. Bundle size ~few hundred KB (model is fetched at runtime, not bundled).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: smoke-tested Tier 1 LLM visualizer"
```

---

## Self-review notes

Coverage check against the spec:

| Spec section | Tasks |
|---|---|
| 2 In scope: real GPT-2, interactive tree, math panel, sliders, auto-infer, click-to-expand | Tasks 4, 5, 6, 7, 8, 10, 11, 13 |
| 3 Decisions: client-side, transformers.js, Vite, TS, Tailwind, Zustand, Worker, hand-rolled SVG | Tasks 1, 4, 11 |
| 4 Architecture: store + worker + components | Tasks 4, 5, 6, 7, 8, 10, 11, 12, 13 |
| 5 Error handling: model load failure, worker errors, context truncation | Tasks 4 (worker post errors), 12 (overlay) — context truncation falls out from how transformers.js handles long inputs; not separately tested |
| 6 Testing: sampling.ts unit tests, manual smoke checklist | Tasks 3, 14 |
| 7 File layout | Tasks 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 |
| 8 Risks: BPE token rendering | Task 9 (`renderToken`) |

Type consistency: all task code uses the types from Task 2 (`TreeNode`, `CandidateToken`, `SamplingParams`, etc.). The store, worker, and components agree on signatures.

Placeholder scan: no TBDs or "implement later." Each step contains the actual code or command. Task 14 step 2 lists likely fixes by name rather than fixed code, which is appropriate (we can't predict failures, but we name the symptoms and the right files to look in).

One spec gap noted: **explicit context-truncation banner** (spec section 5) is not implemented — `transformers.js` truncates silently. Acceptable for P0 but flag it. Will appear in v2 polish.
