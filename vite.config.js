import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset URLs, so the build runs from any path, not just a domain root.
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    // so the browser can call /api in dev without CORS
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } }
  },
  build: { outDir: 'dist' }
});
