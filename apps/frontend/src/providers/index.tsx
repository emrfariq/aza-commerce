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
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("Auth provider missing");
  return auth;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  // Page reloads lose the in-memory access token; recover the session from its cookie.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    refreshSession()
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch((reason: unknown) => {
        if (active && !(reason instanceof ApiError && reason.status === 401))
          setError(reason instanceof Error ? reason.message : "Gagal memeriksa sesi");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    // Clear cached business data when the session ends, including on shared devices.
    const expired = () => {
      setUser(null);
      client.clear();
    };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, [client]);
  const signIn = useCallback(
    async (email: string, password: string) => {
      const account = await login(email, password);
      client.clear();
      setError("");
      setUser(account);
    },
    [client],
  );
  const signOut = useCallback(async () => {
    await api("/auth/logout", { method: "POST" });
    clearToken();
    client.clear();
    setUser(null);
  }, [client]);
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        retry: () => setAttempt((value) => value + 1),
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000,
            retry: (count, error) =>
              count < 1 && !(error instanceof ApiError && error.status === 401),
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
