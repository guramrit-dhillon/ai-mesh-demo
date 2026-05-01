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

const CATEGORIES: Category[] = [
  {
    name: 'animals',
    color: '#fca5a5',
    center: [-40, 18, 12],
    radius: 9,
    words: [
      'cat', 'dog', 'horse', 'cow', 'sheep', 'goat', 'pig', 'wolf',
      'fox', 'bear', 'tiger', 'lion', 'mouse', 'rabbit', 'deer', 'bird',
      'eagle', 'hawk', 'owl', 'fish', 'shark', 'whale', 'snake', 'lizard'
    ]
  },
  {
    name: 'colors',
    color: '#fde68a',
    center: [38, 22, -8],
    radius: 7,
    words: [
      'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink',
      'black', 'white', 'gray', 'brown', 'cyan', 'magenta', 'crimson',
      'azure', 'violet', 'teal', 'amber', 'indigo'
    ]
  },
  {
    name: 'emotions',
    color: '#f9a8d4',
    center: [-20, -30, 20],
    radius: 10,
    words: [
      'happy', 'sad', 'angry', 'afraid', 'love', 'hate', 'joy', 'fear',
      'surprise', 'disgust', 'calm', 'excited', 'anxious', 'proud',
      'jealous', 'lonely', 'grateful', 'hopeful', 'tired'
    ]
  },
  {
    name: 'foods',
    color: '#fdba74',
    center: [22, -28, 16],
    radius: 9,
    words: [
      'apple', 'banana', 'bread', 'cheese', 'rice', 'pasta', 'pizza',
      'sandwich', 'soup', 'salad', 'meat', 'chicken', 'beef', 'fish',
      'sugar', 'salt', 'butter', 'milk', 'water', 'coffee', 'tea',
      'wine', 'beer', 'cake', 'cookie'
    ]
  },
  {
    name: 'places',
    color: '#86efac',
    center: [10, 35, -22],
    radius: 12,
    words: [
      'city', 'country', 'forest', 'mountain', 'river', 'ocean', 'lake',
      'desert', 'beach', 'island', 'park', 'garden', 'building', 'house',
      'office', 'school', 'hospital', 'airport', 'station', 'street',
      'paris', 'tokyo', 'london', 'berlin', 'rome'
    ]
  },
  {
    name: 'numbers',
    color: '#a5b4fc',
    center: [-38, -8, -18],
    radius: 7,
    words: [
      'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
      'nine', 'ten', 'hundred', 'thousand', 'million', 'billion',
      'first', 'second', 'third', 'half', 'double', 'triple'
    ]
  },
  {
    name: 'time',
    color: '#67e8f9',
    center: [44, -2, 18],
    radius: 8,
    words: [
      'second', 'minute', 'hour', 'day', 'week', 'month', 'year',
      'decade', 'century', 'morning', 'noon', 'evening', 'night',
      'today', 'tomorrow', 'yesterday', 'now', 'then', 'soon', 'late'
    ]
  },
  {
    name: 'tech',
    color: '#7dd3fc',
    center: [4, 8, 38],
    radius: 9,
    words: [
      'computer', 'phone', 'tablet', 'laptop', 'screen', 'keyboard',
      'mouse', 'internet', 'website', 'email', 'app', 'software',
      'hardware', 'chip', 'data', 'algorithm', 'code', 'server',
      'network', 'cloud', 'ai', 'robot'
    ]
  },
  {
    name: 'verbs-motion',
    color: '#c4b5fd',
    center: [-8, 4, -38],
    radius: 8,
    words: [
      'run', 'walk', 'jump', 'fly', 'swim', 'climb', 'fall', 'rise',
      'move', 'travel', 'arrive', 'leave', 'enter', 'exit', 'follow',
      'chase', 'escape', 'return', 'crawl', 'slide'
    ]
  },
  {
    name: 'family',
    color: '#fbcfe8',
    center: [30, 6, 30],
    radius: 7,
    words: [
      'mother', 'father', 'sister', 'brother', 'son', 'daughter',
      'aunt', 'uncle', 'cousin', 'grandmother', 'grandfather', 'parent',
      'child', 'baby', 'sibling', 'family', 'wife', 'husband'
    ]
  },
  {
    name: 'body',
    color: '#fef08a',
    center: [-30, 28, -30],
    radius: 8,
    words: [
      'head', 'eye', 'ear', 'nose', 'mouth', 'tooth', 'tongue', 'hair',
      'arm', 'hand', 'finger', 'leg', 'foot', 'toe', 'heart', 'brain',
      'skin', 'bone', 'blood', 'face'
    ]
  },
  {
    name: 'weather',
    color: '#bae6fd',
    center: [16, -36, -18],
    radius: 8,
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
