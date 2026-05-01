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

// Cluster centers are arranged on (roughly) a sphere of radius ~100, so 30
// categories spread evenly across the volume. Within each cluster, words
// jitter with Gaussian noise around the centroid.
const CATEGORIES: Category[] = [
  // ── living things ──
  {
    name: 'animals-land',
    color: '#f87171',
    center: [-90, 30, 18],
    radius: 16,
    words: [
      'cat', 'dog', 'horse', 'cow', 'sheep', 'goat', 'pig', 'wolf', 'fox', 'bear',
      'tiger', 'lion', 'mouse', 'rabbit', 'deer', 'elephant', 'giraffe', 'zebra',
      'monkey', 'kangaroo', 'panda', 'leopard', 'cheetah', 'rhino', 'hippo',
      'donkey', 'camel', 'squirrel', 'raccoon', 'skunk'
    ]
  },
  {
    name: 'animals-marine',
    color: '#fb7185',
    center: [-50, 12, 80],
    radius: 14,
    words: [
      'fish', 'shark', 'whale', 'dolphin', 'octopus', 'squid', 'lobster', 'crab',
      'shrimp', 'jellyfish', 'starfish', 'eel', 'seal', 'walrus', 'turtle',
      'salmon', 'tuna', 'trout', 'bass', 'cod', 'oyster', 'clam', 'urchin'
    ]
  },
  {
    name: 'birds',
    color: '#fda4af',
    center: [-30, 80, -10],
    radius: 14,
    words: [
      'bird', 'eagle', 'hawk', 'owl', 'falcon', 'sparrow', 'robin', 'crow',
      'raven', 'pigeon', 'parrot', 'swan', 'duck', 'goose', 'chicken', 'rooster',
      'turkey', 'penguin', 'flamingo', 'pelican', 'peacock', 'hummingbird'
    ]
  },
  {
    name: 'plants',
    color: '#65a30d',
    center: [-20, 60, 70],
    radius: 18,
    words: [
      'tree', 'flower', 'rose', 'tulip', 'daisy', 'sunflower', 'oak', 'pine',
      'maple', 'birch', 'willow', 'palm', 'grass', 'leaf', 'root', 'branch',
      'seed', 'fruit', 'berry', 'cactus', 'fern', 'moss', 'vine', 'bush',
      'mushroom', 'orchid', 'lily', 'lotus', 'ivy'
    ]
  },
  {
    name: 'fruits',
    color: '#dc2626',
    center: [50, 70, 30],
    radius: 14,
    words: [
      'apple', 'banana', 'orange', 'grape', 'lemon', 'lime', 'strawberry',
      'blueberry', 'raspberry', 'mango', 'pineapple', 'peach', 'pear', 'plum',
      'cherry', 'watermelon', 'kiwi', 'coconut', 'papaya', 'apricot', 'fig',
      'pomegranate', 'avocado'
    ]
  },
  {
    name: 'foods',
    color: '#fb923c',
    center: [50, -40, 50],
    radius: 16,
    words: [
      'bread', 'cheese', 'rice', 'pasta', 'pizza', 'sandwich', 'soup', 'salad',
      'meat', 'chicken', 'beef', 'pork', 'lamb', 'sugar', 'salt', 'butter',
      'flour', 'egg', 'noodle', 'cake', 'cookie', 'pie', 'pancake', 'waffle',
      'burger', 'taco', 'sushi', 'curry', 'steak'
    ]
  },
  {
    name: 'drinks',
    color: '#fdba74',
    center: [88, -20, 18],
    radius: 12,
    words: [
      'water', 'milk', 'coffee', 'tea', 'juice', 'wine', 'beer', 'soda',
      'cocktail', 'whiskey', 'vodka', 'rum', 'champagne', 'lemonade', 'smoothie',
      'cider', 'cocoa'
    ]
  },

  // ── humans ──
  {
    name: 'family',
    color: '#f472b6',
    center: [70, 30, 70],
    radius: 14,
    words: [
      'mother', 'father', 'sister', 'brother', 'son', 'daughter', 'aunt', 'uncle',
      'cousin', 'grandmother', 'grandfather', 'parent', 'child', 'baby',
      'sibling', 'family', 'wife', 'husband', 'spouse', 'nephew', 'niece',
      'twin', 'in-law'
    ]
  },
  {
    name: 'body',
    color: '#eab308',
    center: [-70, 70, -50],
    radius: 16,
    words: [
      'head', 'eye', 'ear', 'nose', 'mouth', 'tooth', 'tongue', 'hair', 'arm',
      'hand', 'finger', 'leg', 'foot', 'toe', 'heart', 'brain', 'lung', 'liver',
      'kidney', 'stomach', 'skin', 'bone', 'muscle', 'blood', 'face', 'neck',
      'back', 'chest', 'shoulder', 'knee', 'elbow', 'wrist'
    ]
  },
  {
    name: 'emotions',
    color: '#ec4899',
    center: [-50, -70, 50],
    radius: 18,
    words: [
      'happy', 'sad', 'angry', 'afraid', 'love', 'hate', 'joy', 'fear',
      'surprise', 'disgust', 'calm', 'excited', 'anxious', 'proud', 'jealous',
      'lonely', 'grateful', 'hopeful', 'tired', 'worried', 'amused', 'bored',
      'embarrassed', 'guilty', 'curious', 'confused', 'frustrated', 'eager'
    ]
  },
  {
    name: 'occupations',
    color: '#a78bfa',
    center: [80, 60, -40],
    radius: 16,
    words: [
      'doctor', 'nurse', 'teacher', 'lawyer', 'engineer', 'scientist', 'artist',
      'writer', 'actor', 'musician', 'chef', 'farmer', 'pilot', 'driver',
      'soldier', 'police', 'firefighter', 'plumber', 'carpenter', 'electrician',
      'baker', 'banker', 'judge', 'priest', 'professor', 'student', 'athlete'
    ]
  },
  {
    name: 'names',
    color: '#fbbf24',
    center: [40, 0, 90],
    radius: 14,
    words: [
      'john', 'mary', 'james', 'sarah', 'michael', 'emma', 'william', 'olivia',
      'david', 'sophia', 'robert', 'isabella', 'thomas', 'amelia', 'daniel',
      'mia', 'matthew', 'charlotte', 'henry', 'ava', 'lucas', 'lily'
    ]
  },

  // ── places & geography ──
  {
    name: 'places-natural',
    color: '#22c55e',
    center: [20, 80, -50],
    radius: 18,
    words: [
      'forest', 'mountain', 'river', 'ocean', 'lake', 'desert', 'beach',
      'island', 'valley', 'canyon', 'jungle', 'meadow', 'cave', 'cliff',
      'glacier', 'volcano', 'plain', 'tundra', 'reef', 'pond', 'stream',
      'waterfall', 'savanna'
    ]
  },
  {
    name: 'places-built',
    color: '#16a34a',
    center: [10, 30, -88],
    radius: 16,
    words: [
      'city', 'town', 'village', 'building', 'house', 'office', 'school',
      'hospital', 'airport', 'station', 'street', 'road', 'highway', 'bridge',
      'tunnel', 'park', 'garden', 'square', 'plaza', 'mall', 'church',
      'temple', 'mosque', 'castle', 'palace', 'tower'
    ]
  },
  {
    name: 'cities',
    color: '#34d399',
    center: [-80, -20, -50],
    radius: 14,
    words: [
      'paris', 'tokyo', 'london', 'berlin', 'rome', 'madrid', 'sydney',
      'mumbai', 'cairo', 'moscow', 'dubai', 'beijing', 'seoul', 'bangkok',
      'amsterdam', 'vienna', 'prague', 'istanbul', 'lisbon', 'oslo'
    ]
  },

  // ── concepts ──
  {
    name: 'colors',
    color: '#facc15',
    center: [80, 50, -10],
    radius: 14,
    words: [
      'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'black',
      'white', 'gray', 'brown', 'cyan', 'magenta', 'crimson', 'azure', 'violet',
      'teal', 'amber', 'indigo', 'turquoise', 'maroon', 'beige', 'gold',
      'silver', 'bronze'
    ]
  },
  {
    name: 'numbers',
    color: '#6366f1',
    center: [-90, -20, -40],
    radius: 14,
    words: [
      'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
      'ten', 'eleven', 'twelve', 'twenty', 'fifty', 'hundred', 'thousand',
      'million', 'billion', 'first', 'second', 'third', 'half', 'double',
      'triple', 'quarter', 'dozen'
    ]
  },
  {
    name: 'time',
    color: '#06b6d4',
    center: [88, -8, 36],
    radius: 14,
    words: [
      'second', 'minute', 'hour', 'day', 'week', 'month', 'year', 'decade',
      'century', 'morning', 'noon', 'afternoon', 'evening', 'night', 'midnight',
      'today', 'tomorrow', 'yesterday', 'now', 'then', 'soon', 'late', 'early',
      'past', 'present', 'future'
    ]
  },
  {
    name: 'weather',
    color: '#38bdf8',
    center: [40, -80, -30],
    radius: 16,
    words: [
      'sun', 'moon', 'star', 'cloud', 'rain', 'snow', 'wind', 'storm', 'fog',
      'ice', 'hot', 'cold', 'warm', 'cool', 'thunder', 'lightning', 'rainbow',
      'sunshine', 'breeze', 'hail', 'sleet', 'frost', 'humid', 'dry', 'mist',
      'tornado', 'hurricane', 'blizzard', 'drought'
    ]
  },

  // ── activities ──
  {
    name: 'verbs-motion',
    color: '#a855f7',
    center: [-30, 10, -90],
    radius: 16,
    words: [
      'run', 'walk', 'jump', 'fly', 'swim', 'climb', 'fall', 'rise', 'move',
      'travel', 'arrive', 'leave', 'enter', 'exit', 'follow', 'chase', 'escape',
      'return', 'crawl', 'slide', 'roll', 'spin', 'twist', 'leap', 'sprint',
      'march', 'wander', 'race'
    ]
  },
  {
    name: 'verbs-thinking',
    color: '#c084fc',
    center: [-60, 50, 70],
    radius: 14,
    words: [
      'think', 'know', 'believe', 'doubt', 'guess', 'imagine', 'remember',
      'forget', 'understand', 'realize', 'wonder', 'consider', 'decide',
      'choose', 'reason', 'analyze', 'judge', 'compare', 'study', 'learn',
      'teach', 'recall', 'reflect', 'ponder'
    ]
  },
  {
    name: 'verbs-speech',
    color: '#d946ef',
    center: [60, -65, -30],
    radius: 14,
    words: [
      'say', 'speak', 'talk', 'tell', 'ask', 'answer', 'explain', 'describe',
      'whisper', 'shout', 'scream', 'mumble', 'argue', 'agree', 'disagree',
      'announce', 'declare', 'admit', 'deny', 'confess', 'reply', 'respond'
    ]
  },
  {
    name: 'sports',
    color: '#10b981',
    center: [-70, -50, 70],
    radius: 14,
    words: [
      'football', 'soccer', 'basketball', 'baseball', 'tennis', 'golf',
      'hockey', 'cricket', 'rugby', 'volleyball', 'swimming', 'cycling',
      'boxing', 'wrestling', 'skiing', 'skating', 'surfing', 'diving',
      'archery', 'fencing', 'bowling', 'sailing'
    ]
  },
  {
    name: 'music',
    color: '#f43f5e',
    center: [70, -60, 60],
    radius: 14,
    words: [
      'music', 'song', 'melody', 'rhythm', 'guitar', 'piano', 'violin', 'drum',
      'flute', 'trumpet', 'saxophone', 'harp', 'cello', 'bass', 'singer',
      'concert', 'orchestra', 'band', 'album', 'jazz', 'rock', 'pop', 'opera',
      'symphony'
    ]
  },

  // ── objects ──
  {
    name: 'tech',
    color: '#0ea5e9',
    center: [10, 20, 90],
    radius: 16,
    words: [
      'computer', 'phone', 'tablet', 'laptop', 'screen', 'keyboard', 'mouse',
      'internet', 'website', 'email', 'app', 'software', 'hardware', 'chip',
      'data', 'algorithm', 'code', 'server', 'network', 'cloud', 'database',
      'pixel', 'router', 'cable', 'modem', 'sensor', 'battery'
    ]
  },
  {
    name: 'vehicles',
    color: '#3b82f6',
    center: [80, 40, 30],
    radius: 14,
    words: [
      'car', 'truck', 'bus', 'train', 'plane', 'helicopter', 'boat', 'ship',
      'bike', 'motorcycle', 'scooter', 'taxi', 'subway', 'tram', 'rocket',
      'submarine', 'yacht', 'van', 'wagon', 'jet', 'glider', 'cruiser'
    ]
  },
  {
    name: 'tools',
    color: '#71717a',
    center: [60, 80, -60],
    radius: 14,
    words: [
      'hammer', 'screwdriver', 'wrench', 'saw', 'drill', 'pliers', 'nail',
      'screw', 'bolt', 'tape', 'rope', 'chain', 'ladder', 'shovel', 'rake',
      'axe', 'knife', 'scissors', 'needle', 'thread', 'glue'
    ]
  },
  {
    name: 'clothing',
    color: '#fb923c',
    center: [-80, 50, 50],
    radius: 14,
    words: [
      'shirt', 'pants', 'dress', 'skirt', 'jacket', 'coat', 'hat', 'cap',
      'shoe', 'boot', 'sock', 'glove', 'scarf', 'belt', 'tie', 'suit',
      'sweater', 'jeans', 'shorts', 'pajamas', 'uniform'
    ]
  },
  {
    name: 'furniture',
    color: '#a16207',
    center: [-40, -80, -40],
    radius: 14,
    words: [
      'chair', 'table', 'desk', 'bed', 'sofa', 'couch', 'bench', 'stool',
      'bookshelf', 'cabinet', 'drawer', 'wardrobe', 'mirror', 'lamp', 'rug',
      'curtain', 'pillow', 'blanket', 'mattress'
    ]
  },
  {
    name: 'materials',
    color: '#9ca3af',
    center: [30, -60, 80],
    radius: 14,
    words: [
      'wood', 'metal', 'iron', 'steel', 'gold', 'silver', 'copper', 'plastic',
      'glass', 'paper', 'cloth', 'leather', 'rubber', 'stone', 'concrete',
      'cement', 'sand', 'clay', 'fabric', 'cotton', 'wool', 'silk'
    ]
  },

  // ── descriptive ──
  {
    name: 'adjectives-size',
    color: '#84cc16',
    center: [80, -10, -70],
    radius: 12,
    words: [
      'big', 'small', 'large', 'tiny', 'huge', 'little', 'enormous', 'massive',
      'gigantic', 'mini', 'tall', 'short', 'long', 'wide', 'narrow', 'thick',
      'thin', 'broad', 'slim'
    ]
  },
  {
    name: 'adjectives-quality',
    color: '#bef264',
    center: [-60, -70, -20],
    radius: 14,
    words: [
      'good', 'bad', 'great', 'terrible', 'wonderful', 'awful', 'beautiful',
      'ugly', 'pretty', 'lovely', 'horrible', 'amazing', 'fantastic', 'poor',
      'rich', 'fine', 'excellent', 'perfect', 'awful', 'mediocre'
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

export function categoryNames(): string[] {
  return CATEGORIES.map((c) => c.name);
}
