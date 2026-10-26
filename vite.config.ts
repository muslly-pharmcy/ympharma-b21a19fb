// @lovable.dev/vite-tanstack-config provides TanStack Start, React, Tailwind,
// aliases, error logging, and sandbox defaults. Select exactly one deployment
// adapter per build: Nitro for Node/Docker, or Cloudflare's official Vite plugin.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { cloudflare } from "@cloudflare/vite-plugin";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { PUBLIC_BACKEND } from './config/public-backend';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isCapacitorBuild = process.argv.some((arg, index, args) =>
  arg === "--mode" ? args[index + 1] === "capacitor" : arg === "capacitor",
);
// Workers Builds supplies WORKERS_CI automatically even when its dashboard
// uses the ordinary build command. Keep Node/Lovable builds on Nitro.
const isCloudflareBuild = process.env.CLOUDFLARE_BUILD === "1" || process.env.WORKERS_CI === "1";

// Server-only env vars (no VITE_ prefix) needed by server routes such as
// the auth email webhook (SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY).
// Do NOT add these keys to envDefine — that would leak secrets to the client.
const serverEnv = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

export default defineConfig({
  // The Cloudflare Vite plugin owns Worker builds. Keep Nitro for the existing
  // Node/Docker target; never run both deployment adapters in one build.
  plugins: isCloudflareBuild
    ? [cloudflare({ viteEnvironment: { name: "ssr" } })]
    : [],
  nitro: isCapacitorBuild || isCloudflareBuild
    ? false
    : {
        preset: process.env.NITRO_PRESET || "node-server",
      },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ssr: true,
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
      {
        name: 'selected-backend-clients',
        enforce: 'pre',
        resolveId(source, importer) {
          // Preserve generated files; redirect all consumers to app-owned adapters.
          const canonical = source.split('?')[0].replaceAll('\\', '/');
          const generated = path.resolve(__dirname, 'src/integrations/supabase').replaceAll('\\', '/');
          if (source === '@/integrations/supabase/client' || canonical === `${generated}/client` || canonical === `${generated}/client.ts` ||
              (source === './client' && importer?.split('?')[0].replaceAll('\\', '/').endsWith('/src/integrations/supabase/auth-attacher.ts'))) {
            return path.resolve(__dirname, 'src/lib/backend/client.ts');
          }
          if (source === '@/integrations/supabase/client.server' || canonical === `${generated}/client.server` || canonical === `${generated}/client.server.ts`) {
            return path.resolve(__dirname, 'src/lib/backend/admin.server.ts');
          }
        },
      },
      // @lovable.dev/mcp-js currently compares Vite's slash-normalized root
      // with Node's backslash-resolved routes path on Windows.  That makes the
      // plugin fail before Vitest or a local production build can start.  The
      // deployed target is Linux, where MCP generation stays enabled; Windows
      // uses the checked-in generated routes for local validation.
      ...(process.platform === "win32" ? [] : [mcpPlugin()]),
    ],
    define: {
      'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify(PUBLIC_BACKEND.projectId),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(PUBLIC_BACKEND.url),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(PUBLIC_BACKEND.publishableKey),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(PUBLIC_BACKEND.publishableKey),
    },

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
        '@/integrations/supabase/client': path.resolve(__dirname, 'src/lib/backend/client.ts'),
        '@/integrations/supabase/client.server': path.resolve(__dirname, 'src/lib/backend/admin.server.ts'),
        "entities/lib/decode.js": path.resolve(__dirname, "node_modules/entities/lib/esm/decode.js"),
        "entities/lib/encode.js": path.resolve(__dirname, "node_modules/entities/lib/esm/encode.js"),
      },
    },
  },
});
