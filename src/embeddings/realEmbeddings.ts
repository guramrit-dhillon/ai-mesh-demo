// Compute REAL embeddings for our word list using a small sentence
// transformer (Xenova/all-MiniLM-L6-v2 — 384-dim, ~80MB). Then project
// 384-dim → 3-dim via PCA (power iteration on the covariance matrix).
//
// Unlike the synthetic data in data.ts (which I hand-curated), the positions
// here come from the model's actual learned semantic space — words that the
// model considers similar end up near each other in 3D, by the model's own
// definition rather than mine.

import type { EmbeddingPoint } from './data';

const ALL_WORDS = [
  // animals
  'cat', 'dog', 'horse', 'cow', 'sheep', 'goat', 'pig', 'wolf', 'fox', 'bear',
  'tiger', 'lion', 'mouse', 'rabbit', 'deer', 'elephant', 'giraffe', 'zebra',
  'monkey', 'kangaroo', 'panda', 'leopard', 'cheetah', 'rhino', 'hippo',
  'donkey', 'camel', 'squirrel', 'raccoon',
  'fish', 'shark', 'whale', 'dolphin', 'octopus', 'squid', 'lobster', 'crab',
  'shrimp', 'jellyfish', 'eel', 'seal', 'walrus', 'turtle', 'salmon', 'tuna',
  'bird', 'eagle', 'hawk', 'owl', 'falcon', 'sparrow', 'robin', 'crow', 'raven',
  'pigeon', 'parrot', 'swan', 'duck', 'goose', 'chicken', 'rooster', 'turkey',
  'penguin', 'flamingo', 'pelican', 'peacock', 'hummingbird',
  // plants
  'tree', 'flower', 'rose', 'tulip', 'daisy', 'sunflower', 'oak', 'pine',
  'maple', 'birch', 'willow', 'palm', 'grass', 'leaf', 'root', 'branch', 'seed',
  'cactus', 'fern', 'moss', 'vine', 'mushroom', 'orchid', 'lily', 'lotus',
  // fruits
  'apple', 'banana', 'orange', 'grape', 'lemon', 'lime', 'strawberry',
  'blueberry', 'raspberry', 'mango', 'pineapple', 'peach', 'pear', 'plum',
  'cherry', 'watermelon', 'kiwi', 'coconut', 'papaya', 'apricot', 'fig',
  'pomegranate', 'avocado',
  // foods
  'bread', 'cheese', 'rice', 'pasta', 'pizza', 'sandwich', 'soup', 'salad',
  'meat', 'beef', 'pork', 'lamb', 'sugar', 'salt', 'butter', 'flour', 'egg',
  'noodle', 'cake', 'cookie', 'pie', 'pancake', 'waffle', 'burger', 'taco',
  'sushi', 'curry', 'steak',
  // drinks
  'water', 'milk', 'coffee', 'tea', 'juice', 'wine', 'beer', 'soda', 'cocktail',
  'whiskey', 'vodka', 'rum', 'champagne', 'lemonade', 'smoothie', 'cider',
  // family
  'mother', 'father', 'sister', 'brother', 'son', 'daughter', 'aunt', 'uncle',
  'cousin', 'grandmother', 'grandfather', 'parent', 'child', 'baby', 'sibling',
  'family', 'wife', 'husband', 'spouse', 'nephew', 'niece', 'twin',
  // body
  'head', 'eye', 'ear', 'nose', 'mouth', 'tooth', 'tongue', 'hair', 'arm',
  'hand', 'finger', 'leg', 'foot', 'toe', 'heart', 'brain', 'lung', 'liver',
  'kidney', 'stomach', 'skin', 'bone', 'muscle', 'blood', 'face', 'neck',
  'back', 'chest', 'shoulder', 'knee', 'elbow', 'wrist',
  // emotions
  'happy', 'sad', 'angry', 'afraid', 'love', 'hate', 'joy', 'fear', 'surprise',
  'disgust', 'calm', 'excited', 'anxious', 'proud', 'jealous', 'lonely',
  'grateful', 'hopeful', 'tired', 'worried', 'amused', 'bored', 'embarrassed',
  'guilty', 'curious', 'confused', 'frustrated', 'eager',
  // occupations
  'doctor', 'nurse', 'teacher', 'lawyer', 'engineer', 'scientist', 'artist',
  'writer', 'actor', 'musician', 'chef', 'farmer', 'pilot', 'driver', 'soldier',
  'police', 'firefighter', 'plumber', 'carpenter', 'electrician', 'baker',
  'banker', 'judge', 'priest', 'professor', 'student', 'athlete',
  // names
  'john', 'mary', 'james', 'sarah', 'michael', 'emma', 'william', 'olivia',
  'david', 'sophia', 'robert', 'isabella', 'thomas', 'amelia', 'daniel', 'mia',
  'matthew', 'charlotte', 'henry', 'ava', 'lucas', 'lily',
  // places-natural
  'forest', 'mountain', 'river', 'ocean', 'lake', 'desert', 'beach', 'island',
  'valley', 'canyon', 'jungle', 'meadow', 'cave', 'cliff', 'glacier', 'volcano',
  'plain', 'tundra', 'reef', 'pond', 'stream', 'waterfall',
  // places-built
  'city', 'town', 'village', 'building', 'house', 'office', 'school',
  'hospital', 'airport', 'station', 'street', 'road', 'highway', 'bridge',
  'tunnel', 'park', 'garden', 'square', 'plaza', 'mall', 'church', 'temple',
  'mosque', 'castle', 'palace', 'tower',
  // cities
  'paris', 'tokyo', 'london', 'berlin', 'rome', 'madrid', 'sydney', 'mumbai',
  'cairo', 'moscow', 'dubai', 'beijing', 'seoul', 'bangkok', 'amsterdam',
  'vienna', 'prague', 'istanbul', 'lisbon', 'oslo',
  // colors
  'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'black',
  'white', 'gray', 'brown', 'cyan', 'magenta', 'crimson', 'azure', 'violet',
  'teal', 'amber', 'indigo', 'turquoise', 'maroon', 'beige', 'gold', 'silver',
  'bronze',
  // numbers
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'twenty', 'fifty', 'hundred', 'thousand',
  'million', 'billion', 'first', 'second', 'third', 'half', 'double', 'triple',
  // time
  'minute', 'hour', 'day', 'week', 'month', 'year', 'decade', 'century',
  'morning', 'noon', 'afternoon', 'evening', 'night', 'midnight', 'today',
  'tomorrow', 'yesterday', 'now', 'soon', 'late', 'early', 'past', 'present',
  'future',
  // weather
  'sun', 'moon', 'star', 'cloud', 'rain', 'snow', 'wind', 'storm', 'fog', 'ice',
  'hot', 'cold', 'warm', 'cool', 'thunder', 'lightning', 'rainbow', 'breeze',
  'hail', 'frost', 'humid', 'dry', 'mist', 'tornado', 'hurricane', 'blizzard',
  // motion
  'run', 'walk', 'jump', 'fly', 'swim', 'climb', 'fall', 'rise', 'move',
  'travel', 'arrive', 'leave', 'enter', 'exit', 'follow', 'chase', 'escape',
  'return', 'crawl', 'slide', 'spin', 'leap', 'sprint', 'march',
  // thinking
  'think', 'know', 'believe', 'doubt', 'guess', 'imagine', 'remember', 'forget',
  'understand', 'realize', 'wonder', 'consider', 'decide', 'choose', 'reason',
  'analyze', 'judge', 'compare', 'study', 'learn', 'teach',
  // speech
  'say', 'speak', 'talk', 'tell', 'ask', 'answer', 'explain', 'describe',
  'whisper', 'shout', 'scream', 'argue', 'agree', 'disagree', 'announce',
  'declare', 'admit', 'deny', 'confess', 'reply',
  // sports
  'football', 'soccer', 'basketball', 'baseball', 'tennis', 'golf', 'hockey',
  'cricket', 'rugby', 'volleyball', 'swimming', 'cycling', 'boxing',
  'wrestling', 'skiing', 'skating', 'surfing', 'diving', 'archery', 'fencing',
  'bowling', 'sailing',
  // music
  'music', 'song', 'melody', 'rhythm', 'guitar', 'piano', 'violin', 'drum',
  'flute', 'trumpet', 'saxophone', 'harp', 'cello', 'singer', 'concert',
  'orchestra', 'band', 'album', 'jazz', 'rock', 'pop', 'opera', 'symphony',
  // tech
  'computer', 'phone', 'tablet', 'laptop', 'screen', 'keyboard', 'internet',
  'website', 'email', 'app', 'software', 'hardware', 'chip', 'data',
  'algorithm', 'code', 'server', 'network', 'cloud', 'database', 'pixel',
  'router', 'sensor', 'battery',
  // vehicles
  'car', 'truck', 'bus', 'train', 'plane', 'helicopter', 'boat', 'ship', 'bike',
  'motorcycle', 'scooter', 'taxi', 'subway', 'tram', 'rocket', 'submarine',
  'yacht', 'van', 'wagon', 'jet',
  // tools
  'hammer', 'screwdriver', 'wrench', 'saw', 'drill', 'pliers', 'nail', 'screw',
  'bolt', 'tape', 'rope', 'chain', 'ladder', 'shovel', 'rake', 'axe', 'knife',
  'scissors', 'needle', 'thread', 'glue',
  // clothing
  'shirt', 'pants', 'dress', 'skirt', 'jacket', 'coat', 'hat', 'cap', 'shoe',
  'boot', 'sock', 'glove', 'scarf', 'belt', 'tie', 'suit', 'sweater', 'jeans',
  'shorts', 'pajamas',
  // furniture
  'chair', 'table', 'desk', 'bed', 'sofa', 'couch', 'bench', 'stool',
  'bookshelf', 'cabinet', 'drawer', 'wardrobe', 'mirror', 'lamp', 'rug',
  'curtain', 'pillow', 'blanket', 'mattress',
  // materials
  'wood', 'metal', 'iron', 'steel', 'copper', 'plastic', 'glass', 'paper',
  'cloth', 'leather', 'rubber', 'stone', 'concrete', 'cement', 'sand', 'clay',
  'fabric', 'cotton', 'wool', 'silk',
  // size
  'big', 'small', 'large', 'tiny', 'huge', 'little', 'enormous', 'massive',
  'gigantic', 'tall', 'short', 'long', 'wide', 'narrow', 'thick', 'thin',
  'broad',
  // quality
  'good', 'bad', 'great', 'terrible', 'wonderful', 'awful', 'beautiful', 'ugly',
  'pretty', 'lovely', 'horrible', 'amazing', 'fantastic', 'poor', 'rich',
  'fine', 'excellent', 'perfect'
];

