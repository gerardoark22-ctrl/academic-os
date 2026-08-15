import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Sin vite-plugin-pwa a propósito: el service worker está escrito a mano en
// public/sw.js y se registra desde main.tsx. Menos magia, y el listener `push`
// de FCM se controla entero desde ese archivo.
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/framer-motion')) return 'vendor-motion';
          if (id.includes('node_modules/dexie')) return 'vendor-dexie';
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react';
          if (id.includes('node_modules/zustand')) return 'vendor-zustand';
        },
      },
    },
  },
  plugins: [react()],
  server: { port: 5173, host: true },
});
