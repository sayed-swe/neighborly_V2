import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    hookTimeout: 120_000,
    testTimeout: 30_000,
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-123456',
      BCRYPT_ROUNDS: '4',
      RATE_LIMIT_DISABLED: 'true',
      CLIENT_URL: 'http://localhost:5173',
    },
  },
});
