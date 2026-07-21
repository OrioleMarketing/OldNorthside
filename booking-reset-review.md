# Booking Reset and Route Navigation Review

## Desktop booking review

The booking page displays the Start over control beside the date-selection guidance, before the calendar and availability panels. Its outline treatment, reset icon, and placement make the recovery action visible without competing with the primary booking flow.

## Mobile booking review

At 390 px wide, the guidance and Start over control stack into a full-width, comfortably sized action above the calendar. The control remains readable and keyboard-reachable, and the one-month calendar continues to fit within the booking card without horizontal overflow.

## Behavior coverage

Focused regression coverage verifies that the route-level scroll-restoration component responds to each location change and calls `window.scrollTo(0, 0)`. The booking-widget coverage verifies that Start over resets the dates, selected room, calendar month, and guest-input state.

## Runtime route-change verification

The live preview was opened on the Rooms page and then navigated to the Booking page. Both destination states reported **0 pixels above the viewport**, confirming that representative public routes load at the page top. The Booking destination also exposed the Start over button with the intended accessible label in the live interface.

## Scroll-down navigation verification

On the live Booking page, the page was scrolled until the browser reported **126 pixels above the viewport**, confirming a non-top starting position. The visible **Rooms** header link was then used for client-side navigation. The Rooms destination reported **0 pixels above the viewport**, confirming that the application returned the visitor to the top after navigating from a scrolled position.
