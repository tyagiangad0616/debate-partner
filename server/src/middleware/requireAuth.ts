import type { NextFunction, Request, Response } from "express";
import { readUserId } from "../lib/auth.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    req.userId = readUserId(req);
    next();
  } catch (error) {
    next(error);
  }
}
