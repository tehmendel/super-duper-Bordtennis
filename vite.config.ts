import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// Base path is set to the repo name in GitHub Actions so the app works under
// https://<user>.github.io/<repo>/ — defaults to '/' for local dev.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  resolve: {
    alias: { '@': path.resolve(rootDir, 'src') },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Super Duper Bordtennis',
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
