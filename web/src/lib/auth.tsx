"use client";

// Optional accounts via Supabase Auth (email + password, or Google). Everything works
// signed out; signing in adds a cloud journal, Elo rating and profile.
import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { sb, supabaseAvailable } from "./supabase";

export interface Profile {
  id: string;
  username: string;
  rating: number;
  peak_rating: number;
  rated_games: number;
  wins: number;
  losses: number;
  draws: number;
  created_at: string;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** Set after following a password-reset link. */
  recovering: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({ user: null, profile: null, loading: true, recovering: false, refreshProfile: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  const loadProfile = useCallback(async (u: User | null) => {
    if (!u) {
      setProfile(null);
      return;
    }
    const { data } = await sb().from("profiles").select("*").eq("id", u.id).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    if (!supabaseAvailable()) {
      setLoading(false);
      return;
    }
    const client = sb();
    client.auth.getSession().then(async ({ data }) => {
      setUser(data.session?.user ?? null);
      await loadProfile(data.session?.user ?? null);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setUser(session?.user ?? null);
      // Supabase warns against awaiting inside this callback.
      setTimeout(() => loadProfile(session?.user ?? null), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [loadProfile]);

  const refreshProfile = useCallback(() => loadProfile(user), [loadProfile, user]);

  return <AuthContext.Provider value={{ user, profile, loading, recovering, refreshProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

function origin() {
  return typeof window === "undefined" ? "" : window.location.origin;
}

export async function signUp(email: string, password: string, username: string) {
  const { data, error } = await sb().auth.signUp({
    email,
    password,
    options: { data: { username }, emailRedirectTo: `${origin()}/account` },
  });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function signIn(email: string, password: string) {
  const { error } = await sb().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/** Leaves for Google's sign-in and comes back to `path` signed in (the project is shared with Sam's other apps). */
export async function signInWithGoogle(path = "/account") {
  const { error } = await sb().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin()}${path}` } });
  if (error) throw error;
}

export async function signOut() {
  await sb().auth.signOut();
}

export async function sendPasswordReset(email: string) {
  const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/account` });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await sb().auth.updateUser({ password });
  if (error) throw error;
}

export async function setUsername(username: string) {
  const { error } = await sb().rpc("set_username", { p_username: username });
  if (error) throw new Error(error.message);
}
