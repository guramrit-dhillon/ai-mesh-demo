import { computeRawDistribution } from '../inference/client';
import { softmax } from '../sampling';
import type { LogitLensResult, LogitLensStep } from '../store';

const MAX_STEPS = 20;
const TOP_N_PER_STEP = 3;

type Progress = (step: string, ratio: number) => void;

// "Logit lens"-style progressive prefix predictions.
//
// What this measures:
//   For each prefix length k = 1..N, run the model on tokens[0..k] and record
//   the top predictions for the next token. We compare each step's top-1
//   against the actual next token in the full prompt — if they match, the
//   model would have generated this exact word. If they don't, the model was
//   "surprised" by what came next.
//
// Why this isn't "real" logit lens:
//   The traditional logit lens taps the residual stream at every transformer
//   layer and projects it through the unembedding matrix to see how the
//   prediction crystallizes layer-by-layer. That requires output_hidden_states
//   from the model, which the public Xenova/gpt2 ONNX doesn't expose. This
//   per-prefix variant uses only the final-layer prediction at each token
//   boundary — different lens, but it captures the same "where did the model
//   commit to this prediction?" question across positions instead of layers.
export async function computeLogitLens(
  prompt: string,
  onProgress: Progress
): Promise<LogitLensResult> {
  // First pass — full prompt, gives us the tokenization.
  onProgress('tokenizing', 0.02);
  const baseline = await computeRawDistribution(prompt);
  const inputTokens = baseline.inputTokens;

  if (inputTokens.length === 0) {
    throw new Error('prompt has no tokens');
  }

  const tokens =
    inputTokens.length > MAX_STEPS
      ? inputTokens.slice(inputTokens.length - MAX_STEPS)
      : inputTokens;
  const offset = inputTokens.length - tokens.length;

  const steps: LogitLensStep[] = [];
  // For each prefix [0..k] (1 ≤ k ≤ tokens.length), run the model, record top
  // predictions, compare to the actual token at position k+offset.
  for (let k = 1; k <= tokens.length; k++) {
    onProgress(`prefix ${k}/${tokens.length}`, 0.05 + (k / tokens.length) * 0.9);

    const absoluteEnd = offset + k;
    const prefixTokens = inputTokens.slice(0, absoluteEnd);
    const prefixText = prefixTokens.map((t) => t.text).join('');

    let topPredictions: { text: string; prob: number }[];
    if (k === tokens.length && prefixText === prompt.replace(/\s+$/, '')) {
      // Reuse baseline result for the final step — same prompt, no need to
      // re-run.
      const probs = softmax(baseline.candidates.map((c) => c.logit), 1.0);
      topPredictions = baseline.candidates.slice(0, TOP_N_PER_STEP).map((c, i) => ({
        text: c.text,
        prob: probs[i]
      }));
    } else {
      const r = await computeRawDistribution(prefixText);
      const probs = softmax(r.candidates.map((c) => c.logit), 1.0);
      topPredictions = r.candidates.slice(0, TOP_N_PER_STEP).map((c, i) => ({
        text: c.text,
        prob: probs[i]
      }));
    }

    const actualNext =
      absoluteEnd < inputTokens.length ? inputTokens[absoluteEnd].text : null;

    // Last ~20 chars of the prefix make a readable label without crowding.
    const contextTail = prefixText.slice(-22);

    steps.push({
      prefixText,
      contextTail,
      actualNext,
      topPredictions
    });
  }

  onProgress('done', 1);
  return { prompt, steps };
}
