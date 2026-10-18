import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Core must list this dev origin in ADMIN_ORIGINS (credentialed admin CORS and CSRF check).
export const adminBasePath = '/admin/'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? adminBasePath : '/',
}))
