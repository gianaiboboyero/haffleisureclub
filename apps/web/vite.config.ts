import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  root: "apps/web",
  envDir: "../../",
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Only include the logo in the manifest assets list.
      // Do NOT use globPatterns to precache everything — that's what was
      // causing 8 MB of bandwidth on every first visit.
      includeAssets: ["haff-logo.jpg", "favicon.ico"],
      manifest: {
        name: "HAFF Leisure Club",
        short_name: "HAFF",
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
        // Only precache JS, CSS and HTML — skip images and fonts.
        // Court photos, achievement images etc. are served from CDN on demand.
        globPatterns: ["**/*.{js,css,html}"],
        // Serve stale SW immediately so updates don't block page load.
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Auth session — short cache, network first.
            urlPattern: /^\/api\/auth\?action=me/,
            handler: "NetworkFirst",
            options: { cacheName: "api-auth", expiration: { maxAgeSeconds: 60 } }
          },
          {
            // Images served from this origin — cache for 7 days, load from cache first.
            urlPattern: /\.(jpg|jpeg|png|webp|svg)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 }
            }
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
    // Inline tiny assets (< 4 kB) to save HTTP round-trips.
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React — always needed.
          react: ["react", "react-dom"],
          // Animation — large but needed on most screens.
          motion: ["framer-motion"],
          // Supabase client — needed on load for auth + realtime.
          supabase: ["@supabase/supabase-js"],
          // Icons — medium, lazy-ish.
          icons: ["lucide-react"],
          // State management (Zustand only — Dexie stays in main chunk since
          // we're server-authoritative and Dexie is barely called).
          state: ["zustand"]
        }
      }
    }
  }
});
