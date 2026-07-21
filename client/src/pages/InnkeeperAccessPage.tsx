import DashboardLayout, { type DashboardNavigationItem } from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { CalendarDays, CheckCircle2, Clipboard, KeyRound, Mail, ShieldCheck, UserRoundPlus, UserX } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

const accessNavigation: DashboardNavigationItem[] = [
  { icon: CalendarDays, label: "Reservations", path: "/owner" },
  { icon: ShieldCheck, label: "Innkeeper access", path: "/owner/access" },
];

function formatDate(value: Date | string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function InnkeeperAccessPage() {
  const utils = trpc.useUtils();
  const access = trpc.owner.administratorAccess.useQuery();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteRecipient, setInviteRecipient] = useState<string | null>(null);

  const invite = trpc.owner.inviteAdministrator.useMutation({
    onSuccess: async result => {
      const link = `${window.location.origin}/owner/invite?token=${encodeURIComponent(result.token)}`;
      setInviteLink(link);
      setInviteRecipient(result.invite.email);
      setName("");
      setEmail("");
      toast.success("A one-time innkeeper invitation is ready to share.");
      await utils.owner.administratorAccess.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const revokeAdministrator = trpc.owner.revokeAdministrator.useMutation({
    onSuccess: async () => {
      toast.success("The innkeeper account has been deactivated and its active sessions will no longer be accepted.");
      await utils.owner.administratorAccess.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const revokeInvitation = trpc.owner.revokeAdministratorInvitation.useMutation({
    onSuccess: async () => {
      toast.success("The invitation has been revoked.");
      await utils.owner.administratorAccess.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  async function copyInvitation() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("The secure invitation link has been copied.");
    } catch {
      toast.error("Copying was blocked by this browser. Select and copy the link manually.");
    }
  }

  function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    invite.mutate({ name, email });
  }

  return <DashboardLayout navigationItems={accessNavigation} navigationTitle="Old Northside">
    <div className="owner-dashboard owner-access-management">
      <header className="owner-dashboard__header">
        <div><p className="eyebrow eyebrow--gold">Authorized staff</p><h1 className="font-display">Innkeeper access</h1><p>Grant trusted colleagues their own portal credentials. Invitation links are single use, expire after 72 hours, and never reveal a password to this dashboard.</p></div>
      </header>

      <div className="owner-dashboard__lower-grid owner-access-management__grid">
        <section className="owner-panel">
          <div className="owner-panel__heading"><span className="owner-panel__icon"><UserRoundPlus size={18} /></span><div><p className="eyebrow">New administrator</p><h2 className="font-display">Create invitation</h2></div></div>
          <form className="owner-form" onSubmit={submitInvitation}>
            <label>Administrator name<input value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={180} autoComplete="name" required /></label>
            <label>Email address<input type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={320} autoComplete="email" required /></label>
            <p className="owner-form__note"><KeyRound size={14} /> The recipient will choose their own password after opening the one-time link. A new invitation replaces any pending invitation for the same email address.</p>
            <button className="owner-button" type="submit" disabled={invite.isPending}>{invite.isPending ? "Creating invitation…" : "Create secure invitation"}</button>
          </form>
        </section>

        <section className="owner-panel">
          <div className="owner-panel__heading"><span className="owner-panel__icon"><Clipboard size={18} /></span><div><p className="eyebrow">Share privately</p><h2 className="font-display">Invitation link</h2></div></div>
          {inviteLink ? <div className="owner-invite-link" aria-live="polite">
            <strong>Ready for {inviteRecipient}</strong>
            <p>Share this link only with the intended colleague. It expires 72 hours after creation and cannot be used again after activation.</p>
            <input aria-label="Secure innkeeper invitation link" value={inviteLink} readOnly onFocus={event => event.currentTarget.select()} />
            <button className="owner-button owner-button--quiet" type="button" onClick={copyInvitation}><Clipboard size={15} /> Copy invitation link</button>
          </div> : <p className="owner-empty">Create an invitation to generate a secure setup link for a new administrator.</p>}
        </section>
      </div>

      <section className="owner-panel owner-panel--reservations owner-access-management__panel">
        <div className="owner-panel__heading"><span className="owner-panel__icon"><ShieldCheck size={18} /></span><div><p className="eyebrow">Active accounts</p><h2 className="font-display">Current innkeeper administrators</h2></div></div>
        {access.isLoading ? <p className="owner-empty">Loading innkeeper access…</p> : access.data?.admins.length ? <div className="owner-access-list">{access.data.admins.map(admin => <article key={admin.id} className={`owner-access-card ${admin.isActive ? "" : "owner-access-card--inactive"}`}>
          <div><strong>{admin.name}</strong><span><Mail size={13} /> {admin.email}</span><small>{admin.isActive ? `Last sign-in: ${formatDate(admin.lastSignedIn)}` : "Access revoked"}</small></div>
          {admin.isActive ? <button className="owner-cancel-button" type="button" onClick={() => revokeAdministrator.mutate({ adminId: admin.id })} disabled={revokeAdministrator.isPending}><UserX size={14} /> Revoke access</button> : <span className="reservation-status reservation-status--cancelled">Inactive</span>}
        </article>)}</div> : <p className="owner-empty">No innkeeper administrators have been provisioned yet.</p>}
      </section>

      <section className="owner-panel owner-panel--reservations owner-access-management__panel">
        <div className="owner-panel__heading"><span className="owner-panel__icon"><CheckCircle2 size={18} /></span><div><p className="eyebrow">Invitation record</p><h2 className="font-display">Recent invitations</h2></div></div>
        {access.isLoading ? <p className="owner-empty">Loading invitation record…</p> : access.data?.invites.length ? <div className="owner-access-list">{access.data.invites.map(invitation => <article key={invitation.id} className="owner-access-card">
          <div><strong>{invitation.name}</strong><span><Mail size={13} /> {invitation.email}</span><small>{invitation.status === "pending" ? `Expires ${formatDate(invitation.expiresAt)}` : `${invitation.status[0].toUpperCase()}${invitation.status.slice(1)} ${invitation.activatedAt ? formatDate(invitation.activatedAt) : ""}`}</small></div>
          {invitation.status === "pending" ? <button className="owner-cancel-button" type="button" onClick={() => revokeInvitation.mutate({ inviteId: invitation.id })} disabled={revokeInvitation.isPending}><UserX size={14} /> Revoke invitation</button> : <span className={`reservation-status ${invitation.status === "activated" ? "reservation-status--confirmed" : "reservation-status--cancelled"}`}>{invitation.status}</span>}
        </article>)}</div> : <p className="owner-empty">No administrator invitations have been created.</p>}
      </section>
    </div>
  </DashboardLayout>;
}
