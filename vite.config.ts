// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { VitePWA } from "vite-plugin-pwa";


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isLovableSandbox =
  process.env.LOVABLE_SANDBOX === "1" || Boolean(process.env.DEV_SERVER__PROJECT_PATH);
const isCapacitorBuild = process.argv.some((arg, index, args) =>
  arg === "--mode" ? args[index + 1] === "capacitor" : arg === "capacitor",
);

// Server-only env vars (no VITE_ prefix) needed by server routes such as
// the auth email webhook (SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY).
// Do NOT add these keys to envDefine — that would leak secrets to the client.
const serverEnv = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

export default defineConfig({
  // Exported/local builds target Node so the Docker image and `npm run preview`
  // can execute the generated server directly. Lovable overrides this to its
  // Cloudflare layout inside the sandbox build environment.
  nitro: isCapacitorBuild
    ? false
    : {
        preset: process.env.NITRO_PRESET || "node-server",
      },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ssr: false,
    ...(isCapacitorBuild
      ? {
          // Capacitor needs a real local index.html. TanStack's SPA shell keeps
          // routing client-side while server functions continue to run on the
          // separately deployed HTTPS backend.
          spa: {
            enabled: true,
            maskPath: "/",
            prerender: { outputPath: "/index" },
          },
        }
      : {}),
  },
  vite: {
    plugins: [
      // @lovable.dev/mcp-js currently compares Vite's slash-normalized root
      // with Node's backslash-resolved routes path on Windows.  That makes the
      // plugin fail before Vitest or a local production build can start.  The
      // deployed target is Linux, where MCP generation stays enabled; Windows
      // uses the checked-in generated routes for local validation.
      ...(process.platform === "win32" ? [] : [mcpPlugin()]),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        // Lovable emits to dist/client; exported Node builds emit to
        // .output/public. Keep the service worker beside the deployed assets.
        outDir:
          isLovableSandbox || isCapacitorBuild ? "dist/client" : ".output/public",
        devOptions: { enabled: false },
        manifest: false,
        workbox: {
          globPatterns: ["**/*.{js,css,woff2,png,svg,webp,ico}"],
          navigateFallback: "/offline",
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/\.mcp/, /^\/\.well-known/],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              // HTML navigations: always try the network first, fall back to cache.
              urlPattern: ({ request }: { request: Request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "html-navigations",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              // Static assets: instant from cache, refreshed in the background.
              urlPattern: ({ request, sameOrigin }: { request: Request; sameOrigin: boolean }) =>
                sameOrigin &&
                ["style", "script", "worker", "image", "font"].includes(request.destination),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "static-assets",
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // API reads: network-first so data is fresh, cached copy when offline.
              urlPattern: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
                sameOrigin && url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/public/"),
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                networkTimeoutSeconds: 6,
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 30 },
              },
            },
          ],
        },
      }),
    ],

    build: {
      // Android 11 WebView and newer reliably support the ES2020 output used
      // by the Capacitor shell. Keep the web and native bundles identical.
      target: 'es2020',
      // Hidden source maps: emitted to disk for Sentry/Lighthouse without
      // referencing them from shipped JS (no `//# sourceMappingURL`).
      sourcemap: isCapacitorBuild ? false : 'hidden',
    },
    resolve: {
      // React Email imports the legacy `entities/lib/*.js` subpaths. The pinned
      // entities@4.5.0 ships those under `lib/esm/`, so point the aliases there
      // (v6+ `dist/esm/` paths do not exist in this install).
      alias: {
        "entities/lib/decode.js": path.resolve(__dirname, "node_modules/entities/lib/esm/decode.js"),
        "entities/lib/encode.js": path.resolve(__dirname, "node_modules/entities/lib/esm/encode.js"),
      },
    },
  },
});
