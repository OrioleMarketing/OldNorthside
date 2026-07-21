# Button Radius Review

## Scope

The public homepage and direct-booking page were reviewed at desktop (1440 × 960) and phone (390 × 844) viewports after the global 15px button-radius rule was strengthened to override component-specific styling.

## Findings

The desktop homepage shows the header Book Direct action, hero calls to action, and the floating contact-card Book Direct action with a consistent moderate 15px corner treatment. The booking page shows the Start over control with the same radius, without affecting its visual weight or placement.

On the phone viewport, the hero calls to action, floating-card Book Direct action, menu control, and booking Start over control remain clear, reachable, and visibly consistent. Button labels maintain contrast, and no hover or focus styling was removed by the radius update.

## Validation

Type checking and focused homepage regression coverage pass. The shared CSS rule explicitly targets native buttons and site-specific button classes with sufficient specificity to override the former pill-radius variants. Calendar date cells remain intentionally excluded as compact date-selection controls rather than general call-to-action buttons.

## In-progress validation — desktop homepage (2026-07-21)

The initial computed-style pass on the desktop homepage confirms **`border-radius: 15px`** for visible representatives of the primary, ghost, dark, hero-transition, navigation, Visit Indy, and reservation call-to-action variants. The inspected controls include `Check availability`, `Explore the rooms`, the overlapping-contact-card `Book Direct`, `Plan your stay`, `Explore Visit Indy`, `Reserve a room`, and the header `Book Direct` control. Their transition declarations remain present and their focus styling remains defined prior to the explicit keyboard-focus checks.

An explicit desktop hover check on the hero `Check availability` primary call to action confirms that the element matches `:hover`, keeps a computed **`15px`** radius, preserves its readable dark-on-gold hover palette, and does not introduce an unexpected transform or clipping artifact.

A keyboard-only `Tab` traversal starts at the site wordmark and produces a visible focus outline with an offset, establishing that focus-visible behavior remains active at the page entry point. The wordmark is a non-button identity link and intentionally retains its square visual treatment; button-specific focus checks continue separately.

Button-specific focus checks on the desktop homepage confirm that the primary `Check availability` control is focused, matches `:focus-visible`, has a computed **`15px`** radius, and exposes an offset focus outline. The `Start over` booking-reset control is likewise focused, matches `:focus-visible`, and retains a computed **`15px`** radius; its specialized component styling is inspected further in the final visual capture to confirm the focus cue remains perceptible in context.

After the targeted focus-style correction, the running site's `Start over` control is focused, matches `:focus-visible`, retains a computed **`15px`** radius, and now renders a clear **3px solid dark-green outline with a 3px offset**. The dedicated desktop booking page also presents that control cleanly beside the booking introduction without clipping or layout disruption.

The unauthenticated owner route is available for passive review only; its `Sign in` utility button computes to **`15px`** and receives keyboard focus. Authenticated owner-only action and resend controls cannot be reviewed without entering the protected owner session, so their class-specific radius coverage remains verified through source-level testing rather than a live authenticated interaction.

The expanded global focus treatment has now been verified in the running owner sign-in experience: the generic `Sign in` button is focused, matches `:focus-visible`, retains **`15px`** corners, and displays the same clear **3px dark-green outline with a 3px offset**. This closes the generic-button focus-visibility gap identified during review.

An explicit desktop hover check on the header `Book Direct` navigation action confirms it matches `:hover`, keeps a computed **`15px`** radius, shifts to its approved gold surface with dark readable text, and shows no transform or clipping issue.

The desktop primary and navigation hover treatments are now confirmed. The secondary hero action has been retargeted using its live bounding rectangle; the visual hover state is present and its computed values are captured in the following review step.

The desktop `Explore the rooms` secondary hero action now also passes the explicit hover check: it matches `:hover`, retains a computed **`15px`** radius, changes to a high-contrast light surface with dark text, and shows no transform or clipping issue.

## Mobile visual review (390 × 844)

Representative mobile captures of the homepage, booking page, and owner route show the menu control, primary and secondary hero calls to action, overlapping-card `Book Direct` call to action, booking `Start over` control, and owner-calendar navigation controls with a consistent moderate corner treatment. The mobile booking reset control expands cleanly to the available width, retains clear label/icon spacing, and does not clip its new focus outline. The contrast and touch-target presentation remain clear at the phone viewport.

## Desktop visual review (1280 × 720)

Representative desktop captures of the homepage, booking page, and owner-calendar layout in the project preview show consistent **15px** treatment across the header `Book Direct` action, primary and secondary hero calls to action, contact-card `Book Direct` action, booking reset action, and calendar navigation controls. The corners remain visually even, without clipping or layout shifts, at both desktop and mobile breakpoints.

The combined source-level control inventory, targeted computed-style captures, interactive hover/focus checks, and desktop/mobile visual inspection verify all publicly accessible controls. A live authenticated-session interaction review remains outstanding for owner-only action and resend controls because the available browser session is currently signed out.
