## Cover

# Channel Manager Decision
## A practical Expedia integration strategy for Old Northside Bed and Breakfast
### Seven rooms • direct booking site • August 2026

## Slide 1

# The decision is about inventory control

- Old Northside needs to keep direct bookings and Expedia availability synchronized without introducing avoidable overbooking risk.
- The immediate choice is between a low-cost, configurable operating model and an all-in-one hospitality platform.
- The selected channel manager should become the **single source of truth** for OTA inventory.

## Slide 2

# Beds24 is materially lower cost at seven rooms

| Commercial view | eviivo Suite | Beds24 |
|---|---:|---:|
| Published monthly entry point | From **$50** per single property | **€31.65/month** in the public calculator for 7 rooms, 1 room type, 1 OTA |
| Pricing approach | Tailored to inventory and selected features | Usage-based by rooms and active channel links |
| Additional recurring costs | Optional managers add $1–$3 per room/month | €0.55 per channel connection link/month; optional services separately priced |

**Interpretation:** Beds24 is the cost leader for a simple one-OTA configuration. eviivo’s $50 is a starting floor, not a seven-room quote. [1] [2]

## Slide 3

# Commercial risk is lower with Beds24

| Term or onboarding point | eviivo Suite | Beds24 |
|---|---|---|
| Trial / initial use | No free trial; first 30 days free and billed in arrears | 14-day fully functional free trial |
| Setup fee | Not publicly published for a seven-room implementation; confirm in quote | No setup fee; self-service onboarding |
| Contract commitment | Public page does not state standard term or notice; confirm in service agreement | No contract and no minimum term |
| Support model | Demo-led and quote-led | Documentation, tutorials, webinars, and ticket support |

**Decision implication:** Use a written eviivo quote to resolve onboarding, termination notice, and implementation support before comparing it against Beds24’s transparent self-service model. [1] [3]

## Slide 4

# Both finalists can replace manual Expedia updates

**eviivo Suite**

- Expedia Preferred Partner positioning with instant two-way updates.
- Can synchronize bookings, availability, rates, content, policies, promotions, fees, conversations, and reviews.
- Best fit when one user-friendly hospitality platform should run the inn.

**Beds24**

- Expedia Elite Partner status reported for 2025 with official two-way Expedia connectivity.
- Supports real-time booking import plus rates and inventory updates.
- Best fit when flexible configuration and cost discipline are the priority. [4] [5]

## Slide 5

# API connectivity is an operating system; iCal is a safety net

| Dimension | Two-way channel-manager API | Current iCal bridge |
|---|---|---|
| Data exchanged | Bookings, availability, rates, and often restrictions / content | Calendar events and blocked dates only |
| Update model | Structured, authenticated two-way messages | Periodic file import/export (`.ics`) |
| Payments and guest data | Managed in the PMS / OTA workflow | Not exchanged |
| Best use | Primary OTA operating model | Temporary availability protection or light-use fallback |

**Key point:** Do not run two independent real-time inventory masters. The direct website should synchronize with the chosen manager, which then synchronizes with Expedia. [4] [5]

## Slide 6

# iCal protects dates—but not the full booking journey

- Vrbo’s iCal documentation says imported calendar events can take up to 20 minutes to appear and its calendars synchronize every 30 minutes.
- iCal does not convey real-time rates, length-of-stay restrictions, payment state, or confirmed booking acknowledgement.
- Circularly exporting and re-importing tentative bookings can create payment problems.

**Conclusion:** iCal is an acceptable bridge while the inn selects a manager; it is not the long-term control plane for multi-channel inventory. [6] [7]

## Slide 7

# Recommended target architecture: one inventory master

**Stage 1 — Stabilize**

Keep current external calendars active. Add per-room iCal import/export only after the client shares live feed URLs and room mappings.

**Stage 2 — Select and map**

Choose eviivo or Beds24. Map all seven rooms and rate plans in a sandbox or parallel-test environment.

**Stage 3 — Cut over**

Make the selected manager the inventory source of truth. Connect Expedia via certified API and connect the direct-booking website through the manager’s supported interface. Retire the duplicate iCal loop after validation.

## Slide 8

# Recommendation: demo both, favor based on operating style

| If the priority is… | Recommended finalist | Why |
|---|---|---|
| Lowest operating cost, granular control, adaptable direct site | **Beds24** | Transparent pay-as-you-go pricing and low seven-room estimate |
| Simpler all-in-one workflow and more managed hospitality operations | **eviivo Suite** | Broader integrated PMS/channel-management experience |

**Do not decide from the headline price alone.** Require both vendors to demonstrate the Expedia mapping, the direct-site integration method, the seven-room onboarding plan, and the complete first-year cost.

## Slide 9

# The next decision meeting should answer five questions

1. Can the existing Expedia listing be connected and its seven rooms mapped without recreating the listing?
2. Will the product synchronize availability, rates, restrictions, and reservations—not merely iCal blocks?
3. What supported API, webhook, or iCal option connects the custom direct-booking site to the manager?
4. Who owns mapping, test reservations, cutover, and rollback support?
5. What are the complete monthly, onboarding, payment, support, and cancellation costs in writing?

## Slide 10

# Recommended decision: evaluate eviivo and Beds24 side by side
## Use iCal only as a controlled bridge; adopt a certified API manager as the long-term inventory hub.

## Slide 11

# Sources

[1] eviivo pricing — https://eviivo.com/pricing/

[2] Beds24 pricing calculator — https://beds24.com/pricing.html

[3] Beds24 FAQ — https://beds24.com/faq.html

[4] eviivo Expedia connection — https://eviivo.com/products/channel-manager/expedia-connection/

[5] Beds24 channel manager and news — https://beds24.com/channel-manager.html • https://beds24.com/news.html

[6] Vrbo iCal import — https://help.vrbo.com/articles/How-do-I-import-my-iCal-or-Google-calendar

[7] Vrbo iCal export — https://help.vrbo.com/articles/Export-your-reservation-calendar
