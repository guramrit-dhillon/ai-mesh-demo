import { describe, expect, it } from 'vitest';
import { softmax, applyTopKTopP, score } from './sampling';

describe('softmax', () => {
  it('sums to 1 within float epsilon', () => {
    const probs = softmax([1, 2, 3, 4], 1.0);
    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it('preserves rank order', () => {
    const probs = softmax([0.1, -1, 2.5, 0.3], 1.0);
    // logit order: index2(2.5) > index3(0.3) > index0(0.1) > index1(-1)
    expect(probs[2]).toBeGreaterThan(probs[3]);
    expect(probs[3]).toBeGreaterThan(probs[0]);
    expect(probs[0]).toBeGreaterThan(probs[1]);
  });

  it('approaches one-hot at argmax as temperature shrinks', () => {
    const probs = softmax([1, 5, 2], 0.05);
    expect(probs[1]).toBeGreaterThan(0.99);
  });

  it('flattens toward uniform as temperature grows', () => {
    const probs = softmax([1, 5, 2], 100);
    expect(Math.max(...probs) - Math.min(...probs)).toBeLessThan(0.05);
  });

  it('is numerically stable for large logits', () => {
    const probs = softmax([1000, 1001, 999], 1.0);
    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
    expect(probs.every((p) => Number.isFinite(p))).toBe(true);
  });
});

describe('applyTopKTopP', () => {
  it('top-k=1 retains only the argmax', () => {
    const alive = applyTopKTopP([0.5, 0.3, 0.15, 0.05], 1, 1.0);
    expect(alive).toEqual([true, false, false, false]);
  });

  it('top-k=N retains all when N >= length', () => {
    const alive = applyTopKTopP([0.5, 0.3, 0.15, 0.05], 10, 1.0);
    expect(alive).toEqual([true, true, true, true]);
  });

  it('top-p stops once cumulative crosses threshold', () => {
    const alive = applyTopKTopP([0.5, 0.3, 0.15, 0.05], 100, 0.7);
    expect(alive).toEqual([true, true, false, false]);
  });

  it('top-p=1 retains all', () => {
    const alive = applyTopKTopP([0.5, 0.3, 0.15, 0.05], 100, 1.0);
    expect(alive).toEqual([true, true, true, true]);
  });

  it('top-k and top-p combine (whichever is more restrictive wins)', () => {
    const alive = applyTopKTopP([0.5, 0.3, 0.15, 0.05], 2, 1.0);
    expect(alive).toEqual([true, true, false, false]);
  });

  it('handles unsorted input correctly (operates on sorted view)', () => {
    const alive = applyTopKTopP([0.05, 0.5, 0.15, 0.3], 100, 0.7);
    expect(alive).toEqual([false, true, false, true]);
  });
});

describe('score', () => {
  it('returns one entry per logit with correct rank', () => {
    const result = score([1, 5, 2, 4], { temperature: 1.0, topK: 4, topP: 1.0 });
    expect(result).toHaveLength(4);
    expect(result[1].rank).toBe(0);
    expect(result[3].rank).toBe(1);
    expect(result[2].rank).toBe(2);
    expect(result[0].rank).toBe(3);
  });

  it('marks alive=false for tokens cut by top-k', () => {
    const result = score([1, 5, 2, 4], { temperature: 1.0, topK: 2, topP: 1.0 });
    expect(result[1].alive).toBe(true);
    expect(result[3].alive).toBe(true);
    expect(result[2].alive).toBe(false);
    expect(result[0].alive).toBe(false);
  });
});
