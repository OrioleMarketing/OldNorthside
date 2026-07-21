# Room Gallery Validation Record

## Bridal Room lead-image coverage

The exterior image was removed from the guest-facing Bridal Room presentations. The live homepage card now renders `/manus-storage/bridal-room-1_13ca6d81.jpg`, an authorized Bridal Room interior image. The homepage source maps the `bridal-room` slug to the same managed asset, while the booking room-selection component uses each room record’s `imageUrl`. The live `bridal-room` database record resolves to that exact managed interior asset, so the booking selection surface uses the corrected lead photo as well.

| Guest-facing surface | Evidence | Result |
| --- | --- | --- |
| Homepage accommodation card | Live page and `Home.tsx` mapping use `bridal-room-1_13ca6d81.jpg` | Interior image confirmed |
| Rooms page gallery | Live Rooms page starts the Bridal Room gallery with `bridal-room-1_13ca6d81.jpg` | Interior image confirmed |
| Booking available-room selection | `BookingWidget.tsx` renders `room.imageUrl`; live Bridal Room database record resolves to `bridal-room-1_13ca6d81.jpg` | Interior image confirmed |

## Mobile gallery interaction validation

A live Chrome session was run at a 390 × 844 mobile viewport with touch emulation enabled. The Bridal Room gallery began at **1 / 5**. Activating the next control advanced the count to **2 / 5**; activating the third thumbnail selected **3 / 5**; and using the focused gallery’s right-arrow keyboard interaction advanced it to **4 / 5**. The active image label changed to “The Bridal Room, photo 4 of 5,” the fourth thumbnail held `aria-selected="true"`, and the next control retained the clear label “Show next The Bridal Room photo.”

| Check | Observed result |
| --- | --- |
| Mobile breakpoint | Active at 390 × 844 |
| Touch emulation | Enabled with one touch point |
| Next-control navigation | `1 / 5` → `2 / 5` |
| Thumbnail navigation | `2 / 5` → `3 / 5` |
| Keyboard navigation | `3 / 5` → `4 / 5` |
| Active-photo label | “The Bridal Room, photo 4 of 5” |
| Active thumbnail state | Fourth tab marked selected |
