import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 8 verwendet Rolldown als Bundler (Standard, keine Zusatzkonfiguration nötig).
export default defineConfig({
  plugins: [react()],
})
