# Production-Readiness Prerequisites

The public booking, reservation administration, deposit-or-full-stay checkout selection, room-block unblocking, and footer branding changes are implemented and validated in the project’s current published version. The remaining checklist items depend on information, credentials, or an authenticated owner session that cannot be supplied safely from the application code.

| Remaining item | What is needed | Owner action |
|---|---|---|
| Live Stripe checkout and webhook confirmation | A production-mode Stripe configuration and a safe authorized test transaction | Configure the live payment environment in **Settings → Payment**, then authorize a controlled checkout and webhook validation. |
| Production OTA synchronization | An authorized channel-management provider and its integration credentials or API access | Choose and authorize the channel-management provider, then provide the approved connection method. |
| Optional downloadable Visitor Guide | A final public URL or an owner-approved file | Send the guide URL or file to add beside the existing online Visitor Guide. |
| Authenticated owner-control visual review | A real owner session for the private dashboard | Sign in to the owner dashboard when prompted so the private action and Resend controls can be inspected for focus, hover, and 15px-radius behavior. |

Until the live payment and channel-management connections are supplied, the existing sandbox payment and provider-neutral channel synchronization implementation remain in place. The unauthenticated owner sign-in control, public primary and secondary actions, navigation controls, and booking utility control have already passed desktop and mobile interaction checks.
