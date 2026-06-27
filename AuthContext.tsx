import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { TeamMember, UserSession } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id:          string;
  name:        string;
  email:       string;
  role:        TeamMember['role'];
  accessLevel: 'user' | 'supervisor' | 'admin';
  department:  string;
  initials:    string;
  color:       string;
  subscriptionStatus?: 'trialing' | 'active' | 'expired' | 'canceled';
  trialEndsAt?: string | null;
  trialDaysRemaining?: number | null;
}

interface AuthContextType {
  user:            AuthUser | null;
  token:           string | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
  session:         UserSession | null;
  login:           (email: string, password: string) => Promise<void>;
  register:        (name: string, email: string, password: string) => Promise<void>;
  logout:          () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | null>(null);

function readAuthUser(payload: unknown): AuthUser | null {
  if (!payload || typeof payload !== 'object') return null;
  const wrapped = payload as { user?: unknown };
  const candidate = wrapped.user && typeof wrapped.user === 'object' ? wrapped.user : payload;
  const authUser = candidate as Partial<AuthUser>;
  return authUser.id && authUser.email ? authUser as AuthUser : null;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,      setUser]      = useState<AuthUser | null>(null);
  const [token,     setToken]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Re-hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('nyota_token');
    if (!stored) { setIsLoading(false); return; }

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${stored}` } })
      .then(async r => (r.ok ? readAuthUser(await r.json()) : null))
      .then(userData => {
        if (userData) { setToken(stored); setUser(userData); }
        else          { localStorage.removeItem('nyota_token'); }
      })
      .catch(() => localStorage.removeItem('nyota_token'))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    const newToken = data.token;
    const userData = readAuthUser(data);
    if (!newToken || !userData) throw new Error('Login response was incomplete');
    localStorage.setItem('nyota_token', newToken);
    setToken(newToken);
    setUser(userData);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Signup failed' }));
      throw new Error(err.error || 'Signup failed');
    }
    const data = await res.json();
    const newToken = data.token;
    const userData = readAuthUser(data);
    if (!newToken || !userData) throw new Error('Signup response was incomplete');
    localStorage.setItem('nyota_token', newToken);
    setToken(newToken);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('nyota_token');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!user?.trialEndsAt || user.subscriptionStatus !== 'trialing') return;

    const msUntilTrialEnds = new Date(user.trialEndsAt).getTime() - Date.now();
    if (msUntilTrialEnds <= 0) {
      logout();
      return;
    }

    const trialEndsAtMs = new Date(user.trialEndsAt).getTime();
    const maxSafeDelay = 24 * 60 * 60 * 1000;
    let timeout: number | undefined;
    const scheduleTrialCheck = () => {
      const remaining = trialEndsAtMs - Date.now();
      if (remaining <= 0) {
        logout();
        return;
      }
      timeout = window.setTimeout(scheduleTrialCheck, Math.min(remaining, maxSafeDelay));
    };
    scheduleTrialCheck();
    return () => {
      if (timeout) window.clearTimeout(timeout);
    };
  }, [logout, user?.subscriptionStatus, user?.trialEndsAt]);

  // Build a UserSession object from the auth user so App.tsx doesn't change much
  const session: UserSession | null = user
    ? {
        user: {
          id:          user.id,
          name:        user.name,
          role:        user.role,
          initials:    user.initials,
          color:       user.color,
          department:  user.department,
          subscriptionStatus: user.subscriptionStatus,
          trialEndsAt: user.trialEndsAt,
          trialDaysRemaining: user.trialDaysRemaining,
          permissions: {
            canViewAllData:      user.accessLevel !== 'user',
            canEditUsers:        user.accessLevel === 'admin',
            canApproveActions:   user.accessLevel !== 'user',
            canAccessStatewide:  user.accessLevel !== 'user',
            canManageTeams:      user.accessLevel === 'admin',
            canViewAnalytics:    true,
          },
        },
        isAuthenticated: true,
        sessionStart:    new Date(),
        lastActivity:    new Date(),
        accessLevel:     user.accessLevel,
      }
    : null;

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!user, isLoading, session, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
