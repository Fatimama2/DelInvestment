import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': r('../../packages/shared/src'),
      '@integrations': r('../../packages/integrations/src'),
    },
  },
  // Allow Vite to read the sibling workspace packages (outside apps/web).
  server: { port: 5173, host: true, fs: { allow: [r('../../')] } },
  preview: { port: 5173 },
});
