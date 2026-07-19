import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Read environment variables from the project root
  envDir: '../',

  // Build output inside frontend/dist
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})