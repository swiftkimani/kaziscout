import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./test/setup.ts'], restoreMocks: true },
  server: {
    port: 5173,
    // The API runs as a separate process in development; in production it serves this build.
    proxy: { '/v1': 'http://127.0.0.1:8787', '/health': 'http://127.0.0.1:8787' },
  },
});