// Map word → its synthetic category, used to color real-embedding points so
// the user can see whether the real model agrees with our category assignments.
function categoryForWord(): Map<string, string> {
  // We mirror the chunks above. Maintain in lockstep with the array order.
  // The iterators below define each chunk's start word + its category label.
  const chunkBoundaries: { startWord: string; category: string }[] = [
    { startWord: 'cat', category: 'animals-land' },
    { startWord: 'fish', category: 'animals-marine' },
    { startWord: 'bird', category: 'birds' },
    { startWord: 'tree', category: 'plants' },
    { startWord: 'apple', category: 'fruits' },
    { startWord: 'bread', category: 'foods' },
    { startWord: 'water', category: 'drinks' },
    { startWord: 'mother', category: 'family' },
    { startWord: 'head', category: 'body' },
    { startWord: 'happy', category: 'emotions' },
    { startWord: 'doctor', category: 'occupations' },
    { startWord: 'john', category: 'names' },
    { startWord: 'forest', category: 'places-natural' },
    { startWord: 'city', category: 'places-built' },
    { startWord: 'paris', category: 'cities' },
    { startWord: 'red', category: 'colors' },
    { startWord: 'one', category: 'numbers' },
    { startWord: 'minute', category: 'time' },
    { startWord: 'sun', category: 'weather' },
    { startWord: 'run', category: 'verbs-motion' },
    { startWord: 'think', category: 'verbs-thinking' },
    { startWord: 'say', category: 'verbs-speech' },
    { startWord: 'football', category: 'sports' },
    { startWord: 'music', category: 'music' },
    { startWord: 'computer', category: 'tech' },
    { startWord: 'car', category: 'vehicles' },
    { startWord: 'hammer', category: 'tools' },
    { startWord: 'shirt', category: 'clothing' },
    { startWord: 'chair', category: 'furniture' },
    { startWord: 'wood', category: 'materials' },
    { startWord: 'big', category: 'adjectives-size' },
    { startWord: 'good', category: 'adjectives-quality' }
  ];

  const map = new Map<string, string>();
  let cursor = 0;
  for (const { startWord, category } of chunkBoundaries) {
    while (cursor < ALL_WORDS.length && ALL_WORDS[cursor] !== startWord) cursor++;
    if (cursor >= ALL_WORDS.length) break;
    let next = cursor + 1;
    while (next < ALL_WORDS.length) {
      const isBoundary = chunkBoundaries.some(
        (b) => b.startWord === ALL_WORDS[next] && b.category !== category
      );
      if (isBoundary) break;
      next++;
    }
    for (let i = cursor; i < next; i++) {
      map.set(ALL_WORDS[i], category);
    }
    cursor = next;
  }
  return map;
}

