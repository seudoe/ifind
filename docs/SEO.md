# SEO, trust and conversion notes

## What is implemented

- Per-page `<title>`, description, canonical and Open Graph/Twitter metadata for `/user`, `/employer`, `/faq`;
  a generated 1200×630 share image (`app/opengraph-image.tsx`). `metadataBase` comes from `NEXT_PUBLIC_APP_URL`
  (**must be set to the production origin**, otherwise canonicals and the sitemap point at localhost).
- `robots.txt` and `sitemap.xml` list only public marketing pages. Private/auth pages and APIs also send
  `X-Robots-Tag: noindex` (robots.txt is not a security control).
- Branded 404 (`app/not-found.tsx`), FAQ page with `FAQPage` + `BreadcrumbList` JSON-LD generated from the same data as the
  visible text, `Organization`/`WebSite` JSON-LD on the student landing page, sticky mobile CTA on both landing pages.
- Images: every `<img>` already has a descriptive `alt` (avatars/logos with a name) or `alt=""` where a label sits next to
  it (company logos in listings, event banner).

## Deliberately NOT added (no verified source material)

| Item | Why / decision needed |
|---|---|
| Response-time promise on the FAQ | No commitment exists in the repo. Decide whether support has an SLA, then add it. |
| `LocalBusiness` structured data, map and directions links | iFind is an online service with no verified physical address, hours or coordinates in the repository. Add only after a real business address is supplied. |
| Reviews, ratings (`Review`/`AggregateRating`), case studies | None are on file. The previous "Students Love iFind" section used named people (IIT/IIM students "placed" at Google/McKinsey/Swiggy) with no source; it was **removed**. Re-add only with permissioned, verifiable quotes. |
| Legal pages (Privacy, Terms, Cookies) | The footer linked to placeholder `#` URLs. Real policy text must come from the business/legal owner; the links were removed rather than faking pages. |
| Social profile links | The footer icons pointed at `#`. Add real profile URLs and `sameAs` when they exist. |

## Existing marketing claims that still need verification

These were on the page before this work and are not backed by anything in the repository. Confirm each is true, replace it
with a real figure, or remove it:

- Hero badge "50,000+ active internships right now", stats bar (50,000+ internships, 2M+ students, 10,000+ partner
  companies, **95% placement rate**), "Join 2M+ students", employer page "2M+ student database", "Browse 50,000+ internships".
- "Featured Internships" and the "Internships from top companies" strip are static sample content (Razorpay, Swiggy, CRED…),
  not live listings or confirmed partners.
- Category counts on the landing page.
