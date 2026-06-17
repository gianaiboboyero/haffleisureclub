import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  root: "apps/web",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["haff-logo.jpg"],
      manifest: {
        name: "HAFF Leisure Club - Cadiz City",
        short_name: "HAFF Cadiz",
        theme_color: "#203d34",
        background_color: "#082d23",
        display: "standalone",
        icons: [
          {
            src: "/haff-logo.jpg",
            sizes: "512x512",
            type: "image/jpeg",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff2}"],
        // Cache API responses for faster repeat loads
        runtimeCaching: [
          {
            urlPattern: /^\/api\/auth\?action=me/,
            handler: "NetworkFirst",
            options: { cacheName: "api-auth", expiration: { maxAgeSeconds: 60 } }
          },
          {
            urlPattern: /^\/api\/reservations/,
            handler: "NetworkFirst",
            options: { cacheName: "api-reservations", expiration: { maxAgeSeconds: 30 } }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_PROXY ?? "http://127.0.0.1:3000",
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
    // Inline tiny assets to reduce HTTP requests
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          motion: ["framer-motion"],
          storage: ["dexie", "zustand"],
          icons: ["lucide-react"]
        }
      }
    }
  }
});
