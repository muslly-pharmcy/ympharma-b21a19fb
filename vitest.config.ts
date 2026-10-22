import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

// Unit tests exercise handlers through their explicit mocks. The application
// Vite plugins rewrite server functions into RPC stubs before those mocks run.
// Keep the build pipeline separate; configured database checks still run.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    exclude: [...configDefaults.exclude, 'artifacts/**', 'e2e/**'],
  },
})
