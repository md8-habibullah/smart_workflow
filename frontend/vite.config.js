import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

// One .env for the whole repo lives at the root; Vite only exposes VITE_* keys to the browser.
const ENV_DIR = '..'

// https://vite.dev/config/
// In development every /api request is proxied to the Express backend, so the
// frontend can use relative URLs and never deals with CORS.
export default defineConfig(({ mode }) => {
  // Read every key here (config only, never sent to the browser) so the proxy follows the backend's PORT.
  const env = { ...loadEnv(mode, ENV_DIR, ''), ...process.env }
  const apiTarget = env.VITE_API_PROXY_TARGET || `http://localhost:${env.PORT || 5000}`
  const proxy = { '/api': { target: apiTarget, changeOrigin: true } }
  return {
    envDir: ENV_DIR,
    plugins: [react(), tailwindcss()],
    server: {
      // Preferred port; if it is busy Vite moves on to the next free one (5174, 5175…). All of them work.
      port: Number(env.VITE_DEV_PORT) || 5173,
      strictPort: false,
      proxy,
    },
    // `npm run preview -w frontend` uses the same proxy.
    preview: { port: Number(env.VITE_PREVIEW_PORT) || 4173, strictPort: false, proxy },
  }
})
