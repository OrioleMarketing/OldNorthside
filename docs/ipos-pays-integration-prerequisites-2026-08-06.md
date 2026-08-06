# iPOS Pays Integration Prerequisites

## Recommended initial scope

Use **iPOS Hosted Payment Page (HPP)** for guest-facing deposit, full-stay, and payment-link collection. HPP keeps card entry on the provider’s PCI DSS-compliant page and can be presented as a new page or light-box overlay. Do not collect raw card data in the Old Northside application.

Use **iPOS Transact** only for owner-authorized refunds, voids, and a later consent-gated balance-payment workflow. It requires a card token first created through HPP or another iPOS semi-integrated payment method; it is not a replacement for a hosted checkout.

## Required before any build or live activation

| Source | Required material | Reason |
|---|---|---|
| Innkeeper / iPOS ISO | Production iPOS merchant account and valid CloudPOS TPN | iPOS lists both as prerequisites for live HPP and Transact access. |
| Innkeeper / iPOS ISO | Separate sandbox (UAT) merchant account and sandbox CloudPOS TPN | Required for safe integration, booking-flow, refund, and failure-case testing. |
| Merchant administrator | Merchant-level API key and secret key generated in the iPOS portal, with `PaymentTokenization` scope; add `Recurring` only if approved stored-card balance collection is needed | Used to obtain short-lived authentication tokens for protected payment and status APIs. |
| Innkeeper / processor | Confirmation that HPP, the intended payment methods, and the direct booking use case are enabled for the merchant | The payment method/processor configuration must match the booked merchant account. |
| iPOS / ISO | HPP production endpoint, expected return/callback behavior, transaction-status procedure, and production-credential activation instructions | iPOS documents separate sandbox and production environments and a payment-status API; the integration must reconcile confirmed payments server-side. |
| Innkeeper | Merchant descriptor, receipt/contact details, cancellation/refund policy, and approved deposit/full-payment policy | Required for guest-facing checkout copy and consistent owner operations. |
| Innkeeper / technical owner | Authorization to register `oldnorthsidebedandbreakfast.com` and relevant return/callback URLs if iPOS requires them | Ensures payment handoff and return behavior work on the live custom domain. |

## Security and migration controls

1. Store all iPOS secrets only as server-side project secrets; never send them by email or chat, commit them to source control, or expose them to the browser.
2. Store only provider transaction identifiers and, if owner-authorized off-session charging is approved, provider-issued card tokens plus the recorded consent; never store PAN, CVV, or expiry data.
3. Leave existing Stripe reservations and historical payment identifiers intact. A payment-provider switchover affects new payment attempts only unless a separately approved migration plan states otherwise.
4. Verify every post-checkout payment using iPOS’s server-side transaction-status mechanism before confirming a reservation or applying payment to a balance.
5. Test deposits, full-stay payments, payment links, cancellation/void, refund, duplicate-submission protection, declined payment handling, and return-to-booking behavior in sandbox before any production key is activated.

## Sources

- iPOS Hosted Payment Page: https://docs.ipospays.com/hosted-payment-page
- iPOS HPP API prerequisites: https://docs.ipospays.com/hosted-payment-page/apidocs
- iPOS Authentication Token API: https://docs.ipospays.com/ipos-pays-authentication-token-api
- iPOS Transact: https://docs.ipospays.com/ipos-transact
