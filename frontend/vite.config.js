import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Disable sourcemaps in production by default to prevent leaking source code (2.37MB)
    // Only generate sourcemaps if explicitly requested via environment flag
    sourcemap: process.env.GENERATE_SOURCEMAP === 'true',
  },
})