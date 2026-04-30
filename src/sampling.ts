import type { SamplingParams } from './types';

export interface ScoredToken {
  index: number;
  prob: number;
  alive: boolean;
  rank: number;
}

export function softmax(logits: number[], temperature: number): number[] {
  const T = Math.max(temperature, 1e-6);
  const scaled = logits.map((l) => l / T);
  const maxL = Math.max(...scaled);
  const exps = scaled.map((l) => Math.exp(l - maxL));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export function applyTopKTopP(probs: number[], topK: number, topP: number): boolean[] {
  const sortedIndices = probs
    .map((_, i) => i)
    .sort((a, b) => probs[b] - probs[a]);
  const alive = new Array(probs.length).fill(false);
  let cumulative = 0;
  let kept = 0;
  for (const idx of sortedIndices) {
    if (kept >= topK) break;
    alive[idx] = true;
    cumulative += probs[idx];
    kept += 1;
    if (cumulative >= topP) break;
  }
  return alive;
}

export function score(logits: number[], params: SamplingParams): ScoredToken[] {
  const probs = softmax(logits, params.temperature);
  const alive = applyTopKTopP(probs, params.topK, params.topP);
  const sortedIndices = probs
    .map((_, i) => i)
    .sort((a, b) => probs[b] - probs[a]);
  const rankByIndex = new Map<number, number>();
  sortedIndices.forEach((idx, rank) => rankByIndex.set(idx, rank));
  return logits.map((_, i) => ({
    index: i,
    prob: probs[i],
    alive: alive[i],
    rank: rankByIndex.get(i)!
  }));
}
