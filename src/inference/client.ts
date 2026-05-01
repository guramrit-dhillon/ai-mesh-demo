import type {
  CandidateToken,
  InputToken,
  ModelStatus,
  WorkerInbound,
  WorkerOutbound
} from '../types';

type DistributionListener = (
  nodeId: string,
  payload: { inputTokens: InputToken[]; candidates: CandidateToken[] } | null,
  error: string | null
) => void;

type ModelStatusListener = (status: ModelStatus) => void;

let worker: Worker | null = null;
const distributionListeners = new Set<DistributionListener>();
const modelStatusListeners = new Set<ModelStatusListener>();

interface RawPending {
  resolve: (payload: { inputTokens: InputToken[]; candidates: CandidateToken[] }) => void;
  reject: (err: Error) => void;
}
const rawPending = new Map<string, RawPending>();
let rawCounter = 0;

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (ev: MessageEvent<WorkerOutbound>) => {
    const msg = ev.data;
    if (msg.type === 'distribution-response') {
      const payload = { inputTokens: msg.inputTokens, candidates: msg.candidates };
      for (const fn of distributionListeners) fn(msg.nodeId, payload, null);
    } else if (msg.type === 'distribution-error') {
      for (const fn of distributionListeners) fn(msg.nodeId, null, msg.error);
    } else if (msg.type === 'model-status') {
      for (const fn of modelStatusListeners) fn(msg);
    } else if (msg.type === 'raw-distribution-response') {
      const p = rawPending.get(msg.requestId);
      if (p) {
        rawPending.delete(msg.requestId);
        p.resolve({ inputTokens: msg.inputTokens, candidates: msg.candidates });
      }
    } else if (msg.type === 'raw-distribution-error') {
      const p = rawPending.get(msg.requestId);
      if (p) {
        rawPending.delete(msg.requestId);
        p.reject(new Error(msg.error));
      }
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
  return () => { distributionListeners.delete(fn); };
}

export function onModelStatus(fn: ModelStatusListener): () => void {
  ensureWorker();
  modelStatusListeners.add(fn);
  return () => { modelStatusListeners.delete(fn); };
}

// Promise-based single-shot inference. Each call gets a unique requestId so
// many in-flight requests don't tangle. Used by Attention (ablation passes)
// and Logit Lens (per-prefix passes) where we fire N inferences and await each.
export function computeRawDistribution(
  prompt: string
): Promise<{ inputTokens: InputToken[]; candidates: CandidateToken[] }> {
  const w = ensureWorker();
  const requestId = `raw-${++rawCounter}`;
  return new Promise((resolve, reject) => {
    rawPending.set(requestId, { resolve, reject });
    w.postMessage({ type: 'raw-distribution-request', requestId, prompt } as WorkerInbound);
  });
}
