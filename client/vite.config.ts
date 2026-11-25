import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite Configuration for RailYatra Frontend
 * Proxies `/api/*` requests during local development to the Express backend on port 5000,
 * eliminating CORS issues and allowing relative API paths like `/api/trains/search`.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
