import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from 'vite-plugin-pwa';

const plugins = [
  react(), 
  tailwindcss(), 
  VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
    workbox: {
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
    },
    manifest: {
      name: 'Risk Control Dashboard',
      short_name: 'RiskControl',
      description: 'Professional Investment Risk Management System',
      theme_color: '#030712',
      background_color: '#030712',
      display: 'standalone',
      scope: '/',
      start_url: '/',
      orientation: 'portrait',
      icons: [
        {
          src: '/pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    }
  })
];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "..", "shared", "riskcontrol"),
    },
  },
  envDir: path.resolve(import.meta.dirname, "..", ".."),
  root: path.resolve(import.meta.dirname),
  publicDir: path.resolve(import.meta.dirname, "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 3000, // 3MB warning limit
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
    ],
    proxy: {
      '/api/tencent': {
        target: 'https://qt.gtimg.cn',
        changeOrigin: true,
        rewrite: (path) => {
          // 将 /api/tencent/hk00700 转换为 q=hk00700
          const ticker = path.replace(/^\/api\/tencent\//, '');
          return `q=${ticker}`;
        },
        headers: {
          Referer: 'https://finance.qq.com/',
        },
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
