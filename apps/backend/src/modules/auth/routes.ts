import { Router, type CookieOptions, type RequestHandler } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { authSession, requireAuth } from "../../middlewares/auth.js";
import { AppError, ok } from "../../utils/api-response.js";
import { toApi } from "../../utils/serialize.js";
import { ACCESS_SECONDS, REFRESH_SECONDS, login, publicUser, refresh } from "./service.js";

export const authRouter = Router();
const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env().NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth",
});
const checkOrigin: RequestHandler = (req, _res, next) => {
  if (req.headers.origin && req.headers.origin !== env().FRONTEND_URL)
    throw AppError.forbidden("Origin tidak diizinkan");
  next();
};
authRouter.use(checkOrigin);

authRouter.post("/login", async (req, res) => {
  const input = z
    .object({
      email: z
        .string()
        .trim()
        .email()
        .max(150)
        .transform((v) => v.toLowerCase()),
      password: z.string().min(1).max(200),
    })
    .strict()
    .parse(req.body);
  const result = await login(input.email, input.password);
  res.cookie("refresh_token", result.refreshToken, {
    ...cookieOptions(),
    maxAge: REFRESH_SECONDS * 1000,
  });
  return ok(res, {
    access_token: result.accessToken,
    expires_in: ACCESS_SECONDS,
    user: toApi(result.user),
  });
});

authRouter.post("/refresh", async (req, res) => {
  const token = req.cookies?.refresh_token as unknown;
  if (typeof token !== "string") throw AppError.unauthorized("Refresh token diperlukan");
  try {
    const result = await refresh(token);
    res.cookie("refresh_token", result.refreshToken, {
      ...cookieOptions(),
      maxAge: REFRESH_SECONDS * 1000,
    });
    return ok(res, {
      access_token: result.accessToken,
      expires_in: ACCESS_SECONDS,
      user: toApi(result.user),
    });
  } catch (error) {
    res.clearCookie("refresh_token", cookieOptions());
    throw error;
  }
});

authRouter.get("/me", requireAuth, async (_req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: authSession(res).userId },
    select: publicUser,
  });
  return ok(res, toApi(user));
});

authRouter.post("/logout", requireAuth, async (_req, res) => {
  await prisma.refreshToken.update({
    where: { id: authSession(res).sessionId },
    data: { revokedAt: new Date() },
  });
  res.clearCookie("refresh_token", cookieOptions());
  return ok(res, null, "Logout berhasil");
});
