import { create } from 'zustand';
import type {
  CandidateToken,
  ModelStatus,
  SamplingParams,
  TreeNode
} from './types';
import { onDistribution, onModelStatus, requestDistribution } from './inference/client';
import { softmax } from './sampling';

// Auto-lookahead: after a node's distribution arrives, if its top-1 token is
// confidently predicted, queue another inference one step further along that
// path. Each subsequent level requires stricter confidence (the model is
// effectively narrating the most likely continuation).
const LOOKAHEAD_THRESHOLDS = [0.45, 0.6, 0.75]; // depth 1, 2, 3
const MAX_LOOKAHEAD_DEPTH = LOOKAHEAD_THRESHOLDS.length;

function depthFromTip(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  tipNodeId: string
): number {
  let cur: TreeNode | undefined = nodes[nodeId];
  let depth = 0;
  while (cur) {
    if (cur.id === tipNodeId) return depth;
    if (!cur.parentId) return -1;
    cur = nodes[cur.parentId];
    depth++;
    if (depth > 32) return -1;
  }
  return -1;
}

export type VizMode = 'predictions' | 'embeddings' | 'attention' | 'logit-lens';

// Per-input-token attribution score: how much the baseline top-1 prediction
// drops when this token is removed. Higher = the model relied more on it.
export interface AttentionToken {
  text: string;
  attribution: number; // 0..1 (raw drop, clamped)
}

export interface AttentionResult {
  prompt: string;
  inputTokens: AttentionToken[];
  baselineTopText: string;
  baselineTopProb: number;
  // Top-5 alternative targets from the baseline pass — the UI uses these as
  // "what if I asked attribution against this token instead?" buttons.
  topCandidates: { id: number; text: string; prob: number }[];
}

// Logit-lens-style: at each prefix length k, what does the model predict
// the next token to be? `actual` is the real next token in the prompt;
// `predicted` is the top-1; matching them = the model would have generated
// this exact prompt.
export interface LogitLensStep {
  prefixText: string;       // full prefix decoded
  contextTail: string;      // last ~20 chars for the chain label
  actualNext: string | null; // the real next token (null at the final step)
  topPredictions: { text: string; prob: number }[];
}

export interface LogitLensResult {
  prompt: string;
  steps: LogitLensStep[];
}

interface AppState {
  prompt: string;
  rootNodeId: string;
  tipNodeId: string;
  nodes: Record<string, TreeNode>;
  hoveredNodeId: string | null;
  hoveredCandidateIndex: number | null;
  sampling: SamplingParams;
  modelStatus: ModelStatus['status'];
  modelError: string | null;
  mode: VizMode;
  embeddingSpread: number;
  embeddingTextSize: number;
  // Real embeddings — populated when the user clicks "Load real" in
  // EmbeddingsControls; until then the synthetic dataset is used.
  realEmbeddings: { text: string; category: string; x: number; y: number; z: number }[] | null;
  realEmbeddingProgress: { step: string; ratio: number } | null;
  // Attention / Logit Lens — both expensive (N inferences each), so they only
  // populate when the user explicitly clicks "compute".
  attentionResult: AttentionResult | null;
  attentionProgress: { step: string; ratio: number } | null;
  logitLensResult: LogitLensResult | null;
  logitLensProgress: { step: string; ratio: number } | null;
  // Predictions UI toggles — autoplay walks the top-1 chain at a fixed pace,
  // heatmap recolors candidates by probability instead of category.
  autoplay: boolean;
  heatmap: boolean;
  // Visual settings (Cycle 3.2 settings drawer writes these).
  perfMode: 'high' | 'low';
  accent: 'cyan' | 'violet' | 'emerald' | 'amber';
  // Embeddings UI state — search query, distance-tool selections, 2D toggle.
  embeddingSearch: string;
  embeddingTwoD: boolean;
  // The two selected point ids (`category/text`) for the distance tool.
  embeddingDistanceA: string | null;
  embeddingDistanceB: string | null;

