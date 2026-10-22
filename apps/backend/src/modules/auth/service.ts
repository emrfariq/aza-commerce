import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/api-response.js";

export const ACCESS_SECONDS = 15 * 60;
export const REFRESH_SECONDS = 7 * 24 * 60 * 60;
const issuer = "azatech-order-api";
const audience = "azatech-admin";
export const publicUser = { id: true, name: true, email: true } as const;
/**
 * Menghasilkan hash SHA-256 refresh token agar database tidak menyimpan token asli yang dapat
 * langsung digunakan.
 */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Memverifikasi tanda tangan, masa berlaku, issuer, audience, jenis token, serta format ID
 * pengguna dan sesi. Token yang tidak sesuai diubah menjadi error 401.
 */
export function verifyToken(
  token: string,
  kind: "access" | "refresh",
): JwtPayload & { sid: string; sub: string } {
  try {
    const config = env();
    const payload = jwt.verify(
      token,
      kind === "access" ? config.JWT_ACCESS_SECRET : config.JWT_REFRESH_SECRET,
      {
        algorithms: ["HS256"],
        issuer,
        audience,
      },
    );
    if (
      typeof payload === "string" ||
      payload.kind !== kind ||
      typeof payload.sid !== "string" ||
      !/^\d+$/.test(payload.sid) ||
      typeof payload.sub !== "string" ||
      !/^\d+$/.test(payload.sub)
    ) {
      throw new Error("Invalid token claims");
    }
    return payload as JwtPayload & { sid: string; sub: string };
  } catch {
    throw AppError.unauthorized("Sesi tidak valid atau telah berakhir");
  }
}

/**
 * Membuat pasangan JWT: access token berlaku 15 menit dan refresh token 7 hari. Keduanya membawa
 * ID pengguna dan sesi; refresh token diberi jti acak agar hasil rotasi berbeda.
 */
function tokens(userId: bigint, sessionId: bigint) {
  const config = env();
  const claims = { sub: String(userId), sid: String(sessionId) };
  const options = { algorithm: "HS256" as const, issuer, audience };
  return {
    accessToken: jwt.sign({ ...claims, kind: "access" }, config.JWT_ACCESS_SECRET, {
      ...options,
      expiresIn: ACCESS_SECONDS,
    }),
    refreshToken: jwt.sign(
      { ...claims, kind: "refresh", jti: randomUUID() },
      config.JWT_REFRESH_SECRET,
      { ...options, expiresIn: REFRESH_SECONDS },
    ),
  };
}

/**
 * Mencocokkan password dengan bcrypt, membuat sesi beserta hash refresh token dalam transaksi,
 * lalu mengembalikan token dan profil publik pengguna.
 */
export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Hash pengganti yang valid memastikan email tidak dikenal dan password salah sama-sama menjalankan bcrypt.
  const valid = await bcrypt.compare(
    password,
    user?.password ?? "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
  );
  if (!user || !valid) throw AppError.unauthorized("Email atau password salah");
  // Buat ID sesi untuk klaim JWT, lalu simpan hanya hash refresh token.
  const result = await prisma.$transaction(
    /*
     * Membuat ID sesi untuk klaim JWT lalu menyimpan hash refresh token; kedua perubahan
     * dibatalkan bersama jika transaksi gagal.
     */
    async (tx) => {
      const session = await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(randomUUID()),
          expiresAt: new Date(Date.now() + REFRESH_SECONDS * 1000),
        },
      });
      const pair = tokens(user.id, session.id);
      await tx.refreshToken.update({
        where: { id: session.id },
        data: { tokenHash: hashToken(pair.refreshToken) },
      });
      return pair;
    },
  );
  return { ...result, user: { id: user.id, name: user.name, email: user.email } };
}

/**
 * Memverifikasi refresh token lalu mengganti hash sesi secara atomik hanya jika hash lama masih
 * cocok. Rotasi ini mencegah refresh token yang sama dipakai ulang setelah berhasil diperbarui.
 */
export async function refresh(token: string) {
  const claims = verifyToken(token, "refresh");
  const pair = tokens(BigInt(claims.sub), BigInt(claims.sid));
  // Compare-and-swap: sesi hanya bisa dirotasi oleh request dengan hash token yang masih cocok.
  // Pemeriksaan dan perubahan dalam satu operasi mencegah pemakaian ulang token yang sudah dirotasi.
  const changed = await prisma.refreshToken.updateMany({
    where: {
      id: BigInt(claims.sid),
      userId: BigInt(claims.sub),
      tokenHash: hashToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: {
      tokenHash: hashToken(pair.refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_SECONDS * 1000),
    },
  });
  if (!changed.count) throw AppError.unauthorized("Refresh token tidak valid atau telah dicabut");
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: BigInt(claims.sub) },
    select: publicUser,
  });
  return { ...pair, user };
}
