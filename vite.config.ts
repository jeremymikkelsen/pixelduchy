import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

const buildNumber = (() => {
  try {
    return execSync('git rev-list --count HEAD').toString().trim()
  } catch {
    return '0'
  }
})()

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
  },
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
