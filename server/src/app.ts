import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import { env, currentAiMode, configuredModel } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { meRouter } from "./routes/me.js";
import { debatesRouter } from "./routes/debates.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { errorMiddleware } from "./lib/http.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    req.requestId = crypto.randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    const started = Date.now();
    res.on("finish", () => {
      console.log(
        JSON.stringify({
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          ms: Date.now() - started,
        }),
      );
    });
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      data: {
        ok: true,
        aiMode: currentAiMode(),
        model: configuredModel(),
        rubricVersion: "v1",
      },
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/me", meRouter);
  app.use("/api/debates", debatesRouter);
  app.use("/api/dashboard", dashboardRouter);

  app.use(errorMiddleware);
  return app;
}
