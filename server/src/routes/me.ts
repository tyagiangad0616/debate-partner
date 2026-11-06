import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { parseBody, profileUpdateSchema } from "../lib/validation.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw new HttpError(401, "unauthenticated", "Please sign in to continue.");
    res.json({
      data: { id: user.id, displayName: user.displayName, email: user.email, ttsEnabled: user.ttsEnabled },
    });
  }),
);

meRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const body = parseBody(profileUpdateSchema, req.body);
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(body.displayName ? { displayName: body.displayName } : {}),
        ...(typeof body.ttsEnabled === "boolean" ? { ttsEnabled: body.ttsEnabled } : {}),
      },
    });
    res.json({
      data: { id: user.id, displayName: user.displayName, email: user.email, ttsEnabled: user.ttsEnabled },
    });
  }),
);
