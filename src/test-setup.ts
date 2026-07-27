import '@testing-library/jest-dom/vitest';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Testing Library only auto-cleans when Vitest globals are on. They are off
// here (explicit imports read better), so unmount by hand — otherwise renders
// accumulate across tests and getByText finds several matches.
afterEach(cleanup);

// src/lib/supabase.ts throws at import time when these are missing, which is
// deliberate (a missing env var must not look like a working app). Component
// tests import it transitively, so give them values that never leave the process.
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
