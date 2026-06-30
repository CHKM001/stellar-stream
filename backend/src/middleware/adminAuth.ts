import { Request, Response, NextFunction } from "express";

/**
 * Express middleware that validates the X-Admin-Key header against the ADMIN_API_KEY
 * environment variable. Returns 401 Unauthorized if the key is missing or invalid.
 */
export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const key = req.header("X-Admin-Key");

  if (!key || key !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
}