import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@smart-grid/core': path.resolve(__dirname, '../../packages/core/src'),
    },
  },
  server: {
    open: true,
  },
});
