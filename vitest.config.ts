import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test-setup.ts'],
    // Only unit and component tests. scripts/test-m1.mjs talks to the real
    // Supabase project and is run separately via `npm run test:m1`, so it must
    // not be swept up by a plain `npm test`.
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      // Her shadcn/ui components are vendored and untouched; measuring them
      // would drown the signal from the code actually written for M1.
      exclude: [
        'src/components/ui/**',
        'src/imports/**',
        'src/**/*.test.{ts,tsx}',
        'src/test-setup.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      include: ['src/**/*.{ts,tsx}'],
    },
  },
});