// Standard PCA via covariance + power iteration. For ~600 vectors of dim 384
// this runs in a couple hundred ms in the browser.
function pca3(vectors: Float32Array[]): Array<[number, number, number]> {
  const n = vectors.length;
  const d = vectors[0].length;

  // Mean-center
  const mean = new Float32Array(d);
  for (const v of vectors) for (let i = 0; i < d; i++) mean[i] += v[i];
  for (let i = 0; i < d; i++) mean[i] /= n;
  const centered = vectors.map((v) => {
    const c = new Float32Array(d);
    for (let i = 0; i < d; i++) c[i] = v[i] - mean[i];
    return c;
  });

  // Covariance matrix (d × d). Symmetric.
  const cov = new Float32Array(d * d);
  for (const v of centered) {
    for (let i = 0; i < d; i++) {
      const vi = v[i];
      const row = i * d;
      for (let j = i; j < d; j++) {
        cov[row + j] += vi * v[j];
      }
    }
  }
  for (let i = 0; i < d; i++) {
    for (let j = i; j < d; j++) {
      cov[i * d + j] /= n;
      cov[j * d + i] = cov[i * d + j];
    }
  }

  // Helper: matrix-vector product Ax
  function mv(A: Float32Array, x: Float32Array): Float32Array {
    const out = new Float32Array(d);
    for (let i = 0; i < d; i++) {
      let s = 0;
      const row = i * d;
      for (let j = 0; j < d; j++) s += A[row + j] * x[j];
      out[i] = s;
    }
    return out;
  }

  function normalize(v: Float32Array): Float32Array {
    let s = 0;
    for (let i = 0; i < d; i++) s += v[i] * v[i];
    const norm = Math.sqrt(s) || 1;
    for (let i = 0; i < d; i++) v[i] /= norm;
    return v;
  }

  // Power iteration to find top 3 eigenvectors
  function topEigenvector(A: Float32Array): Float32Array {
    const v = new Float32Array(d);
    for (let i = 0; i < d; i++) v[i] = Math.random() - 0.5;
    normalize(v);
    let cur: Float32Array = v;
    for (let iter = 0; iter < 80; iter++) {
      const next = mv(A, cur);
      normalize(next);
      cur = next;
    }
    return cur;
  }

  function deflate(A: Float32Array, ev: Float32Array): Float32Array {
    // A := A - λ vv^T   where λ = v^T A v
    const Av = mv(A, ev);
    let lambda = 0;
    for (let i = 0; i < d; i++) lambda += ev[i] * Av[i];
    const out = new Float32Array(A);
    for (let i = 0; i < d; i++) {
      const row = i * d;
      for (let j = 0; j < d; j++) {
        out[row + j] -= lambda * ev[i] * ev[j];
      }
    }
    return out;
  }

  const e1 = topEigenvector(cov);
  const cov2 = deflate(cov, e1);
  const e2 = topEigenvector(cov2);
  const cov3 = deflate(cov2, e2);
  const e3 = topEigenvector(cov3);

  // Project each centered vector onto [e1, e2, e3]
  const result: Array<[number, number, number]> = centered.map((v) => {
    let p1 = 0, p2 = 0, p3 = 0;
    for (let i = 0; i < d; i++) {
      p1 += v[i] * e1[i];
      p2 += v[i] * e2[i];
      p3 += v[i] * e3[i];
    }
    return [p1, p2, p3];
  });

  // Normalize the spread to ~±100 on each axis
  let maxAbs = 0;
  for (const p of result) {
    if (Math.abs(p[0]) > maxAbs) maxAbs = Math.abs(p[0]);
    if (Math.abs(p[1]) > maxAbs) maxAbs = Math.abs(p[1]);
    if (Math.abs(p[2]) > maxAbs) maxAbs = Math.abs(p[2]);
  }
  const scale = maxAbs > 0 ? 100 / maxAbs : 1;
  return result.map(([a, b, c]) => [a * scale, b * scale, c * scale]);
}

