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

const SWAPS = {
  [here('./src/lib/api.js')]: here('./src/demo/api.js'),
  [here('./src/lib/preview.jsx')]: here('./src/demo/preview.jsx')
};

export default defineConfig(({ mode }) => ({
  base: './',
  define: {
    'import.meta.env.VITE_DEMO': JSON.stringify('1'),
    'import.meta.env.VITE_DEMO_START': JSON.stringify(mode === 'admin' ? '/admin' : ''),
    // When this preview was built, shown in its banner, so an old copy kept
    // by a browser or app can be told from the current one.
    'import.meta.env.VITE_DEMO_BUILT': JSON.stringify(new Date().toLocaleString('en-GB', {
      timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    }))
  },
  // Swapped by what a file IS, not how an import spells it: "./api.js" from
  // inside src/lib is the same file as "../lib/api.js" from a component.
  plugins: [react(), {
    name: 'preview-swaps',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      const found = await this.resolve(source, importer, { ...options, skipSelf: true });
      return found && SWAPS[found.id] ? SWAPS[found.id] : null;
    }
  }],
  build: { outDir: `dist-preview/${mode === 'admin' ? 'admin' : 'shop'}`, emptyOutDir: true }
}));
