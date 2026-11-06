import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const requestId = req.requestId;
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, requestId },
    });
    return;
  }

  console.error(`[${requestId}]`, err instanceof Error ? err.message : "unknown error");
  res.status(500).json({
    error: {
      code: "internal_error",
      message: "Something went wrong. Please try again.",
      requestId,
    },
  });
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      userId?: string;
    }
  }
}
