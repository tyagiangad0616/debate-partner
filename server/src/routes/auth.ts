import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { clearAuthCookie, hashPassword, setAuthCookie, verifyPassword } from "../lib/auth.js";
import { loginSchema, parseBody, registerSchema } from "../lib/validation.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

authRouter.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(registerSchema, req.body);
    const email = body.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new HttpError(409, "email_taken", "An account with this email already exists.");
    }
    const user = await prisma.user.create({
      data: {
        displayName: body.displayName,
        email,
        passwordHash: await hashPassword(body.password),
      },
    });
    setAuthCookie(res, user.id);
    res.status(201).json({
      data: { id: user.id, displayName: user.displayName, email: user.email, ttsEnabled: user.ttsEnabled },
    });
  }),
);

authRouter.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new HttpError(401, "invalid_credentials", "Email or password is incorrect.");
    }
    setAuthCookie(res, user.id);
    res.json({
      data: { id: user.id, displayName: user.displayName, email: user.email, ttsEnabled: user.ttsEnabled },
    });
  }),
);

authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ data: { ok: true } });
});

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      throw new HttpError(401, "unauthenticated", "Please sign in to continue.");
    }
    res.json({
      data: { id: user.id, displayName: user.displayName, email: user.email, ttsEnabled: user.ttsEnabled },
    });
  }),
);
