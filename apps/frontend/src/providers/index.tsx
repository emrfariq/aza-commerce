"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError, api, clearToken, login, refreshSession } from "@/lib/api";
import type { User } from "@/lib/types";

type Auth = {
  user: User | null;
  loading: boolean;
  error: string;
  retry: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<Auth | null>(null);
/**
 * Menyediakan akses ke konteks autentikasi dan memberi error jika komponen dipakai di luar
 * AuthProvider.
 */
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("Auth provider missing");
  return auth;
}

/**
 * Mengelola pengguna aktif, pemulihan sesi, login, logout, dan pembersihan cache bersama untuk
 * seluruh komponen di dalamnya.
 */
function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  // Saat halaman dimuat ulang, access token di memori hilang; pulihkan sesi melalui cookie.
  /**
   * Memulihkan sesi dari cookie ketika provider dipasang atau pengguna mencoba lagi; penanda
   * active mencegah pembaruan state dari proses yang sudah tidak digunakan.
   */
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    refreshSession()
      .then(
        /*
         * Memasang profil hasil pemulihan sesi hanya jika effect masih aktif.
         */
        (data) => {
          if (active) setUser(data.user);
        },
      )
      .catch(
        /*
         * Menampilkan kegagalan pemeriksaan sesi selain 401; status 401 cukup dianggap
         * sebagai pengguna yang belum login.
         */
        (reason: unknown) => {
          if (active && !(reason instanceof ApiError && reason.status === 401))
            setError(reason instanceof Error ? reason.message : "Gagal memeriksa sesi");
        },
      )
      .finally(
        /* Mengakhiri loading hanya jika effect masih aktif. */ () => {
          if (active) setLoading(false);
        },
      );
    return /* Menonaktifkan pembaruan state dari proses pemulihan sesi setelah effect dibersihkan. */ () => {
      active = false;
    };
  }, [attempt]);
  /** Mendaftarkan pendengar event sesi berakhir dan melepaskannya saat effect dibersihkan. */
  useEffect(() => {
    // Bersihkan cache data bisnis saat sesi berakhir, termasuk pada perangkat yang dipakai bersama.
    /**
     * Menghapus pengguna dan cache data bisnis saat sesi berakhir agar data akun sebelumnya
     * tidak tertinggal.
     */
    const expired = () => {
      setUser(null);
      client.clear();
    };
    window.addEventListener("session-expired", expired);
    return /* Melepas pendengar session-expired untuk mencegah pendaftaran ganda atau kebocoran listener. */ () =>
      window.removeEventListener("session-expired", expired);
  }, [client]);
  const signIn = useCallback(
    /*
     * Melakukan login, membersihkan cache akun sebelumnya, lalu memasang profil pengguna
     * yang baru.
     */
    async (email: string, password: string) => {
      const account = await login(email, password);
      client.clear();
      setError("");
      setUser(account);
    },
    [client],
  );
  const signOut = useCallback(
    /*
     * Mencabut sesi melalui backend lalu membersihkan token, cache, dan pengguna lokal
     * setelah logout berhasil.
     */
    async () => {
      await api("/auth/logout", { method: "POST" });
      clearToken();
      client.clear();
      setUser(null);
    },
    [client],
  );
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        /*
         * Memicu percobaan pemeriksaan sesi baru dengan mengubah nomor percobaan.
         */

        retry: () =>
          setAttempt(
            /*
             * Menambah nomor percobaan berdasarkan state terakhir agar aman terhadap
             * pembaruan React yang dibatch.
             */
            (value) => value + 1,
          ),
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Menyediakan QueryClient dan konteks autentikasi bagi seluruh aplikasi dengan kebijakan cache
 * dan retry yang sama.
 */
export default function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    /*
     * Membuat QueryClient satu kali per pemasangan provider; data dianggap segar selama 30
     * detik dan mutation tidak diulang otomatis.
     */
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000,
            retry:
              /*
               * Mengizinkan satu retry query untuk error selain 401 agar permintaan tanpa
               * sesi tidak diulang terus.
               */
              (count, error) => count < 1 && !(error instanceof ApiError && error.status === 401),
          },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
