import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";

export interface User {
  id: string;
  displayName: string;
  email: string;
  ttsEnabled: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  aiMode: "openai" | "mock" | null;
  model: string | null;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiMode, setAiMode] = useState<"openai" | "mock" | null>(null);
  const [model, setModel] = useState<string | null>(null);

  async function refresh() {
    try {
      const [me, health] = await Promise.all([api.me(), api.health()]);
      setUser(me);
      setAiMode(health.aiMode);
      setModel(health.model);
    } catch {
      setUser(null);
      try {
        const health = await api.health();
        setAiMode(health.aiMode);
        setModel(health.model);
      } catch {
        setAiMode(null);
        setModel(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      aiMode,
      model,
      refresh,
      setUser,
      async login(email, password) {
        const next = await api.login({ email, password });
        setUser(next as User);
      },
      async register(displayName, email, password) {
        const next = await api.register({ displayName, email, password });
        setUser(next as User);
      },
      async logout() {
        await api.logout();
        setUser(null);
      },
    }),
    [user, loading, aiMode, model],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
