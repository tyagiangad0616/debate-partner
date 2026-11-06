import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { env } from "../env.js";
import { HttpError } from "./http.js";

const COOKIE_NAME = "debate_token";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: "7d" });
}

export function setAuthCookie(res: Response, userId: string) {
  const token = signToken(userId);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: SEVEN_DAYS_MS,
    path: "/",
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
  });
}

export function readUserId(req: Request): string {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    throw new HttpError(401, "unauthenticated", "Please sign in to continue.");
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub?: string };
    if (!payload.sub) {
      throw new Error("missing subject");
    }
    return payload.sub;
  } catch {
    throw new HttpError(401, "unauthenticated", "Your session has expired. Please sign in again.");
  }
}
