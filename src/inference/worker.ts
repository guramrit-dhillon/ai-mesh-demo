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
      dtype: 'int8'
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
  // reason: tokenizer call return type is a polymorphic union in the library types; casting to any to avoid inference failure
  const encoded = await (tokenizer as unknown as (text: string, opts: object) => Promise<unknown>)(safePrompt, { return_tensors: 'pt' });
  // reason: model forward pass return type is not narrowed; casting to any to access logits tensor
  const out = await (model as unknown as (inputs: unknown) => Promise<{ logits: import('@huggingface/transformers').Tensor }>)(encoded);

  const logits = out.logits;
  const lastIndex = logits.dims[1] - 1;
  const lastSlice = logits.slice(null, [lastIndex, lastIndex + 1], null);
  // reason: DataArray is a union of typed arrays and any[]; cast to Float32Array for numeric indexing
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
