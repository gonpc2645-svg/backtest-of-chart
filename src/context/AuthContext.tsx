import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { LocalAuthService } from '../services/auth/localAuthService';
import { isSupabaseConfigured, supabase } from '../services/auth/supabaseClient';

export interface AuthActionResult {
  error: string | null;
  requiresEmailConfirmation?: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  signInWithEmail: (email: string, password: string) => Promise<AuthActionResult>;
  signUpWithEmail: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<AuthActionResult>;
  signInWithGoogle: () => Promise<AuthActionResult>;
  sendPasswordReset: (email: string) => Promise<AuthActionResult>;
  updatePassword: (newPassword: string) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const GOOGLE_NOT_CONFIGURED_MESSAGE =
  'Google Sign-In is not enabled on this deployment yet. Please sign up or log in with Email below — site owners can enable Google OAuth by adding VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY in Netlify Environment Variables.';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    if (!supabase) {
      LocalAuthService.getSessionUser()
        .then((result) => {
          if (!isMounted) return;
          setSession(null);
          setUser(result?.user ?? null);
        })
        .catch((err) => {
          console.warn('[AuthContext] Local session check warning:', err);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });

      return () => {
        isMounted = false;
      };
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.warn('[AuthContext] Session check warning:', error.message);
        }
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<AuthActionResult> => {
    if (!supabase) {
      const res = await LocalAuthService.signIn(email, password);
      if (res.error || !res.user) {
        return { error: res.error || 'Invalid email or password.' };
      }
      setSession(null);
      setUser(res.user);
      return { error: null };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    fullName?: string
  ): Promise<AuthActionResult> => {
    if (!supabase) {
      const res = await LocalAuthService.signUp(email, password, fullName);
      if (res.error || !res.user) {
        return { error: res.error || 'Could not create account.' };
      }
      setSession(null);
      setUser(res.user);
      return { error: null, requiresEmailConfirmation: false };
    }

    const cleanName = fullName?.trim();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: cleanName ? { full_name: cleanName } : undefined,
      },
    });
    if (error) return { error: error.message };

    // If email confirmation is required, session is null until verified
    const requiresEmailConfirmation = !data.session;
    return { error: null, requiresEmailConfirmation };
  };

  const signInWithGoogle = async (): Promise<AuthActionResult> => {
    if (!supabase) return { error: GOOGLE_NOT_CONFIGURED_MESSAGE };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const sendPasswordReset = async (email: string): Promise<AuthActionResult> => {
    if (!supabase) {
      return {
        error:
          'Password reset email delivery requires Cloud Auth (Supabase). Please create a new email account or ask the site owner to configure Supabase.',
      };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const updatePassword = async (newPassword: string): Promise<AuthActionResult> => {
    if (!supabase) {
      return { error: 'Password updates require an active Cloud Auth recovery session.' };
    }
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async (): Promise<void> => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    await LocalAuthService.signOut();
    setSession(null);
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      isConfigured: isSupabaseConfigured,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      sendPasswordReset,
      updatePassword,
      signOut,
    }),
    [user, session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }
  return ctx;
}
