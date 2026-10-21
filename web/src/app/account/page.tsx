"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Avatar } from "@/components/Nameplate";
import { sendPasswordReset, setUsername, signIn, signOut, signUp, updatePassword, useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/engine";
import { uploadAllLocal } from "@/lib/journal";
import { supabaseAvailable } from "@/lib/supabase";

type Tab = "signin" | "signup" | "reset";

function AuthForms() {
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next");
  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (tab === "signin") {
        await signIn(email, password);
        if (next) router.push(next);
      } else if (tab === "signup") {
        if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new Error("Usernames are 3–20 letters, numbers or underscores.");
        const { needsConfirmation } = await signUp(email, password, username);
        setMsg({ kind: "info", text: needsConfirmation ? "Almost there: check your email for a confirmation link, then sign in here." : "Welcome to the hive!" });
        if (!needsConfirmation && next) router.push(next);
      } else {
        await sendPasswordReset(email);
        setMsg({ kind: "info", text: "If that email has an account, a reset link is on its way." });
      }
    } catch (err) {
      setMsg({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="text-center">
        <h1 className="font-display text-4xl font-semibold">Join the hive</h1>
        <p className="mt-2 text-sm text-ink-soft">You can play everything without an account. Signing in keeps your journal across devices and lets you play rated games for an Elo rating.</p>
      </div>
      <div className="card mt-6 p-6">
        <div className="seg mb-5 w-full justify-center">
          {(
            [
              ["signin", "Sign in"],
              ["signup", "Create account"],
            ] as [Tab, string][]
          ).map(([t, n]) => (
            <button key={t} aria-pressed={tab === t} onClick={() => (setTab(t), setMsg(null))} className="flex-1">
              {n}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          {tab === "signup" && (
            <label className="block text-sm">
              <span className="label">Username</span>
              <input className="input" value={username} onChange={(e) => setName(e.target.value)} placeholder="queen_bee_42" autoComplete="username" required />
            </label>
          )}
          <label className="block text-sm">
            <span className="label">Email</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          {tab !== "reset" && (
            <label className="block text-sm">
              <span className="label">Password</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                autoComplete={tab === "signup" ? "new-password" : "current-password"}
                required
              />
            </label>
          )}
          {msg && <p className={msg.kind === "error" ? "note-error" : "note-info"}>{msg.text}</p>}
          <button className="btn w-full" disabled={busy || !supabaseAvailable()}>
            {busy ? "One moment…" : tab === "signin" ? "Sign in" : tab === "signup" ? "Create account" : "Send reset link"}
          </button>
        </form>
        <div className="mt-4 text-center text-xs text-muted">
          {tab === "reset" ? (
            <button className="underline" onClick={() => setTab("signin")}>
              Back to sign in
            </button>
          ) : (
            <button className="underline" onClick={() => (setTab("reset"), setMsg(null))}>
              Forgot your password?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Recovery() {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="card p-6">
        <h1 className="font-display text-2xl font-semibold">Choose a new password</h1>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await updatePassword(password);
              setMsg("Password updated.");
            } catch (err) {
              setMsg(errorMessage(err));
            }
          }}
        >
          <input className="input" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
          {msg && <p className="note-info">{msg}</p>}
          <button className="btn w-full">Save password</button>
        </form>
      </div>
    </div>
  );
}

function ProfilePanel() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  if (!user) return null;
  const total = profile ? profile.wins + profile.losses + profile.draws : 0;
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <Avatar color="w" initial={(profile?.username ?? "?").slice(0, 1).toUpperCase()} size={64} />
          <div className="min-w-0 flex-1">
            {editing ? (
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await setUsername(name);
                    await refreshProfile();
                    setEditing(false);
                    setMsg(null);
                  } catch (err) {
                    setMsg(errorMessage(err));
                  }
                }}
              >
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                <button className="btn">Save</button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-display truncate text-3xl font-semibold">{profile?.username}</h1>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setName(profile?.username ?? "");
                    setEditing(true);
                  }}
                >
                  Rename
                </button>
              </div>
            )}
            <div className="text-sm text-muted">{user.email}</div>
          </div>
        </div>
        {msg && <p className="note-error mt-3">{msg}</p>}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Rating", profile && profile.rated_games ? profile.rating : "—"],
            ["Peak", profile && profile.rated_games ? profile.peak_rating : "—"],
            ["Rated games", profile?.rated_games ?? 0],
            ["W / L / D", total ? `${profile!.wins} / ${profile!.losses} / ${profile!.draws}` : "—"],
          ].map(([k, v]) => (
            <div key={k as string} className="pencil pencil-clear p-3">
              <div className="label mb-0.5">{k}</div>
              <div className="font-display text-2xl font-semibold">{v}</div>
            </div>
          ))}
        </div>
        {profile && profile.rated_games === 0 && <p className="mt-3 text-sm text-muted">Play a rated online game to get your first rating. Everyone starts at 1200.</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link className="btn" href="/journal">
            Your journal
          </Link>
          {profile && (
            <Link className="btn-secondary" href={`/player?u=${encodeURIComponent(profile.username)}`}>
              Public profile
            </Link>
          )}
          <button
            className="btn-secondary"
            disabled={uploading}
            onClick={async () => {
              setUploading(true);
              const n = await uploadAllLocal(user.id).catch(() => 0);
              setUploading(false);
              setMsg(null);
              alert(`Copied ${n} game${n === 1 ? "" : "s"} from this browser to your account.`);
            }}
          >
            {uploading ? "Uploading…" : "Upload this browser's games"}
          </button>
          <button className="btn-secondary" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountInner() {
  const { user, loading, recovering } = useAuth();
  if (loading) return <div className="grid h-[50vh] place-items-center text-muted">Loading…</div>;
  if (recovering) return <Recovery />;
  return user ? <ProfilePanel /> : <AuthForms />;
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountInner />
    </Suspense>
  );
}
