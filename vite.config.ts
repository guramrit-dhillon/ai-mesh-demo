import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this repo at /ai-mesh-demo/, so production builds need
// asset URLs prefixed accordingly. Dev server keeps the root path so local
// `npm run dev` continues to work unchanged.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/ai-mesh-demo/' : '/',
  plugins: [react()],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@huggingface/transformers'] }
}));
