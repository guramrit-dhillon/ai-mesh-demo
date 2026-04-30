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
  return () => { distributionListeners.delete(fn); };
}

export function onModelStatus(fn: ModelStatusListener): () => void {
  ensureWorker();
  modelStatusListeners.add(fn);
  return () => { modelStatusListeners.delete(fn); };
}
