/// <reference lib="webworker" />
import { AutoTokenizer, AutoModelForCausalLM, env } from '@huggingface/transformers';
import type {
  CandidateToken,
  InputToken,
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

// Stream the top-K back as progressively-larger batches. The model forward
// pass dominates latency, but once it's done, decoding 50 BPE tokens is
// noticeable (~30-100 ms). By posting top-3 first, then top-10, top-30, top-50,
// the user sees the most probable candidates appear first and the tail fills
// in shortly after — the mesh feels like it's growing instead of "popping" all
// at once.
async function streamDistribution(prompt: string, nodeId: string): Promise<void> {
  const tokenizer = await tokenizerPromise!;
  const model = await modelPromise!;

  // Trim trailing whitespace — GPT-2 BPE treats a trailing space as a separate
  // token, so "I'm going to " predicts "what starts a new word" (often
  // single letters). Strip it for inference.
  const trimmed = prompt.replace(/\s+$/, '');
  const safePrompt = trimmed.length === 0 ? '\n' : trimmed;
  // reason: tokenizer call return type is a polymorphic union in the library types
  const encoded = await (tokenizer as unknown as (text: string, opts: object) => Promise<{ input_ids: import('@huggingface/transformers').Tensor }>)(safePrompt, { return_tensors: 'pt' });

  const inputIdsTensor = encoded.input_ids;
  // reason: input_ids tensor data is BigInt64Array on most paths
  const inputIdsRaw = Array.from(inputIdsTensor.data as unknown as Iterable<number | bigint>).map((v) => Number(v));
  const inputTokens: InputToken[] = inputIdsRaw.map((id) => ({
    id,
    text: tokenizer.decode([id], { skip_special_tokens: false })
  }));

  // reason: model forward pass return type is not narrowed
  const out = await (model as unknown as (inputs: unknown) => Promise<{ logits: import('@huggingface/transformers').Tensor }>)(encoded);

  const logits = out.logits;
  const lastIndex = logits.dims[1] - 1;
  const lastSlice = logits.slice(null, [lastIndex, lastIndex + 1], null);
  const flat = Array.from(lastSlice.data as Float32Array);
  const indexed = flat.map((logit, id) => ({ id, logit }));
  indexed.sort((a, b) => b.logit - a.logit);
  const top = indexed.slice(0, TOP_K);

  // Eight checkpoints with growing batch sizes — and a real setTimeout-based
  // delay between each — so the candidates trickle in instead of arriving
  // simultaneously. Total reveal time ≈ 480 ms after the forward pass.
  const checkpoints = [3, 6, 10, 15, 22, 30, 40, TOP_K];
  const STEP_DELAY_MS = 70;
  let cpIndex = 0;
  const candidates: CandidateToken[] = [];
  for (let i = 0; i < TOP_K; i++) {
    candidates.push({
      id: top[i].id,
      logit: top[i].logit,
      text: tokenizer.decode([top[i].id], { skip_special_tokens: false })
    });
    if (cpIndex < checkpoints.length && i + 1 === checkpoints[cpIndex]) {
      post({
        type: 'distribution-response',
        nodeId,
        inputTokens,
        candidates: candidates.slice()
      });
      cpIndex++;
      // Real wall-clock delay between batches — the user perceives candidates
      // appearing in a sequence instead of a single dump.
      if (cpIndex < checkpoints.length) {
        await new Promise((r) => setTimeout(r, STEP_DELAY_MS));
      }
    }
  }
}

self.addEventListener('message', async (ev: MessageEvent<WorkerInbound>) => {
  const msg = ev.data;
  if (msg.type !== 'distribution-request') return;
  try {
    await ensureModel();
    await streamDistribution(msg.prompt, msg.nodeId);
  } catch (err) {
    post({
      type: 'distribution-error',
      nodeId: msg.nodeId,
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

ensureModel().catch(() => { /* status already posted */ });
