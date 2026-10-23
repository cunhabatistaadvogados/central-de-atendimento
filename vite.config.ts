import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base relativa: o mesmo build abre no GitHub Pages (subpasta) e em
// qualquer hospedagem, como no sistema do Dr. Marcello.
export default defineConfig({
  base: './',
  plugins: [react()],
  // Hora do build e commit: aparecem no pe do menu, para a equipe saber se
  // esta na versao nova ou precisa dar F5 (pedido do Edu, 23/10/2026).
  define: {
    __ATUALIZADO_EM__: JSON.stringify(new Date().toISOString()),
    __COMMIT__: JSON.stringify((process.env.GITHUB_SHA ?? 'local').slice(0, 7)),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@motor': path.resolve(__dirname, './supabase/functions/_shared'),
    },
  },
  server: { port: 5180 },
})
