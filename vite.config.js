import { defineConfig } from '@lovable.dev/lovite';

export default defineConfig({
  server: {
    host: '::',
    port: 8080,
    strictPort: true,
    hmr: {
      overlay: false,
    },
  },
  preview: {
    host: '::',
    port: 8080,
    strictPort: true,
  },
});
