import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// NOTE: The console relies on CORS headers from the Core API server.
// Set CORS_ORIGIN=* (or the dev URL) in apps/core/.env before running pnpm dev.
export default defineConfig({
  plugins: [react()],
})
