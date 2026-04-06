import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// vite-plugin-pwa will be configured in Phase 7
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
