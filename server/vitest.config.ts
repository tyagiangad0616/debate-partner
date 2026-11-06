import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    setupFiles: ["./src/test/setup.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "file:./prisma/test.db",
      JWT_SECRET: "test-secret-at-least-16",
      CLIENT_ORIGIN: "http://localhost:5173",
      OPENAI_API_KEY: "",
      PORT: "3001",
    },
  },
});
