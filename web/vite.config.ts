/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('hls.js')) {
              return 'vendor-hls'
            }
            if (id.includes('mpegts.js')) {
              return 'vendor-mpegts'
            }
            if (id.includes('sql.js')) {
              return 'vendor-sql'
            }
            if (id.includes('vue') || id.includes('pinia')) {
              return 'vendor-vue'
            }
            if (id.includes('@capacitor')) {
              return 'vendor-capacitor'
            }
          }
        },
      },
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