export async function computeRealEmbeddings(
  onProgress: (step: string, ratio: number) => void
): Promise<EmbeddingPoint[]> {
  onProgress('loading model', 0.05);
  const { pipeline } = await import('@huggingface/transformers');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractor: any = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  onProgress('embedding words', 0.4);
  const words = ALL_WORDS;
  // Batch-encode in chunks
  const vectors: Float32Array[] = [];
  const BATCH = 64;
  for (let i = 0; i < words.length; i += BATCH) {
    const chunk = words.slice(i, i + BATCH);
    const out = await extractor(chunk, { pooling: 'mean', normalize: true });
    // out.data is Float32Array of shape [chunk.length * 384]
    const dim = (out.dims as number[])[1];
    const flat = out.data as Float32Array;
    for (let k = 0; k < chunk.length; k++) {
      vectors.push(flat.slice(k * dim, (k + 1) * dim));
    }
    onProgress('embedding words', 0.4 + 0.5 * Math.min(1, (i + BATCH) / words.length));
  }

  onProgress('projecting to 3D', 0.92);
  const coords = pca3(vectors);

  const catMap = categoryForWord();
  const points: EmbeddingPoint[] = words.map((w, i) => ({
    text: w,
    category: catMap.get(w) ?? 'other',
    x: coords[i][0],
    y: coords[i][1],
    z: coords[i][2]
  }));

  onProgress('done', 1);
  return points;
}