  setPrompt: (prompt: string) => void;
  setSampling: (next: Partial<SamplingParams>) => void;
  setHover: (nodeId: string | null, candidateIndex: number | null) => void;
  expand: (parentNodeId: string, candidate: CandidateToken) => void;
  setTip: (nodeId: string) => void;
  setMode: (mode: VizMode) => void;
  setEmbeddingSpread: (v: number) => void;
  setEmbeddingTextSize: (v: number) => void;
  setRealEmbeddings: (pts: AppState['realEmbeddings']) => void;
  setRealEmbeddingProgress: (p: AppState['realEmbeddingProgress']) => void;
  setAttentionResult: (r: AttentionResult | null) => void;
  setAttentionProgress: (p: AppState['attentionProgress']) => void;
  setLogitLensResult: (r: LogitLensResult | null) => void;
  setLogitLensProgress: (p: AppState['logitLensProgress']) => void;
  setAutoplay: (v: boolean) => void;
  setHeatmap: (v: boolean) => void;
  setPerfMode: (v: 'high' | 'low') => void;
  setAccent: (v: AppState['accent']) => void;
  setEmbeddingSearch: (q: string) => void;
  setEmbeddingTwoD: (v: boolean) => void;
  // Toggle the distance tool: clicking a point picks A, then B; clicking again
  // resets the pair. Returns nothing.
  pickDistancePoint: (id: string) => void;
  clearDistance: () => void;
  // Autoplay convenience: pick the top-1 candidate of the current tip and
  // commit it as the new tip. No-op if the tip has no candidates yet.
  autoStepTopOne: () => void;
}

const ROOT_ID = 'root';

function makeNode(id: string, parentId: string | null, prompt: string): TreeNode {
  return {
    id,
    parentId,
    prompt,
    inputTokens: null,
    candidates: null,
    status: 'loading',
    error: null
  };
}

