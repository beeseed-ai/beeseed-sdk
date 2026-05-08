import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  root: 'dev',
  server: {
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:9092', changeOrigin: true },
      '/ws': { target: 'ws://localhost:9092', ws: true },
    },
  },
})
