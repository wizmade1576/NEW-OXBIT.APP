import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    open: true,
    proxy: {
      '/reddit': {
        target: 'https://www.reddit.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/reddit/, ''),
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
  },
})
