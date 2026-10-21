import type { Envelope, User } from "./types";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
// Keep access credentials in memory; the browser manages the HttpOnly refresh cookie.
let accessToken: string | null = null;
let refreshing: Promise<AuthData> | null = null;
export type AuthData = { access_token: string; expires_in: number; user: User };
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}
export const clearToken = () => {
  accessToken = null;
};

async function decode<T>(response: Response): Promise<Envelope<T>> {
  if (response.status === 204) return { success: true, message: "OK", data: null as T };
  const body = (await response.json().catch(() => null)) as
    | (Envelope<T> & { errors?: Record<string, string[]> })
    | null;
  if (!response.ok)
    throw new ApiError(
      body?.message ?? "Permintaan gagal. Silakan coba lagi.",
      response.status,
      body?.errors,
    );
  if (!body) throw new ApiError("Respons server tidak valid", response.status);
  return body;
}

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

export function refreshSession(): Promise<AuthData> {
  // Share one refresh request across concurrent 401 responses to avoid rotation races.
  if (!refreshing) {
    refreshing = send("/auth/refresh", { method: "POST" })
      .then(decode<AuthData>)
      .then(({ data }) => {
        accessToken = data.access_token;
        return data;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

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
    // Retry the original request once; a second 401 must not create a refresh loop.
    response = await send(path, options);
    if (response.status === 401) {
      clearToken();
      window.dispatchEvent(new Event("session-expired"));
    }
  }
  return response;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<Envelope<T>> {
  return decode<T>(await authenticatedResponse(path, options));
}

/** File downloads share the same Bearer token, single-flight refresh, and JSON error handling. */
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function login(email: string, password: string): Promise<User> {
  const result = await decode<AuthData>(
    await send("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  );
  accessToken = result.data.access_token;
  return result.data.user;
}

export function queryString(values: Record<string, string | number | undefined>) {
  return new URLSearchParams(
    Object.entries(values)
      .filter(([, value]) => value !== undefined && value !== "")
      .map(([key, value]) => [key, String(value)]),
  ).toString();
}
