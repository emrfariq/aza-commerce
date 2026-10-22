import type { Envelope, User } from "./types";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
// Simpan access token di memori; browser mengelola refresh token lewat cookie HttpOnly.
let accessToken: string | null = null;
let refreshing: Promise<AuthData> | null = null;
export type AuthData = { access_token: string; expires_in: number; user: User };
export class ApiError extends Error {
  /**
   * Menyimpan pesan, status HTTP, dan error per field agar tampilan dapat membedakan masalah
   * autentikasi, validasi, dan koneksi.
   */
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}
/** Menghapus access token dari memori browser ketika sesi diakhiri. */
export const clearToken = () => {
  accessToken = null;
};

/**
 * Membaca respons JSON ke bentuk Envelope dan melempar ApiError jika request gagal. Respons 204
 * ditangani tanpa mencoba membaca body kosong.
 */
async function decode<T>(response: Response): Promise<Envelope<T>> {
  if (response.status === 204) return { success: true, message: "OK", data: null as T };
  const body = (await response.json().catch(
    /*
     * Menghasilkan null jika body gagal dibaca sebagai JSON agar decode dapat menangani
     * respons tidak valid.
     */
    () => null,
  )) as (Envelope<T> & { errors?: Record<string, string[]> }) | null;
  if (!response.ok)
    throw new ApiError(
      body?.message ?? "Permintaan gagal. Silakan coba lagi.",
      response.status,
      body?.errors,
    );
  if (!body) throw new ApiError("Respons server tidak valid", response.status);
  return body;
}

/**
 * Mengirim request ke backend dengan cookie dan Bearer token dari memori, lalu mengubah
 * kegagalan jaringan menjadi ApiError berstatus 0.
 */
async function send(path: string, options: RequestInit = {}) {
  try {
    return await fetch(`${base}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError("Tidak dapat terhubung ke server. Periksa koneksi dan coba kembali.", 0);
  }
}

/**
 * Memulihkan access token melalui cookie refresh HttpOnly. Promise yang sama dipakai oleh
 * request bersamaan agar rotasi refresh token tidak saling berlomba.
 */
export function refreshSession(): Promise<AuthData> {
  // Gunakan satu request refresh bersama untuk respons 401 bersamaan agar rotasi token tidak saling berlomba.
  if (!refreshing) {
    refreshing = send("/auth/refresh", { method: "POST" })
      .then(decode<AuthData>)
      .then(
        /*
         * Menyimpan access token hasil refresh ke memori lalu meneruskan data sesi kepada
         * pemanggil.
         */
        ({ data }) => {
          accessToken = data.access_token;
          return data;
        },
      )
      .finally(
        /*
         * Mengosongkan penanda proses refresh setelah selesai agar pembaruan berikutnya
         * dapat berjalan.
         */
        () => {
          refreshing = null;
        },
      );
  }
  return refreshing;
}

/**
 * Mengirim request terautentikasi; jika mendapat 401, mencoba refresh dan mengulang request
 * tepat satu kali. Sesi yang tidak valid memicu event session-expired untuk membersihkan status
 * pengguna.
 */
async function authenticatedResponse(path: string, options: RequestInit = {}): Promise<Response> {
  let response = await send(path, options);
  if (response.status === 401) {
    try {
      await refreshSession();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearToken();
        window.dispatchEvent(new Event("session-expired"));
      }
      throw error;
    }
    // Ulangi request asli satu kali; respons 401 berikutnya tidak boleh memicu loop refresh.
    response = await send(path, options);
    if (response.status === 401) {
      clearToken();
      window.dispatchEvent(new Event("session-expired"));
    }
  }
  return response;
}

/**
 * Menyediakan pintu masuk request JSON: mengurus autentikasi dan refresh sebelum membaca respons
 * bertipe Envelope<T>.
 */
export async function api<T>(path: string, options: RequestInit = {}): Promise<Envelope<T>> {
  return decode<T>(await authenticatedResponse(path, options));
}

/**
 * Mengunduh berkas memakai alur autentikasi yang sama dengan API, mengambil nama dari header
 * server, lalu memicu unduhan melalui URL Blob sementara.
 */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = await authenticatedResponse(path);
  if (!response.ok) await decode(response);
  const blob = await response.blob();
  const filename =
    /filename="([^"]+)"/i.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ??
    fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  /** Melepaskan URL Blob setelah unduhan dipicu agar sumber daya browser tidak tertahan. */
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Mengirim email dan password ke endpoint login, menyimpan access token di memori, lalu
 * mengembalikan profil pengguna.
 */
export async function login(email: string, password: string): Promise<User> {
  const result = await decode<AuthData>(
    await send("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  );
  accessToken = result.data.access_token;
  return result.data.user;
}

/**
 * Membentuk query string dengan encoding URL, melewati nilai undefined dan string kosong agar
 * filter opsional tidak ikut terkirim.
 */
export function queryString(values: Record<string, string | number | undefined>) {
  return new URLSearchParams(
    Object.entries(values)
      .filter(
        /*
         * Menyaring parameter yang tidak diisi sebelum membentuk query string.
         */
        ([, value]) => value !== undefined && value !== "",
      )
      .map(
        /*
         * Mengubah nilai parameter menjadi string sesuai masukan URLSearchParams.
         */
        ([key, value]) => [key, String(value)],
      ),
  ).toString();
}
