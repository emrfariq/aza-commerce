import type { RequestHandler, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { verifyToken } from "../modules/auth/service.js";
import { AppError } from "../utils/api-response.js";

export type AuthSession = { userId: bigint; sessionId: bigint };
export const authSession = (res: Response) => res.locals.auth as AuthSession;

export const requireAuth: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw AppError.unauthorized("Silakan login terlebih dahulu");
  const claims = verifyToken(header.slice(7), "access");
  // A valid JWT alone is insufficient: logout must invalidate access immediately.
  const session = await prisma.refreshToken.findFirst({
    where: {
      id: BigInt(claims.sid),
      userId: BigInt(claims.sub),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!session) throw AppError.unauthorized("Sesi telah dicabut atau berakhir");
  res.locals.auth = { userId: session.userId, sessionId: session.id } satisfies AuthSession;
  next();
};
