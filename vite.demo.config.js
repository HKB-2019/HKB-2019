import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/* The preview build: the real shop and admin, with src/demo/api.js standing
 * in for the server, so it runs as a page on its own with sample data.
 *
 *   npm run build:preview   → dist-preview/shop and dist-preview/admin
 *
 * Relative addresses (base './'), because a preview is served from a folder,
 * and pages after the # (HashRouter, in App.jsx). */
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_DEMO': JSON.stringify('1'),
    'import.meta.env.VITE_DEMO_START': JSON.stringify(mode === 'admin' ? '/admin' : '')
  },
  resolve: {
    alias: [
      { find: /^(\.\.?\/)+lib\/api\.js$/, replacement: here('./src/demo/api.js') },
      { find: /^(\.\.?\/)+lib\/preview\.jsx$/, replacement: here('./src/demo/preview.jsx') }
    ]
  },
  build: { outDir: `dist-preview/${mode === 'admin' ? 'admin' : 'shop'}`, emptyOutDir: true }
}));
