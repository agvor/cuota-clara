import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'CuotaClara',
        short_name: 'CuotaClara',
        description: 'Simulador local-first de préstamos y estrategias de pago.',
        theme_color: '#1d4ed8',
        background_color: '#f8fafc',
        display: 'standalone',
        lang: 'es',
        start_url: '/',
      },
    }),
  ],
});
