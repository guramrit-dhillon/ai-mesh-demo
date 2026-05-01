# Embeddings mode

The Embeddings view shows tokens as points in semantic 3D space — tokens with
similar meanings cluster together (animals near animals, colors near colors,
etc.).

## Default: synthetic clustered data

By default the app ships with a hand-curated dataset of ~200 English words
across 12 categories (animals, colors, emotions, places, foods, numbers,
time, tech, motion verbs, family, body, weather). Each category has its own
3D centroid; words within a category jitter inside a Gaussian cloud around
that centroid.

This dataset isn't extracted from GPT-2 — it's illustrative. It demonstrates
what the visualization looks like and how to read it (clusters = semantic
neighborhoods).

The data lives in [`src/embeddings/data.ts`](src/embeddings/data.ts).

## Real GPT-2 token embeddings

To swap in GPT-2's actual `wte` (word token embedding) matrix projected
through PCA:

```bash
pip install transformers scikit-learn numpy torch
python scripts/extract_embeddings.py
```

This writes `public/embeddings.json` containing the top 3000 most-frequent
GPT-2 tokens (filtered to ones containing letters) projected to 3D.

Then update `src/components/EmbeddingsCanvas.tsx` to fetch and render that
JSON instead of the synthetic data:

```ts
useEffect(() => {
  fetch('/embeddings.json')
    .then((r) => r.json())
    .then((data: { text: string; x: number; y: number; z: number }[]) => {
      // map data to ScatterNodes, set graphData
    });
}, []);
```

## Why other modes are stubbed

- **Attention** would map the model's internal attention scores between
  tokens — which input tokens did the next-token prediction "look at" most.
  Requires a custom ONNX re-export with `output_attentions=True`. The default
  `Xenova/gpt2` ONNX doesn't expose decoder self-attention.

- **Logit lens** projects each transformer layer's hidden state through the
  unembedding matrix to see what the model "thinks" the next token is at each
  depth. Requires `output_hidden_states=True` in a custom ONNX export.

Both require dropping below `@huggingface/transformers`'s high-level API and
calling `onnxruntime-web` directly. ~3-7 days of infra work each. The
predictions and embeddings modes work without any of that.
