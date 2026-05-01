import { computeRawDistribution } from '../inference/client';
import { softmax } from '../sampling';
import type { AttentionResult, AttentionToken } from '../store';

// Hard cap to keep total inferences reasonable. With N input tokens we run
// N+1 forward passes, so 24 tokens = 25 passes ≈ 12-30s on a typical machine.
const MAX_TOKENS = 24;

type Progress = (step: string, ratio: number) => void;

export interface AttentionOptions {
  // If provided, the attribution target is this token id from the baseline
  // top-K instead of the model's natural top-1. Lets the user ask "which input
  // tokens drove the model toward THIS particular candidate?"
  targetId?: number;
  targetText?: string;
}

// Top-K candidates returned from the baseline pass — surfaced so the UI can
// offer them as alternative attribution targets without doing its own pass.
export interface AttentionBaseline {
  topCandidates: { id: number; text: string; prob: number }[];
}

// Ablation-based input attribution.
//
// What this measures:
//   1. Run the model on the full prompt — get baseline top-1 token T and its
//      probability p_baseline (softmax over the returned top-50 logits).
//   2. For each input token i, remove it from the prompt and re-run the model.
//      Look up T's probability in the new distribution → p_i. If T didn't
//      make the top-50, treat p_i ≈ 0.
//   3. Attribution_i = max(0, p_baseline - p_i). Larger drop = the model
//      relied more on token i to pick T.
//
// Why this isn't "real" attention:
//   Real attention weights live inside the transformer's self-attention layers
//   and aren't surfaced by the public Xenova/gpt2 ONNX. Ablation is a model-
//   agnostic input-attribution proxy that uses only the next-token logits we
//   already have. It answers "which words mattered" rather than "which words
//   did head h at layer ℓ attend to" — different question, real signal.
export async function computeAttention(
  prompt: string,
  onProgress: Progress,
  options: AttentionOptions = {}
): Promise<AttentionResult & AttentionBaseline> {
  // Baseline pass — gives us the input tokenization and the model's top-1.
  onProgress('baseline', 0.02);
  const baseline = await computeRawDistribution(prompt);
  const inputTokens = baseline.inputTokens;

  if (inputTokens.length === 0) {
    throw new Error('prompt has no tokens');
  }
  if (inputTokens.length < 2) {
    throw new Error('need at least 2 tokens to ablate (try a longer prompt)');
  }

  const tokens =
    inputTokens.length > MAX_TOKENS
      ? inputTokens.slice(inputTokens.length - MAX_TOKENS)
      : inputTokens;
  const trimmedFromStart = inputTokens.length - tokens.length;

  const baselineProbs = softmax(
    baseline.candidates.map((c) => c.logit),
    1.0
  );
  // Target selection: either user-chosen alternative or the natural top-1.
  let targetIdx = 0;
  if (options.targetId !== undefined) {
    const idx = baseline.candidates.findIndex((c) => c.id === options.targetId);
    if (idx >= 0) targetIdx = idx;
  }
  const baselineTop = baseline.candidates[targetIdx];
  const p_baseline = baselineProbs[targetIdx];

  // Bundle the top-5 baseline alternatives so the UI can show them as
  // re-target buttons without a second pass.
  const topCandidates = baseline.candidates.slice(0, 5).map((c, i) => ({
    id: c.id,
    text: c.text,
    prob: baselineProbs[i]
  }));

  // For each ablation, look up baselineTop.id in the counterfactual top-K.
  const attributions: AttentionToken[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const absoluteIndex = trimmedFromStart + i;
    onProgress(`ablating ${i + 1}/${tokens.length}`, 0.05 + (i / tokens.length) * 0.9);

    // Build the ablated prompt by joining all tokens except this one. Joining
    // .text reconstructs the prompt because the BPE decoder embeds the leading
    // space into the token's text (Ġword → " word").
    const ablatedTokens = inputTokens.filter((_, idx) => idx !== absoluteIndex);
    const ablatedPrompt = ablatedTokens.map((t) => t.text).join('');

    let p_i = 0;
    try {
      const cf = await computeRawDistribution(ablatedPrompt);
      const cfProbs = softmax(
        cf.candidates.map((c) => c.logit),
        1.0
      );
      const matchIdx = cf.candidates.findIndex((c) => c.id === baselineTop.id);
      if (matchIdx >= 0) p_i = cfProbs[matchIdx];
    } catch {
      // If the counterfactual fails (e.g. empty prompt edge case), treat as
      // maximum attribution — removing this token broke the input.
      p_i = 0;
    }

    const drop = Math.max(0, p_baseline - p_i);
    attributions.push({ text: tokens[i].text, attribution: drop });
  }

  // Normalize so the most influential token is 1.0 — easier to map to visual
  // intensity. We keep the raw drop intact for tooltips / debugging if needed.
  const maxDrop = Math.max(...attributions.map((a) => a.attribution), 1e-6);
  const normalized: AttentionToken[] = attributions.map((a) => ({
    text: a.text,
    attribution: a.attribution / maxDrop
  }));

  onProgress('done', 1);

  return {
    prompt,
    inputTokens: normalized,
    baselineTopText: baselineTop.text,
    baselineTopProb: p_baseline,
    topCandidates
  };
}
