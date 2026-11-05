# Colleges / Students pages, new Rewards + Mellow Vault pages, and the e-mail shell (2026-11-05)

Follows `docs/landing-page.md` (the landing rebuild and `GET /api/public/landing`). Same rules: every number or date on these pages is the backend's; a block it cannot fill is left out;
no customer logos, quotes or invented figures.

## 1. Pages

| Route | What it is | Sections |
| --- | --- | --- |
| `/colleges` | The buyer's page (rebuilt; was 8,260 px, now ≈ 7,500 px and no repeated blocks) | intro with the campus console · proof band (companies + real counts) · before/after · 6 capability cards (each → its `/features/*` page) · 3 "built for the TPO" cards · 4-step season · every department (from the backend) · trust strip · FAQ (6) · demo CTA · cross-links |
| `/students` | The student's page (rebuilt) | intro with tonight's contest + this week's voucher + readiness ring (all live) · learning centre with real counts · "a day on AptRun" (contest hour from the backend) · 6 tools · rewards + Vault teasers (quote the live prize and the server's bar) · live student plans · FAQ (5) · CTA |
| `/rewards` (new) | The weekly voucher programme in full | intro with the live prize board + tonight's countdown · 3 steps · this week's lineup (+ next week's once chosen) · the shelf · **the rules** (what counts, the week, ties, prize order, getting your voucher, fair play) · FAQ (4) · CTA |
| `/vault` (new) | Mellow Vault, deliberately short | intro with the readiness simulator at the server's bar · 3 steps · "you stay in control" · CTA (4 sections) |

* Nav (`data/navigation.ts`): Colleges · Students · **Rewards → `/rewards`** · **Mellow Vault → `/vault`** · Pricing. The landing page's own rewards/Vault cards (`#rewards`, `#vault`) stay as teasers and link on ("How the rewards work…", "How Mellow Vault works"). Footer "Company" column adds Rewards and points Mellow Vault at `/vault`.
* Both new routes are in `OWN_CHROME_ROUTES` (`lib/backNav.ts`), which the back-nav coverage test requires.
* The rules on `/rewards` are the rules the leaderboard really runs on (`ContestLeaderboardService`, `WeeklyRewardService`): contest points only from platform-wide contests; Monday 00:00 – Sunday 23:59 IST; ties by lower total penalty, then shared rank and the prize of that position; vouchers go in order of value (rank 1 gets the biggest); winners are told in the app, the AptRun team sends the voucher and the code appears on the Contests page. Change the code and this copy together.
* Backend: `rewards.next` was added to `/public/landing` (next week's lineup, `null` until the superadmin picks it) for the Rewards page.
* Shared building blocks (`components/landing/`): `PageIntro`, `SectionIntro`, `FeatureCards`, `StepsRow`, `FaqAccordion`, `CtaBand` + `CrossLinks`, `StageCards` (campus console, tonight's contest, week's vouchers, Vault chip, readiness ring — extracted from the landing hero), `Reveal`. `MarketingShell` has a `scrollMotion` prop; pages built on `Reveal` pass `false` so the old generic gsap scroll-in never animates the same element.
* The old per-page problem-count fetch (`usePublicStats`/`usePublicSampleProblems` on Students, "DSA topics", "Sample data — illustrative" dashboard on Colleges) is gone.

## 2. E-mail shell (all 23 transactional templates)

Reference: Mellow Vault's own e-mails (a light panel under the card: company name, why you are receiving this, four links, "Need help?").

* **`emails/partials/header.blade.php`** — 560 px card, soft shadow, 5 px brand gradient, logo, an optional **category chip** top-right (`Account`, `Security`, `Payment`, `Placements`, `Mellow Vault`, `Enquiry`…), real `<title>`/meta for Apple/Outlook, `color-scheme: light dark`, and a **dark-mode** block (`prefers-color-scheme: dark`, `em-*` classes). Every colour that matters is also inline, so a client that strips `<style>` still shows the full light design.
* **`emails/partials/footer.blade.php`** — the per-mail note on the card, then a light centred panel: **AptRun** · "AptRun is a product of **Mellow Vault**" · *why you got it* (default "You are receiving this transactional email regarding your registered AptRun account." — overridable with `$reason`; a contact request, newsletter signup, hiring-team invite etc. say their own) · **Sign in • Help & contact • Privacy Policy • Terms of Service** · "Need help? Contact us anytime at support@mellowvault.com." · phone · location · small print (About · Pricing · Contact · Privacy · Terms, socials, © AptRun (All Rights Reserved), legal entity + CIN). `config/brand.php` has the new `email_links`; `footer_links`/`socials`/legal line are unchanged (PDFs and the landing footer read them).
* **Bodies** were restyled mechanically by a one-off script (the templates shared their inline styles verbatim): 24 px / 800 headings, 15 px / 1.7 body, 12 px-radius info boxes with small uppercase labels, gradient 15 px buttons, pills. Dark-mode classes (`em-h`, `em-p`, `em-muted`, `em-box*`, `em-rule`) were added to every hard-coded text/border/background colour.
* Fixed on the way: the contact-request confirmation told people to write to `campus@mellow.ai`; it now uses `config('brand.support_email')`.
* Preview without sending: `php artisan mail:preview --out=<dir>` renders the 13 lifecycle mails (sample data). Light and dark were checked in a real browser (welcome, OTP, credentials, plan-expiring, refund, Vault).
* Tests: `EmailBrandingTest` (+2: the panel reads like Mellow Vault's — reason, four links, need-help line, category chip, dark-mode declared, inline light colours; a mail to someone with no account says why) and the existing 94 mail tests.

## Verified
`marketing-pages.test.tsx` (25) · `landing-page.test.tsx` (33, now on the shared `landingFixture.ts`) · back-nav coverage · e2e `marketing-pages.spec.ts` (11, chromium) + `landing.spec.ts` · backend `PublicLandingTest` (11) and 220 email-rendering tests · real-browser screenshots at 1440 / 390 / 320 px, light and dark, no horizontal scroll, no console errors.

## Deploy
Backend: `php artisan route:cache && php artisan config:cache` (new `brand.email_links`, `rewards.next`); no migration. Frontend: build and deploy. Nothing on the workspace hosts.
Mails: nothing to do; the next mail sent uses the new shell. `FRONTEND_URL` must be the public site URL (the logo is hosted from `/brand/aptrun-logo-email.png`).

## Not done / decisions to revisit
* "Placement sandbox" is still the brand line in the browser title, share tags, the footer lockup and the PDF/e-mail taglines in `config/brand.php`; the new copy says "platform".
* E-mail clients differ: Outlook desktop ignores rounded corners/shadows (it shows the same layout, square) and Gmail's dark mode may re-colour on its own. Not tested in real inboxes — use `mail:preview --to=<you>` for the lifecycle mails.
* `/features/vault` (the older feature page) still exists next to `/vault`.

## Update: e-mail links, logo and social icons (2026-11-07)
* **Why the logo was broken:** e-mail links and the logo were built from `FRONTEND_URL` (`http://127.0.0.1:3000` in dev), which does not exist on a reader's machine. All e-mail links and images now come from **`config('brand.site_url')`** (`BRAND_SITE_URL`, default `https://aptrun.com`): Sign in → `https://aptrun.com/login`, Help & contact → `/contact`, Privacy Policy → `/privacy`, Terms of Service → `/terms`, About/Pricing/Contact, every body button (Go to Dashboard, Renew…) and the lifecycle mails' links (`LifecycleCopy`). `FRONTEND_URL` is untouched (CORS, PayU return).
* **Social links:** the same four real URLs as the website footer (`config/brand.php` → `socials`), now as round icon buttons (`frontend/public/brand/email/{linkedin,instagram,youtube,facebook}.png`, generated from the site footer's lucide marks on each platform's colour), with the platform name as alt text.
* **Deploy:** the logo and the four icons are files in the frontend build, so **deploy the frontend first** or they will 404 on aptrun.com. The signed unsubscribe link still points at the API host (`APP_URL`).
* Tests: `EmailBrandingTest` (+2): no `localhost`/`127.0.0.1` in any mail, every link under the site URL, icons present for every social, files exist.
