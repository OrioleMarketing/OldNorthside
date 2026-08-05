# Homepage Performance Audit — 2026-08-05

## GTmetrix evidence supplied by the owner

The GTmetrix report for `https://oldnorthsidebedandbreakfast.com/` reported a B grade, 90% performance score, 79% structure score, First Contentful Paint of 1.2 seconds, Largest Contentful Paint of 1.6 seconds, Total Blocking Time of 87 milliseconds, Cumulative Layout Shift of 0, and a fully loaded time of 1.7 seconds.

The primary audit was **Avoid enormous network payloads**, with a total transfer size of 8.95 MB. The report estimated 3.97 MB of savings from more efficient image encoding and 4.94 MB from next-generation image formats. It also identified one image missing explicit dimensions, a CSS `@import`, 165 KB of unused JavaScript, and several image-path redirects. The large image entries shown were the parking image at 2.73 MB and five room/property JPEGs around 1.09–1.18 MB each.

## Source asset measurements

| Asset | Original format and dimensions | Original bytes | Optimized WebP variants |
|---|---:|---:|---|
| Hero Dewenter room | JPEG, 1280×853 | 1,232,468 | 1280w: 126,360; 768w: 47,616 |
| Story literary room | JPEG, 1280×853 | 1,139,388 | 960w: 87,752; 640w: 44,538 |
| Bridal room card | JPEG, 1280×853 | 1,145,289 | 960w: 78,596; 640w: 39,578 |
| Tiffany room card | JPEG, 1280×853 | 1,148,828 | 960w: 74,842; 640w: 37,290 |
| Literary room card | JPEG, 1280×853 | 1,139,388 | 960w: 87,752; 640w: 44,538 |
| Off-street parking | PNG, 1420×918 | 2,854,398 | 1120w: 144,080; 720w: 76,594 |
| Owner portrait | JPEG, 356×365 | 52,756 | No change planned; already small. |

Original source files are retained outside the project under `/home/ubuntu/webdev-static-assets/oldnorthside-source/`. Derived WebP assets are retained outside the project under `/home/ubuntu/webdev-static-assets/oldnorthside-optimized/` and must be uploaded through the web asset uploader before application references are changed.

## Optimization direction

Keep the hero image as a high-priority responsive media element. Serve the story and room-card images through responsive `<picture>` sources with declared dimensions. Defer the off-street-parking image because it appears below the primary booking content. Preserve the original sources and do not alter guest-facing copy, booking behavior, or image composition.

## Post-release live verification

On 2026-08-05, the apex and `www` hostnames both resolved to the Manus custom-domain edge addresses `104.18.26.246` and `104.18.27.246`. An HTTPS header request to `https://oldnorthsidebedandbreakfast.com/` returned `HTTP/2 200`, and a browser review confirmed that the published homepage rendered the current public navigation, hero, responsive hero image, booking calendar, room imagery, and direct-booking calls to action.

This check confirms the custom domain is serving the published site after the performance release. It does **not** validate the separately blocked iCal feeds, production Stripe credentials, channel-manager connection, optional downloadable Visitor Guide, or conditional resend controls.
