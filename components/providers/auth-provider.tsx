"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

interface AuthUser {
  userId: string;
  fullName: string;
  username: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isAuthenticated: false,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      setLoading(false);
      return;
    }

    apiFetch("/api/auth/me")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Invalid session");
      })
      .then((data) => setUser(data.data))
      .catch(() => {
        localStorage.removeItem("authToken");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signOut = useCallback(async () => {
    await apiFetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("authToken");
    setUser(null);
    router.push("/auth/signin");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, loading, isAuthenticated: !!user, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
