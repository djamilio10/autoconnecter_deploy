import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Sépare les libs tierces (react, axios) dans des chunks dédiés : elles
    // changent rarement, donc le navigateur les garde en cache entre deux
    // déploiements et ne re-télécharge que le code applicatif modifié.
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'axios': ['axios'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
