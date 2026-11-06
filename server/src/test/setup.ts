import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dbPath = path.join(root, "prisma", "test.db");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:./prisma/test.db";
process.env.JWT_SECRET = "test-secret-at-least-16";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.OPENAI_API_KEY = "";
process.env.PORT = "3001";

if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

execSync("npx prisma db push --skip-generate", {
  cwd: root,
  stdio: "pipe",
  env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
});
