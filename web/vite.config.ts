import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: { port: 4731, strictPort: true, proxy: { '/api': 'http://localhost:4732' } },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], css: false, passWithNoTests: true },
});
