import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

// One .env for the whole repo lives at the root; Vite only exposes VITE_* keys to the browser.
const ENV_DIR = '..'

// https://vite.dev/config/
// In development every /api request is proxied to the Express backend, so the
// frontend can use relative URLs and never deals with CORS.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ENV_DIR, 'VITE_')
  return {
    envDir: ENV_DIR,
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: process.env.VITE_API_PROXY_TARGET || env.VITE_API_PROXY_TARGET || 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  }
})
