import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset URLs, so the build runs from any path, not just a domain root.
  base: './',
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: 'dist' }
});
