import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/quiz_generator/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.png', 'icon-192.png', 'icon-512.png', 'icons.svg'],
      manifest: {
        name: "L'Aventure du Savoir - Générateur Interactif",
        short_name: 'Quiz Gen.',
        description: 'Générateur de Quiz interactif',
        theme_color: '#f7f5ff',
        background_color: '#f7f5ff',
        display: 'fullscreen',
        orientation: 'landscape',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
