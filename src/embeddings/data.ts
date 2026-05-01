// Synthetic embedding dataset with semantic clusters. Each category lives in
// its own region of 3D space; the points jitter inside their cluster so they
// look like a real PCA projection. Replace this with real GPT-2 token
// embeddings via scripts/extract_embeddings.py — see EMBEDDINGS.md.

export interface EmbeddingPoint {
  text: string;
  category: string;
  x: number;
  y: number;
  z: number;
}

interface Category {
  name: string;
  color: string;
  center: [number, number, number];
  radius: number;
  words: string[];
}

// Positions are spread across ~±100 units so the ~200 sprites don't overlap.
// Colors are darker (300-level Tailwind tones) so bloom doesn't wash them out.
const CATEGORIES: Category[] = [
  {
    name: 'animals',
    color: '#f87171',
    center: [-80, 36, 24],
    radius: 18,
    words: [
      'cat', 'dog', 'horse', 'cow', 'sheep', 'goat', 'pig', 'wolf',
      'fox', 'bear', 'tiger', 'lion', 'mouse', 'rabbit', 'deer', 'bird',
      'eagle', 'hawk', 'owl', 'fish', 'shark', 'whale', 'snake', 'lizard'
    ]
  },
  {
    name: 'colors',
    color: '#facc15',
    center: [76, 44, -16],
    radius: 14,
    words: [
      'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink',
      'black', 'white', 'gray', 'brown', 'cyan', 'magenta', 'crimson',
      'azure', 'violet', 'teal', 'amber', 'indigo'
    ]
  },
  {
    name: 'emotions',
    color: '#ec4899',
    center: [-40, -60, 40],
    radius: 20,
    words: [
      'happy', 'sad', 'angry', 'afraid', 'love', 'hate', 'joy', 'fear',
      'surprise', 'disgust', 'calm', 'excited', 'anxious', 'proud',
      'jealous', 'lonely', 'grateful', 'hopeful', 'tired'
    ]
  },
  {
    name: 'foods',
    color: '#fb923c',
    center: [44, -56, 32],
    radius: 18,
    words: [
      'apple', 'banana', 'bread', 'cheese', 'rice', 'pasta', 'pizza',
      'sandwich', 'soup', 'salad', 'meat', 'chicken', 'beef', 'fish',
      'sugar', 'salt', 'butter', 'milk', 'water', 'coffee', 'tea',
      'wine', 'beer', 'cake', 'cookie'
    ]
  },
  {
    name: 'places',
    color: '#22c55e',
    center: [20, 70, -44],
    radius: 24,
    words: [
      'city', 'country', 'forest', 'mountain', 'river', 'ocean', 'lake',
      'desert', 'beach', 'island', 'park', 'garden', 'building', 'house',
      'office', 'school', 'hospital', 'airport', 'station', 'street',
      'paris', 'tokyo', 'london', 'berlin', 'rome'
    ]
  },
  {
    name: 'numbers',
    color: '#6366f1',
    center: [-76, -16, -36],
    radius: 14,
    words: [
      'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
      'nine', 'ten', 'hundred', 'thousand', 'million', 'billion',
      'first', 'second', 'third', 'half', 'double', 'triple'
    ]
  },
  {
    name: 'time',
    color: '#06b6d4',
    center: [88, -4, 36],
    radius: 16,
    words: [
      'second', 'minute', 'hour', 'day', 'week', 'month', 'year',
      'decade', 'century', 'morning', 'noon', 'evening', 'night',
      'today', 'tomorrow', 'yesterday', 'now', 'then', 'soon', 'late'
    ]
  },
  {
    name: 'tech',
    color: '#0ea5e9',
    center: [8, 16, 76],
    radius: 18,
    words: [
      'computer', 'phone', 'tablet', 'laptop', 'screen', 'keyboard',
      'mouse', 'internet', 'website', 'email', 'app', 'software',
      'hardware', 'chip', 'data', 'algorithm', 'code', 'server',
      'network', 'cloud', 'ai', 'robot'
    ]
  },
  {
    name: 'verbs-motion',
    color: '#a855f7',
    center: [-16, 8, -76],
    radius: 16,
    words: [
      'run', 'walk', 'jump', 'fly', 'swim', 'climb', 'fall', 'rise',
      'move', 'travel', 'arrive', 'leave', 'enter', 'exit', 'follow',
      'chase', 'escape', 'return', 'crawl', 'slide'
    ]
  },
  {
    name: 'family',
    color: '#f472b6',
    center: [60, 12, 60],
    radius: 14,
    words: [
      'mother', 'father', 'sister', 'brother', 'son', 'daughter',
      'aunt', 'uncle', 'cousin', 'grandmother', 'grandfather', 'parent',
      'child', 'baby', 'sibling', 'family', 'wife', 'husband'
    ]
  },
  {
    name: 'body',
    color: '#eab308',
    center: [-60, 56, -60],
    radius: 16,
    words: [
      'head', 'eye', 'ear', 'nose', 'mouth', 'tooth', 'tongue', 'hair',
      'arm', 'hand', 'finger', 'leg', 'foot', 'toe', 'heart', 'brain',
      'skin', 'bone', 'blood', 'face'
    ]
  },
  {
    name: 'weather',
    color: '#38bdf8',
    center: [32, -72, -36],
    radius: 16,
    words: [
      'sun', 'moon', 'star', 'cloud', 'rain', 'snow', 'wind', 'storm',
      'fog', 'ice', 'hot', 'cold', 'warm', 'cool', 'thunder', 'lightning',
      'rainbow', 'sunshine', 'breeze'
    ]
  }
];

// Deterministic pseudo-random so the cluster shapes are stable across renders.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  // Box-Muller
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function buildEmbeddingPoints(): EmbeddingPoint[] {
  const points: EmbeddingPoint[] = [];
  let seed = 1;
  for (const cat of CATEGORIES) {
    const rand = mulberry32(seed++);
    for (const word of cat.words) {
      const dx = gaussian(rand) * cat.radius * 0.6;
      const dy = gaussian(rand) * cat.radius * 0.6;
      const dz = gaussian(rand) * cat.radius * 0.6;
      points.push({
        text: word,
        category: cat.name,
        x: cat.center[0] + dx,
        y: cat.center[1] + dy,
        z: cat.center[2] + dz
      });
    }
  }
  return points;
}

export function categoryColor(name: string): string {
  return CATEGORIES.find((c) => c.name === name)?.color ?? '#7ce4ff';
}
