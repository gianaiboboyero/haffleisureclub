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
        name: "HAFF PicklePulse",
        short_name: "PicklePulse",
        theme_color: "#203d34",
        background_color: "#f4f1e8",
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
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff2}"]
      }
    })
  ],
  server: {
    port: 5173
  },
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true
  }
});
