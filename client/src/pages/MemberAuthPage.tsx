import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, KeyRound, Mail, UserPlus } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import "@/member-auth.css";

type Mode = "login" | "register" | "magic";

function messageFor(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function MemberAuthPage() {
  const [location, navigate] = useLocation();
  const { user, loading, refresh } = useAuth();
  const [mode, setMode] = useState<Mode>(location === "/register" ? "register" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const verificationError = useMemo(() => {
    if (typeof window === "undefined") return "";
    const value = new URLSearchParams(window.location.search).get("error");
    if (value === "invalid_or_expired") return "That sign-in link has expired or was already used. Request a new one below.";
    if (value === "verification_failed") return "We could not verify that sign-in link. Please request a new one.";
    return "";
  }, []);

  useEffect(() => {
    if (!loading && user) navigate(user.id < 0 ? "/owner" : "/", { replace: true });
  }, [loading, navigate, user]);

  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await refresh();
      navigate("/");
    },
    onError: value => setError(messageFor(value, "Invalid email or password.")),
  });
  const register = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await refresh();
      navigate("/");
    },
    onError: value => setError(messageFor(value, "The account could not be created.")),
  });
  const magic = trpc.auth.requestMagicLink.useMutation({
    onSuccess: () => setSent(true),
    onError: value => setError(messageFor(value, "The sign-in email could not be requested.")),
  });

  if (loading || user) return null;

  const setAuthMode = (next: Mode) => {
    setMode(next);
    setError("");
    setSent(false);
    navigate(next === "register" ? "/register" : "/login", { replace: true });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (mode === "login") await login.mutateAsync({ email, password, rememberMe }).catch(() => undefined);
    else if (mode === "register") await register.mutateAsync({ name, email, password }).catch(() => undefined);
    else await magic.mutateAsync({ email }).catch(() => undefined);
  };

  const pending = login.isPending || register.isPending || magic.isPending;
  const icon = mode === "login" ? <KeyRound size={21} /> : mode === "register" ? <UserPlus size={21} /> : <Mail size={21} />;

  return (
    <main className="member-auth-page">
      <div className="member-auth-card">
        <section className="member-auth-intro">
          <p className="eyebrow">Old Northside · Indianapolis</p>
          <h1>A gracious welcome, made simpler.</h1>
          <p>Create an account or sign in to use secure guest features as they become available. Reservation booking remains open to everyone.</p>
          <div className="member-auth-points">
            <span><CheckCircle2 size={18} /> Password or passwordless access</span>
            <span><CheckCircle2 size={18} /> Single-use email links</span>
            <span><CheckCircle2 size={18} /> Separate, protected innkeeper access</span>
          </div>
          <Link href="/" className="member-auth-home">Return to the inn</Link>
        </section>

        <section className="member-auth-form-wrap">
          <div className="member-auth-tabs" role="tablist" aria-label="Member authentication method">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Sign in</button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Register</button>
            <button type="button" className={mode === "magic" ? "active" : ""} onClick={() => setAuthMode("magic")}>Email link</button>
          </div>

          <div className="member-auth-heading"><span>{icon}</span><div><h2>{mode === "login" ? "Welcome back" : mode === "register" ? "Create your account" : "Request a secure link"}</h2><p>{mode === "magic" ? "The one-time link expires in 15 minutes." : mode === "register" ? "Use a strong password of at least 12 characters." : "Use your member email and password."}</p></div></div>

          {sent ? (
            <div className="member-auth-success"><CheckCircle2 /><h3>Check your email</h3><p>If an account exists for <strong>{email}</strong>, a secure sign-in link is on its way. Check your spam folder if it does not arrive shortly.</p><button type="button" onClick={() => setSent(false)}>Request another link</button></div>
          ) : (
            <form onSubmit={submit} className="member-auth-form">
              {mode === "register" && <label>Name<input value={name} onChange={event => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={180} required /></label>}
              <label>Email address<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" maxLength={320} required /></label>
              {mode !== "magic" && <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 12 : 1} maxLength={256} required /></label>}
              {mode === "login" && <label className="member-auth-check"><input type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} /> Keep me signed in for 30 days</label>}
              {(error || verificationError) && <div role="alert" className="member-auth-error">{error || verificationError}</div>}
              <button type="submit" className="member-auth-submit" disabled={pending}>{pending ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Send secure link"}</button>
            </form>
          )}

          <p className="member-auth-owner">Innkeeper? <Link href="/owner">Use the owner portal</Link>.</p>
        </section>
      </div>
    </main>
  );
}
