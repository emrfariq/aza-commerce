import type { RequestHandler, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { verifyToken } from "../modules/auth/service.js";
import { AppError } from "../utils/api-response.js";

export type AuthSession = { userId: bigint; sessionId: bigint };
/** Mengambil identitas pengguna dan sesi dari res.locals yang sebelumnya diisi requireAuth. */
export const authSession = (res: Response) => res.locals.auth as AuthSession;

/**
 * Melindungi endpoint dengan memverifikasi Bearer JWT dan memeriksa sesi aktif di database.
 * Pemeriksaan sesi membuat logout langsung membatalkan akses meskipun JWT belum kedaluwarsa.
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw AppError.unauthorized("Silakan login terlebih dahulu");
  const claims = verifyToken(header.slice(7), "access");
  // Selain JWT yang valid, sesi harus masih aktif agar logout langsung membatalkan akses.
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
