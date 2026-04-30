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
