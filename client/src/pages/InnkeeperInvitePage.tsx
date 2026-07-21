import { trpc } from "@/lib/trpc";
import { ArrowLeft, KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function InnkeeperInvitePage() {
  const [location, setLocation] = useLocation();
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") ?? "", [location]);
  const invitation = trpc.auth.getInnkeeperInvitation.useQuery({ token }, { enabled: Boolean(token), retry: false });
  const utils = trpc.useUtils();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const activate = trpc.auth.activateInnkeeperInvitation.useMutation({
    onSuccess: async user => {
      utils.auth.me.setData(undefined, user);
      await utils.auth.me.invalidate();
      toast.success("Your innkeeper account is ready.");
      setLocation("/owner");
    },
    onError: error => setLocalError(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    if (password !== confirmation) {
      setLocalError("The passwords do not match.");
      return;
    }
    activate.mutate({ token, password });
  }

  if (!token || invitation.isError || (!invitation.isLoading && !invitation.data)) {
    return <main className="innkeeper-login"><section className="innkeeper-login__panel"><Link href="/owner" className="innkeeper-login__back"><ArrowLeft size={16} /> Return to sign in</Link><div className="innkeeper-login__mark"><ShieldCheck size={18} /> Old Northside</div><h1 className="font-display">Invitation unavailable</h1><p className="innkeeper-login__copy">This invitation is invalid, expired, revoked, or has already been used. Ask an existing innkeeper administrator to create a new invitation.</p></section></main>;
  }

  return <main className="innkeeper-login"><section className="innkeeper-login__panel">
    <Link href="/owner" className="innkeeper-login__back"><ArrowLeft size={16} /> Return to sign in</Link>
    <div className="innkeeper-login__mark"><ShieldCheck size={18} /> Old Northside</div>
    <h1 className="font-display">Set up innkeeper access</h1>
    <p className="innkeeper-login__copy">You have been invited as <strong>{invitation.data?.name}</strong>. Create your own password to access the reservation calendar and owner controls.</p>
    <form className="innkeeper-login__form" onSubmit={submit}>
      <label>Email address<span className="innkeeper-login__field"><Mail size={16} /><input value={invitation.data?.email ?? ""} readOnly aria-readonly="true" /></span></label>
      <label>New password<span className="innkeeper-login__field"><KeyRound size={16} /><input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={12} maxLength={256} autoComplete="new-password" required /></span></label>
      <label>Confirm password<span className="innkeeper-login__field"><LockKeyhole size={16} /><input type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} minLength={12} maxLength={256} autoComplete="new-password" required /></span></label>
      {localError ? <p className="innkeeper-login__error" role="alert">{localError}</p> : null}
      <button className="inn-button" type="submit" disabled={activate.isPending || invitation.isLoading}>{activate.isPending ? "Creating access…" : "Create innkeeper account"}</button>
    </form>
    <p className="innkeeper-login__help">Choose at least 12 characters. This secure setup link can be used only once and expires after 72 hours.</p>
  </section></main>;
}
