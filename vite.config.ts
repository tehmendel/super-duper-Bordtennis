import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// Served from the custom domain root (bordtennis.itsok.no), so base is '/'
// both in GitHub Actions and local dev.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  resolve: {
    alias: { '@': path.resolve(rootDir, 'src') },
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // We register the service worker ourselves in main.tsx via
      // virtual:pwa-register, so we get the autoUpdate reload-on-activate
      // behavior. The default auto-injected script only registers the SW
      // once with no update handling, which is what let stale, precached
      // old builds (e.g. the old email-based login) linger in already-open
      // tabs/installed PWAs until a manual refresh.
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      injectManifest: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'Bordtennisportalen',
        short_name: 'Bordtennis',
        description: 'Kampstatistikk og topplister for kontorets bordtennis-liga',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: process.env.VITE_BASE_PATH || '/',
        scope: process.env.VITE_BASE_PATH || '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
