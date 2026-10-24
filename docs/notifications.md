# In-app notifications — the bell, end to end

Before this, the bell in every dashboard header was a stub: a hard-coded empty list, no table, no events. Now every
role has a real, live notification centre.

## What a person sees

- **The bell** (every dashboard header, every role; its popover is portalled to `<body>` because the header clips overflow): an unread badge that updates by itself, a popover with the latest
  eight, *Mark all read*, dismiss on hover, "View all", and a link to settings. It rings briefly when something arrives.
- **Toasts**: when a notification arrives while the page is open, a card slides in at the top right (click to go there;
  it leaves by itself and stays in the bell). A flood collapses to one "6 new notifications" card. Silent on proctored
  exam pages and while the bell is open (it sits in the same corner); plan changes appear in the bell only (the plan watcher already toasts them).
- **/notifications**: the full list — filter by unread or kind, mark all read, clear read, load older.
- **Settings → Notifications**: one real switch per kind, saved as you flip it. *Plans & payments* and *Account &
  security* are always on (they are about your own access and money).

## Who is told what

| Event | Who | Raised from |
|---|---|---|
| A drive becomes live for a college (TPO creates it, opts in, or approves a proposal) | the college's **eligible** students (and those whose eligibility can't be judged yet) — not those who definitely can't apply | `DriveMappingObserver` → `DriveNotifier::live` |
| A drive is proposed to a college | the college's TPOs | `DriveMappingObserver` → `proposed` |
| The college approves / declines | the proposer (Mellow staff or the company) and the company's hiring team | `proposalAnswered` |
| A live drive is cancelled / closed for a college / its date moves | students of that college | `PlacementDriveObserver`, `DriveMappingObserver` |
| An application moves round / gets an offer / is rejected | that student | `DrivePipelineService::transition` |
| "Register all eligible" | the students registered | `DrivePipelineService::registerEligible` |
| Mock contest / AI interview / soft-skills / core test / interview track published by a TPO | that college's students | `PublishedAssessmentObserver` → `AssessmentNotifier` |
| A company's contest or interview published | students of the colleges it targets, where the drive is still live | same |
| A platform-wide rated contest published | every student | same (after the response) |
| Hackathon published | everyone it is open to (all students, or the chosen colleges) | `HackathonObserver` |
| Hackathon announcement / cancelled / results out | the students who registered | `HackathonObserver`, `HackathonAnnouncementObserver` |
| A superadmin gives / extends / ends a student's plan | that student | `SubscriptionService` → `PlanNotifier` |
| …a college's plan is assigned / extended / ended / expires / seat cap changes | the college's TPOs; students too when it ends or expires | same + the daily `subscriptions:expire` |
| …a company's plan | the company's hiring team | same |
| Payment received / failed / refunded | the student; superadmins hear "payment received" | `CheckoutService`, `LifecycleMailService` |
| Password changed (by you / reset by an administrator) | that account | `LifecycleMailService`, `SuperAdminController::resetPassword` |
| Vault: a company shows interest, invites to interview, messages, hires | the student; the company hears when the student answers an invite | `VaultInquiryObserver`, `VaultMessageObserver` |
| Student becomes Vault-ready | that student | `VaultService` |
| Bulk student/candidate import finishes | whoever uploaded it | `ImportObserver` |
| New lead / enquiry / customer assigned | the marketing or ops employee it is assigned to | `LeadAssignmentService` |
| A TPO or coordinator sends a bulk message | students get an in-app pointer; new **In-app** channel sends your own title + message straight to their bells | `StudentBulkNotificationService` |

Deliberately not announced: library content (general interviews, soft-skill sets, core papers), the daily practice
contest, a company's private candidate assessments, a free plan or add-on ending.

## How it works

- **Table** `user_notifications` (one row per recipient per event) + `users.notification_prefs` (only what a person
  muted). `(user_id, group_key)` is unique, so the same event can never tell the same person twice — a retried request,
  a re-run job or a webhook delivered twice is a no-op.
- **`NotificationService`** is the one way to raise one: fire-and-forget (never throws — a missing table or a bad
  argument is logged and swallowed, like `LifecycleMailService`), skips blocked accounts and muted categories (except
  plan/account), drops any link that isn't an in-app path, caps title/body, and fans out in chunked bulk `INSERT`s
  (500 recipients per query). Big audiences run after the response (`afterResponse`).
- **Where events come from**: model observers wherever the thing has a lifecycle (so every controller, job and console
  that causes it is covered, and a future one can't forget), plus the services that already own the moment (plans,
  payments, the drive pipeline). Add a type in `App\Enums\NotificationType`, call the service; the frontend needs no change.
- **Real time**: the client polls `GET /api/notifications/signal` — unread count + newest id, one aggregate query,
  ~100 bytes — every ~15 s while the tab is visible (with jitter, exponential back-off on errors), plus immediately when a
  hidden tab returns, the window regains focus or the network comes back. Only when that moves does it fetch the list.
  PHP-FPM can't hold a socket per student; this is what survives proxies, sleep and flaky mobile data. One store, one
  timer, however many components read it.
- **Safety**: every query is scoped to the signed-in user and another person's id is a 404; a "view as" session can read
  but not mark/dismiss (the app-wide read-only guard); responses are `Cache-Control: private, no-store`; titles/bodies
  render as text; a different account signing in on the same tab starts from an empty store.
- **Housekeeping**: `notifications:prune` (daily 03:40) removes read notifications after 60 days, unread after 180.

## API (all under the signed-in group)

`GET /notifications?limit&before&category&unread` · `GET /notifications/signal` · `POST /notifications/{id}/read` ·
`POST /notifications/read-all` · `DELETE /notifications/{id}` · `DELETE /notifications/read` ·
`GET|PUT /notifications/preferences`. Limiters `notification-signal` and `notifications` (90/min/user).

## Deploying

1. `php artisan migrate` (adds `user_notifications` and `users.notification_prefs`; additive).
2. `php artisan route:cache` (new routes + limiters).
3. Make sure the scheduler runs (`schedule:run` every minute) — it prunes old notifications and expires plans.
4. Rebuild/redeploy the frontend.

## Verified how

Backend: `NotificationsApiTest` (18) and `NotificationEventsTest` (23) — who is and is not told for each event, idempotency,
muting, blocked accounts, link safety, scoping, pruning — and the full suite stays green. Frontend: `notifications.test.tsx`
(23) covers the polling store, back-off, hidden tabs, optimistic read/dismiss with rollback, the bell, toasts, the
exam-page silence and the preferences. Not covered: delivery to a phone (push) or e-mail digests — in-app only for now.
