import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // '/' for Vercel/Netlify; the GitHub Pages workflow sets VITE_BASE=/<repo-name>/
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { port: 5173 },
})
