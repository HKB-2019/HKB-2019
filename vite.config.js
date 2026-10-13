import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Addresses from the site's root, so /product/tee finds its scripts and
  // pictures too. (The preview build, vite.demo.config.js, is the exception.)
  base: '/',
  plugins: [react()],
  server: {
    port: 5173,
    // so the browser can call /api in dev without CORS
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } }
  },
  build: { outDir: 'dist' }
});
