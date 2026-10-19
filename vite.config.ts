import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base relativa: o mesmo build abre no GitHub Pages (subpasta) e em
// qualquer hospedagem, como no sistema do Dr. Marcello.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@motor': path.resolve(__dirname, './supabase/functions/_shared'),
    },
  },
  server: { port: 5180 },
})
