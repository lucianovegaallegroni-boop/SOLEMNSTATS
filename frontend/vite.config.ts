import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 3011,
    proxy: {
      '/api': {
        target: 'http://localhost:3010',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['recharts'],
          'vendor-utils': ['lodash', 'crypto-js', '@supabase/supabase-js'],
        },
      },
    },
  },
})
