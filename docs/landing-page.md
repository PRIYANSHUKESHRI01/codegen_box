# Landing page rebuild + Vault AI card order (2026-11-05)

## 1. Vault AI Interview is the 2nd card on the student Overview

The Overview is a stack of cards. It was: Up next → stat tiles → weekly vouchers → **Vault AI Interview (4th)**. It is now:

1. Up next (the contest / drive that is soonest)
2. **Vault AI Interview**
3. Stat tiles
4. Weekly leaderboard vouchers
5. … Practice, Coming up, Readiness, Hack Arena, Explore (unchanged)

`components/dashboard/home/SoftwareHome.tsx`. `tests/unit/student-overview-order.test.tsx` pins the order. (The *sidebar* order was changed earlier — Vault AI is 2nd in Placements.)
When there is no "Up next" card (no contest or drive to show) the Vault AI card is simply the first.

## 2. Landing page

**Before:** 12 stacked sections (hero + product preview, marquee, roles, Vault band, how-it-works, features bento, rewards band, outcomes, trust,
pricing, FAQ, CTA), all hard-coded — the only "live" thing was nothing.
**Now:** 8 blocks, every number and date from the backend.

| # | Block | Source |
| --- | --- | --- |
| – | Announcement bar | tonight's contest + this week's top voucher (live) |
| 1 | Hero: headline, 2 CTAs, **live stage** (placement-cell console sketch · tonight's contest countdown · this week's vouchers · Vault chip) | `/public/landing` |
| 2 | Proof band: companies with prep packs (logo marquee) + 4 depth numbers (+ usage numbers when allowed) | `/public/landing` |
| 3 | The platform: **tabs** "For placement cells / For students" (merges roles + how-it-works + features + outcomes). College side = the departments the platform serves; student side = learning-centre tiles with real counts | `/public/landing` |
| 4 | Something to play for: weekly rewards card (live prizes, reset countdown, shelf) + Mellow Vault card (readiness slider at the server's bar) | `/public/landing` |
| 5 | Fair by design: 4 trust cards | static copy |
| 6 | Pricing: the live student plans (price, discount, what each unlocks) + college "scoped with our team" | `/public/plans` (same as /pricing) |
| 7 | FAQ: 6 questions, answers quote the live Vault bar / contest hour | `/public/landing` |
| 8 | Final CTA | static |

Navigation anchors: `#platform`, `#colleges` / `#students` (the tabs; a `/#students` link opens the student side), `#rewards`, `#vault`, `#trust`, `#pricing-glance`, `#faq`.
Removed: `#how-it-works`, `#features`, `#audiences`, `#outcomes`.

### The endpoint — `GET /api/public/landing`

Unauthenticated, aggregates and catalogue facts only (never a student's name/email/college/score — a test asserts this). Throttle `public-landing` (300/min/IP).
`Cache-Control: public, max-age=30, s-maxage=60`; server-side two caches (live blocks 60 s, catalogue counts 10 min — `config/landing.php`).

```
policy   { vault_bar, daily{name,start_label,duration_minutes,problems,points}, week{resets_on} }   ← the settings that enforce the rules
stats    { depth{problems,languages,test_cases,interview_*,assessment_questions,company_*,departments,branches},
           adoption{students,colleges,contests_held,solutions_judged,vouchers_sent} }              ← adoption is null below the floor
contest  { title, start_at, ends_at, is_live, registration, registered|null }                     ← the real edition, else the slot it will take
rewards  { live, week{starts_at,resets_at}, prizes[{rank,brand,amount,logo,color,tagline}], participants|null, shelf[] }
companies[], departments[]
```

* **Honest numbers.** *Depth* (problems, questions, packs…) is always shown. *Adoption* (students, colleges, contests held, solutions judged, vouchers sent,
  "N registered tonight", "N on this week's board") comes back `null` until it passes a floor in `config/landing.php` (env `LANDING_MIN_STUDENTS` = 1000,
  `_COLLEGES` = 10, `_CONTESTS` = 50, `_SOLUTIONS` = 25000, `_VOUCHERS` = 10, `_REGISTERED` = 25, `_BOARD` = 25), and the page then prints nothing rather than "6 colleges".
  Set a floor to 0 to always show that figure. A bank with zero items is left out, never printed as "0".
* **Companies** are the active companies that have at least one prep question (the "prep packs") — a fact about our content, not a claim that they are customers.
* **A block that cannot be built** (missing table on an old DB, catalogue error) comes back `null`; the page omits it. If the whole request fails, the page still reads on
  its defaults (Vault bar 60, "8 PM IST"), the announcement bar and proof band are not drawn, and the rewards card says the lineup is announced on Monday.
* **The fallbacks in `data/landing.ts`** (60%, 8 PM IST) are only for "before the answer / no answer"; a unit test keeps them equal to `config/vault.php` and `config/contests.php`.
* **Search data (JSON-LD):** the FAQ structured data is built from the same `buildFaqs(facts)` as the page — complete on the defaults in the static HTML, rewritten with the live facts once the backend answers.

### Design notes
Stripe/Linear-style: one hero visual instead of a tabbed preview, spotlight cards (`SpotlightCard`), tinted hover shadows, count-up numbers (`AnimatedCounter group`),
one scroll-in motion (`landing/Reveal`, none for `prefers-reduced-motion`), a sliding tab pill, ticking countdowns (`LiveCountdown`, hydration-safe), aurora background.
Both themes and 320 / 390 / 820 / 1280 / 1440 widths were checked in a real browser.

### Files
Backend: `config/landing.php`, `app/Services/Landing/LandingDataService.php`, `app/Http/Controllers/Api/PublicLandingController.php`, route + `public-landing` limiter, `tests/Feature/PublicLandingTest.php`.
Frontend: `components/landing/*`, `components/hero/{Hero,HeroContent,HeroStage,HeroBackground}.tsx`, `components/layout/AnnouncementBar.tsx`, `lib/useLandingData.ts`,
`types/landing.ts`, `data/landing.ts`, `app/page.tsx`; deleted `components/sections/*` and `hero/ProductPreview.tsx`.
Tests: `tests/unit/landing-page.test.tsx` (33), `student-overview-order.test.tsx`, `tests/e2e/landing.spec.ts` (answers the API itself with non-default values, plus an "API down" case).

## Deploy
1. Backend: `php artisan route:cache && php artisan config:cache` (new route, new `config/landing.php`). **No migration, no SQL.**
2. Frontend: build and deploy as usual. Nothing to restart on the workspace hosts.
3. Optional `.env`: the `LANDING_MIN_*` floors above.

## Not done / decisions to revisit
* The browser title, OG tags and the footer lockup still say "Placement Sandbox"; the page body now says "platform". Align them when the brand line is decided.
* The "campus console" in the hero is a sketch with no figures (labelled "Preview"); there is no product screenshot yet.
* No customer logos, quotes or testimonials, because none exist with permission. When there are, they go in a new block fed from the backend.
