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

  setPrompt: (prompt: string) => void;
  setSampling: (next: Partial<SamplingParams>) => void;
  setHover: (nodeId: string | null, candidateIndex: number | null) => void;
  expand: (parentNodeId: string, candidate: CandidateToken) => void;
  setTip: (nodeId: string) => void;
  setMode: (mode: VizMode) => void;
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

    setMode: (mode) => set({ mode })
  };
});
