"""
Extract GPT-2's token embedding matrix and project it to 3D via PCA.
Writes the result to public/embeddings.json so the EmbeddingsCanvas can
load real GPT-2 wte vectors instead of the synthetic clustered placeholder.

Usage:
    pip install transformers scikit-learn numpy
    python scripts/extract_embeddings.py

Output:
    public/embeddings.json — array of {text, x, y, z} for top N most-frequent tokens.
"""

import json
import os
import re
import numpy as np
from sklearn.decomposition import PCA
from transformers import GPT2Model, GPT2Tokenizer

# How many of the most-frequent / lowest-id tokens to keep. The full vocab is
# 50,257 — too many to render. The first ~3000 BPE token ids in GPT-2 cover
# most common English words.
TOP_N = 3000


def main() -> None:
    print("Loading GPT-2…")
    tokenizer = GPT2Tokenizer.from_pretrained("gpt2")
    model = GPT2Model.from_pretrained("gpt2")

    # wte = word token embedding matrix. Shape: (50257, 768).
    wte = model.wte.weight.detach().cpu().numpy()
    print(f"wte shape: {wte.shape}")

    # Slice to the first TOP_N rows (BPE assigns lower ids to more common tokens).
    sub = wte[:TOP_N]

    print(f"Projecting {TOP_N} → 3D via PCA…")
    pca = PCA(n_components=3, whiten=True)
    coords = pca.fit_transform(sub)

    # Normalize to a reasonable visualization scale (~50 units).
    coords *= 35

    points = []
    for token_id in range(TOP_N):
        text = tokenizer.decode([token_id])
        # Skip pure-whitespace and unprintable tokens — they clutter the scene.
        if not text or not text.strip():
            continue
        if not re.search(r"[a-zA-Z]", text):
            continue
        points.append(
            {
                "text": text,
                "x": float(coords[token_id][0]),
                "y": float(coords[token_id][1]),
                "z": float(coords[token_id][2]),
            }
        )

    print(f"Kept {len(points)} legible tokens")

    out_dir = "public"
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "embeddings.json")
    with open(out_path, "w") as f:
        json.dump(points, f)

    print(f"Wrote {out_path}")
    print(
        f"Variance explained by 3 components: "
        f"{pca.explained_variance_ratio_.sum():.3f}"
    )


if __name__ == "__main__":
    main()
