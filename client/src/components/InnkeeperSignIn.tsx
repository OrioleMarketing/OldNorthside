import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowLeft, LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "wouter";

export default function InnkeeperSignIn() {
  const { login, loginPending, loginError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await login({ email, password });
      setPassword("");
    } catch {
      // The server supplies a safe, non-enumerating message through loginError.
    }
  }

  const errorMessage = loginError instanceof Error ? loginError.message : null;
  return <main className="innkeeper-login"><div className="innkeeper-login__panel">
    <Link href="/" className="innkeeper-login__back"><ArrowLeft size={15} /> Guest website</Link>
    <div className="innkeeper-login__mark"><LockKeyhole size={20} /><span>Old Northside</span></div>
    <p className="eyebrow eyebrow--gold">Private access</p>
    <h1 className="font-display">Innkeeper sign in</h1>
    <p className="innkeeper-login__copy">Use your authorized innkeeper email and password to manage reservations, room blocks, and guest payment requests.</p>
    <form onSubmit={submit} className="innkeeper-login__form">
      <label>Email address<span className="innkeeper-login__field"><Mail size={16} /><input type="email" name="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required disabled={loginPending} /></span></label>
      <label>Password<input type="password" name="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={loginPending} /></label>
      {errorMessage ? <p className="innkeeper-login__error" role="alert">{errorMessage}</p> : null}
      <button type="submit" className="inn-button inn-button--dark" disabled={loginPending}>{loginPending ? "Signing in…" : "Sign in securely"}</button>
    </form>
    <p className="innkeeper-login__help">Need access? Please contact the innkeeper to have an administrator account created for you.</p>
  </div></main>;
}
