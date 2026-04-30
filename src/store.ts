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
  tipNodeId: string;
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
  setTip: (nodeId: string) => void;
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
    }
  };
});