export const useStore = create<AppState>((set, get) => {
  onDistribution((nodeId, payload, error) => {
    set((state) => {
      const node = state.nodes[nodeId];
      if (!node) return state;
      const next: TreeNode = error
        ? { ...node, status: 'error', error }
        : {
            ...node,
            status: 'ready',
            inputTokens: payload!.inputTokens,
            candidates: payload!.candidates
          };
      return { nodes: { ...state.nodes, [nodeId]: next } };
    });

    // Auto-lookahead — only after a final batch (top-50). Streaming gives us
    // partial results too; we wait until the candidates list is meaningfully
    // complete before forecasting forward.
    if (error || !payload || payload.candidates.length < 30) return;
    const state = get();
    const node = state.nodes[nodeId];
    if (!node) return;
    const depth = depthFromTip(nodeId, state.nodes, state.tipNodeId);
    if (depth < 0 || depth >= MAX_LOOKAHEAD_DEPTH) return;

    // Highest-logit candidate is the top-1 (worker returns sorted desc).
    const top1 = payload.candidates[0];
    if (!top1) return;
    // Compute its softmax probability with the *current* sampling temperature.
    // Top-k/top-p don't matter here — the threshold just gauges raw confidence.
    const probs = softmax(
      payload.candidates.map((c) => c.logit),
      state.sampling.temperature
    );
    const top1Prob = probs[0];
    if (top1Prob < LOOKAHEAD_THRESHOLDS[depth]) return;

    const lookaheadId = `${nodeId}/${top1.id}`;
    if (state.nodes[lookaheadId]) return; // already exists or in flight

    const lookaheadPrompt = node.prompt + top1.text;
    const lookaheadNode = makeNode(lookaheadId, nodeId, lookaheadPrompt);
    set({ nodes: { ...get().nodes, [lookaheadId]: lookaheadNode } });
    requestDistribution(lookaheadId, lookaheadPrompt);
  });

  onModelStatus((msg) => {
    set({ modelStatus: msg.status, modelError: msg.error ?? null });
  });

  return {
    prompt: '',
    rootNodeId: ROOT_ID,
    tipNodeId: ROOT_ID,
    nodes: { [ROOT_ID]: makeNode(ROOT_ID, null, '') },
    hoveredNodeId: null,
    hoveredCandidateIndex: null,
    sampling: { temperature: 1.0, topK: 10, topP: 0.95 },
    modelStatus: 'loading',
    modelError: null,
    mode: 'predictions',
    embeddingSpread: 1.0,
    embeddingTextSize: 3.5,
    realEmbeddings: null,
    realEmbeddingProgress: null,
    attentionResult: null,
    attentionProgress: null,
    logitLensResult: null,
    logitLensProgress: null,
    autoplay: false,
    heatmap: false,
    perfMode: 'high',
    accent: 'cyan',
    embeddingSearch: '',
    embeddingTwoD: false,
    embeddingDistanceA: null,
    embeddingDistanceB: null,

    setPrompt: (prompt) => {
      const existingRoot = get().nodes[ROOT_ID];
      const root: TreeNode = {
        id: ROOT_ID,
        parentId: null,
        prompt,
        // Preserve last-known-good data so the canvas can render stale while new
        // inference is in flight — prevents a full Scene unmount on every keystroke.
        inputTokens: existingRoot?.inputTokens ?? null,
        candidates: existingRoot?.candidates ?? null,
        status: 'loading',
        error: null
      };
      set({
        prompt,
        nodes: { [ROOT_ID]: root },
        tipNodeId: ROOT_ID,
        hoveredNodeId: null,
        hoveredCandidateIndex: null
      });
      requestDistribution(ROOT_ID, prompt);
    },

    setSampling: (next) => set({ sampling: { ...get().sampling, ...next } }),

    setHover: (nodeId, candidateIndex) =>
      set({ hoveredNodeId: nodeId, hoveredCandidateIndex: candidateIndex }),

    expand: (parentNodeId, candidate) => {
      const parent = get().nodes[parentNodeId];
      if (!parent) return;
      const newPrompt = parent.prompt + candidate.text;
      const newId = `${parentNodeId}/${candidate.id}`;

      // Branching: when clicking a candidate from a non-tip position, prune
      // any descendants of the parent (the "old future") so the chain
      // visualization shows only the new branch.
      const allNodes = get().nodes;
      const descendantsToRemove = new Set<string>();
      const collect = (id: string) => {
        for (const n of Object.values(allNodes)) {
          if (n.parentId === id && n.id !== newId) {
            descendantsToRemove.add(n.id);
            collect(n.id);
          }
        }
      };
      collect(parentNodeId);

      const cleanedNodes: Record<string, TreeNode> = {};
      for (const [id, node] of Object.entries(allNodes)) {
        if (!descendantsToRemove.has(id)) cleanedNodes[id] = node;
      }

      if (cleanedNodes[newId]) {
        set({ nodes: cleanedNodes, tipNodeId: newId });
        return;
      }

      const node = makeNode(newId, parentNodeId, newPrompt);
      cleanedNodes[newId] = node;
      set({ nodes: cleanedNodes, tipNodeId: newId });
      requestDistribution(newId, newPrompt);
    },

    setTip: (nodeId) => {
      if (get().nodes[nodeId]) set({ tipNodeId: nodeId });
    },

    setMode: (mode) => set({ mode }),
    setEmbeddingSpread: (v) => set({ embeddingSpread: v }),
    setEmbeddingTextSize: (v) => set({ embeddingTextSize: v }),
    setRealEmbeddings: (pts) => set({ realEmbeddings: pts }),
    setRealEmbeddingProgress: (p) => set({ realEmbeddingProgress: p }),
    setAttentionResult: (r) => set({ attentionResult: r }),
    setAttentionProgress: (p) => set({ attentionProgress: p }),
    setLogitLensResult: (r) => set({ logitLensResult: r }),
    setLogitLensProgress: (p) => set({ logitLensProgress: p }),
    setAutoplay: (v) => set({ autoplay: v }),
    setHeatmap: (v) => set({ heatmap: v }),
    setPerfMode: (v) => set({ perfMode: v }),
    setAccent: (v) => set({ accent: v }),

    setEmbeddingSearch: (q) => set({ embeddingSearch: q }),
    setEmbeddingTwoD: (v) => set({ embeddingTwoD: v }),
    pickDistancePoint: (id) => {
      const { embeddingDistanceA, embeddingDistanceB } = get();
      // 3-state cycle: empty → A picked → both picked → empty.
      if (!embeddingDistanceA) {
        set({ embeddingDistanceA: id, embeddingDistanceB: null });
      } else if (!embeddingDistanceB && id !== embeddingDistanceA) {
        set({ embeddingDistanceB: id });
      } else {
        set({ embeddingDistanceA: id, embeddingDistanceB: null });
      }
    },
    clearDistance: () => set({ embeddingDistanceA: null, embeddingDistanceB: null }),

    autoStepTopOne: () => {
      const state = get();
      const tip = state.nodes[state.tipNodeId];
      if (!tip || !tip.candidates || tip.candidates.length === 0) return;
      // Reuse the existing expand() so branching/cleanup logic stays in one place.
      const top1 = tip.candidates[0];
      get().expand(state.tipNodeId, top1);
    }
  };
});
