<?php

namespace App\Providers;

use App\Models\Subscription;
use App\Models\User;
use App\Events\CoreQuestionKeyFixed;
use App\Models\CandidateImport;
use App\Models\Contest;
use App\Models\CoreTest;
use App\Models\DriveCollegeMapping;
use App\Models\Hackathon;
use App\Models\HackathonAnnouncement;
use App\Models\Interview;
use App\Models\InterviewTrack;
use App\Models\PlacementDrive;
use App\Models\SoftSkillAssessment;
use App\Models\VaultInquiry;
use App\Models\VaultMessage;
use App\Models\StudentImport;
use App\Observers\DriveMappingObserver;
use App\Observers\HackathonAnnouncementObserver;
use App\Observers\HackathonObserver;
use App\Observers\ImportObserver;
use App\Observers\PlacementDriveObserver;
use App\Observers\PublishedAssessmentObserver;
use App\Observers\VaultInquiryObserver;
use App\Observers\VaultMessageObserver;
use App\Services\Core\RegradeCoreQuestion;
use App\Support\BranchCatalog;
use Illuminate\Support\Facades\Event;
use App\Services\LeadAssignmentService;
use App\Services\SubscriptionService;
use App\Services\Vault\VaultService;
use App\Services\Workspaces\DockerCliRuntime;
use App\Services\Workspaces\FakeWorkspaceRuntime;
use App\Services\Workspaces\ProcessRunner;
use App\Services\Workspaces\SymfonyProcessRunner;
use App\Services\Workspaces\WorkspaceRuntime;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Throwable;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Project Lab workspaces: the docker-CLI runtime in production, an in-memory
        // fake when WORKSPACE_RUNTIME=fake (UI development without Docker). Tests
        // swap in their own with $this->app->instance(WorkspaceRuntime::class, …).
        $this->app->bind(ProcessRunner::class, SymfonyProcessRunner::class);

        // The branch catalogue is loaded once per request/job and answered from memory (it is
        // consulted per student per drive in cohort paths) — see App\Support\BranchCatalog.
        $this->app->scoped(BranchCatalog::class);

        // One catalog per request, so the explorer, the qualification service and the admin screen all see the same tree.
        $this->app->singleton(\App\Services\Vault\CuratedCatalog::class);
        // Same reason: one Mock AI Interview catalog per request, so a write that flushes it flushes the one every reader holds.
        $this->app->singleton(\App\Services\Mock\MockInterviewCatalog::class);

        $this->app->singleton(WorkspaceRuntime::class, function ($app) {
            return config('workspaces.runtime') === 'fake'
                ? new FakeWorkspaceRuntime
                : new DockerCliRuntime($app->make(ProcessRunner::class), (string) config('workspaces.docker_binary', 'docker'));
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // A fixed answer key rescoring everything graded against the old one (practice verdicts and finished test attempts).
        Event::listen(CoreQuestionKeyFixed::class, RegradeCoreQuestion::class);

        // In-app notifications (the bell): raised where the thing happens — a model's own lifecycle — so every controller,
        // job and console that makes it happen is covered, and a new one added later cannot forget. See App\Enums\NotificationType.
        DriveCollegeMapping::observe(DriveMappingObserver::class);
        PlacementDrive::observe(PlacementDriveObserver::class);
        Hackathon::observe(HackathonObserver::class);
        HackathonAnnouncement::observe(HackathonAnnouncementObserver::class);
        StudentImport::observe(ImportObserver::class);
        VaultInquiry::observe(VaultInquiryObserver::class);
        VaultMessage::observe(VaultMessageObserver::class);
        CandidateImport::observe(ImportObserver::class);
        foreach ([Contest::class, Interview::class, SoftSkillAssessment::class, CoreTest::class, InterviewTrack::class] as $assessment) {
            $assessment::observe(PublishedAssessmentObserver::class);
        }

        // Throttles queued jobs tagged with the RateLimited('transactional-emails')
        // middleware (see SendAccountCredentialsEmail) — protects the mail
        // provider's own rate limits when a bulk import fans out hundreds or
        // thousands of individual send jobs at once. 60/minute is a
        // conservative default for a shared-plan SMTP/API provider; raise it
        // once real provider limits are known.
        RateLimiter::for('transactional-emails', function () {
            return Limit::perMinute(60);
        });

        // Forgot-password OTP endpoints — zero route-level throttling
        // existed anywhere in this app before this. Dual-keyed (email + IP)
        // rather than a single flat limit: an IP-only cap doesn't stop one
        // attacker email-bombing many different victim addresses, and an
        // email-only cap doesn't stop many IPs hammering one victim. This is
        // independent of and complements PasswordResetOtp's own per-row
        // `attempts` cap — this limiter stops volume/spam, `attempts` stops
        // sustained guessing against one still-valid code.
        RateLimiter::for('password-reset-request', function (Request $request) {
            return [
                Limit::perMinute(3)->by('otp-request-email:'.Str::lower((string) $request->input('email'))),
                Limit::perMinute(10)->by('otp-request-ip:'.$request->ip()),
            ];
        });

        RateLimiter::for('password-reset-verify', function (Request $request) {
            return [
                Limit::perMinute(10)->by('otp-verify-email:'.Str::lower((string) $request->input('email'))),
                Limit::perMinute(20)->by('otp-verify-ip:'.$request->ip()),
            ];
        });

        // /login itself — same dual-key reasoning as the OTP limiters above,
        // and had zero throttling at all before this despite guarding every
        // account on the platform, superadmin included. 5/minute per email is
        // generous enough for a real user fat-fingering their password a
        // couple of times; 20/minute per IP stops a script from brute-forcing
        // its way through many accounts from one source.
        RateLimiter::for('login', function (Request $request) {
            return [
                Limit::perMinute(5)->by('login-email:'.Str::lower((string) $request->input('email'))),
                Limit::perMinute(20)->by('login-ip:'.$request->ip()),
            ];
        });

        // The public "Talk to Our Team" form — same dual-key reasoning as
        // password-reset-request above (email-only misses many IPs hitting
        // one victim's inbox; IP-only misses one bot rotating through many
        // fake emails). Generous enough for a real visitor to retry a typo'd
        // field a few times, tight enough to stop a scripted flood from
        // reaching the marketing-notification inbox.
        RateLimiter::for('contact-request', function (Request $request) {
            return [
                Limit::perHour(5)->by('contact-request-email:'.Str::lower((string) $request->input('email'))),
                Limit::perHour(10)->by('contact-request-ip:'.$request->ip()),
            ];
        });

        // Newsletter signup — lower risk than a sales inquiry (no staff
        // inbox to flood), but still worth a light cap against a scripted
        // loop hammering the endpoint.
        RateLimiter::for('newsletter-subscribe', function (Request $request) {
            return [
                Limit::perHour(5)->by('newsletter-email:'.Str::lower((string) $request->input('email'))),
                Limit::perHour(20)->by('newsletter-ip:'.$request->ip()),
            ];
        });

        // Run/Submit/poll limits are per USER, never per IP: a campus lab puts
        // hundreds of students behind one NAT address, so an IP limit would
        // throttle a whole class as if it were one person. The limits stop a
        // runaway script or a held-down Ctrl+Enter; a real student is nowhere
        // near them. Unauthenticated callers can't reach these routes.
        RateLimiter::for('judge-run', function (Request $request) {
            return Limit::perMinute((int) config('judge.rate_limits.run_per_minute', 20))->by('judge-run:'.$request->user()?->id);
        });

        RateLimiter::for('judge-submit', function (Request $request) {
            return Limit::perMinute((int) config('judge.rate_limits.submit_per_minute', 10))->by('judge-submit:'.$request->user()?->id);
        });

        RateLimiter::for('judge-poll', function (Request $request) {
            return Limit::perMinute((int) config('judge.rate_limits.poll_per_minute', 180))->by('judge-poll:'.$request->user()?->id);
        });

        // Proctoring violation reports — per USER, same reasoning as the
        // judge limiters above. Generous (a real violation stream is at
        // most a few per minute even with a flaky connection triggering
        // repeated visibilitychange events) but stops a broken/malicious
        // client from hammering the endpoint.
        RateLimiter::for('proctoring-event', function (Request $request) {
            return Limit::perMinute(30)->by('proctoring-event:'.$request->user()?->id);
        });

        // Exam integrity (see App\Services\Integrity). Per USER, never per address: a campus lab puts a whole class behind
        // one. A telemetry batch goes out every ~10 s plus an immediate one per serious event, so 120/min is a wide margin
        // that still stops a broken or hostile client from flooding the hash-chained log.
        RateLimiter::for('integrity-beat', function (Request $request) {
            return Limit::perMinute(120)->by('integrity-beat:'.($request->user()?->id ?? $request->ip()));
        });
        RateLimiter::for('integrity-evidence', function (Request $request) {
            return Limit::perMinute(40)->by('integrity-evidence:'.($request->user()?->id ?? $request->ip()));
        });
        // The Guardian beats every ~2 s. Keyed by its token (it has no login). Pairing is keyed per address but loose:
        // a whole lab pairs at the start of a session, and a 32^8 code space cannot be walked at this rate anyway.
        RateLimiter::for('guardian-beat', function (Request $request) {
            return Limit::perMinute(150)->by('guardian-beat:'.hash('sha256', (string) $request->bearerToken()));
        });
        // The installer is a 6 MB file served to anyone: per address, and generous, because a whole college lab sits behind ONE public
        // address and an exam-eve "everyone install it now" must not turn half the class away with a "too many requests".
        RateLimiter::for('guardian-download', function (Request $request) {
            return Limit::perMinute(240)->by('guardian-download:'.$request->ip());
        });
        RateLimiter::for('guardian-pair', function (Request $request) {
            return Limit::perMinute(240)->by('guardian-pair:'.($request->user()?->id ?? $request->ip()));
        });

        // AI interview question generation (Gemini) — per USER, same
        // reasoning as the judge limiters above. Generous enough for a
        // couple of "regenerate this one" retries per minute, caps
        // runaway API cost from a broken/looping client.
        RateLimiter::for('ai-generation', function (Request $request) {
            return Limit::perMinute(5)->by('ai-generation:'.$request->user()?->id);
        });

        // Skill Drills answers (DrillController) — per USER. One request per answered batch (the browser sends a handful at a time),
        // so this is generous for a fast drill and still stops a looping client.
        RateLimiter::for('drill-attempts', function (Request $request) {
            return Limit::perMinute(60)->by('drill-attempts:'.$request->user()?->id);
        });

        // Phone OTP verification (PhoneVerificationController) — per USER,
        // same reasoning as the judge limiters above. The actual OTP
        // send/guess loop is entirely Firebase's problem (rate-limited by
        // Google itself, never touches this endpoint); this only caps how
        // often one account can hammer OUR id-token-verification call.
        RateLimiter::for('phone-verify', function (Request $request) {
            return Limit::perMinute(10)->by('phone-verify:'.$request->user()?->id);
        });

        // The public pricing page's live price list (GET /public/plans). Per IP — there is no user —
        // but generous: the page polls every ~20 s, and a campus lab puts a whole class behind one
        // address. Anything past this is a script, not a student.
        RateLimiter::for('public-plans', function (Request $request) {
            return Limit::perMinute(300)->by('public-plans:'.$request->ip());
        });

        // Superadmin actions that re-ask for the caller's own password (reset-and-reveal
        // an account's password, permanently delete a university). Per USER: a wrong
        // password is a guess at the superadmin's password, and a stolen session token
        // must not be able to try thousands of them. A real superadmin does these a
        // handful of times a day.
        RateLimiter::for('superadmin-sensitive', function (Request $request) {
            return Limit::perMinute(10)->by('superadmin-sensitive:'.$request->user()?->id);
        });

        // Looking up issued logins happens in bursts while a superadmin works down a list, but only AFTER the password-confirmed
        // unlock — so it can be looser than the limiter above, yet still far too slow to harvest a whole directory.
        RateLimiter::for('superadmin-credentials', function (Request $request) {
            return Limit::perMinute(40)->by('superadmin-credentials:'.$request->user()?->id);
        });

        // A Section Coordinator's bulk notification fans an e-mail / WhatsApp out to a whole section. Per user, per hour: a
        // coordinator checking in on their students does this a few times a week, and a hijacked coordinator session
        // must not be able to mass-message a college.
        RateLimiter::for('coordinator-notify', function (Request $request) {
            return Limit::perHour(12)->by('coordinator-notify:'.($request->user()?->id ?? $request->ip()));
        });

        // Routine plan support work (give a student a plan, add days). Per user and far looser than the
        // password-confirming actions above: nothing here guesses a password, and a superadmin working
        // through a list of scholarship students must not be throttled halfway down it.
        RateLimiter::for('superadmin-subscriptions', function (Request $request) {
            return Limit::perMinute(60)->by('superadmin-subscriptions:'.$request->user()?->id);
        });

        // The plan-change poll every open dashboard makes (every ~30 s, plus on focus). Per user, never per
        // IP: a campus lab puts a whole class behind one address. Generous so several tabs and the odd
        // refresh never trip it; a script hammering it still does.
        // The bell polls this every ~15 s per open tab (4/min); 90 leaves room for several tabs, focus-refreshes and a
        // burst after a laptop wakes. Listing/marking is human-paced.
        RateLimiter::for('notification-signal', function (Request $request) {
            return Limit::perMinute(90)->by('notification-signal:'.($request->user()?->id ?? $request->ip()));
        });
        RateLimiter::for('notifications', function (Request $request) {
            return Limit::perMinute(90)->by('notifications:'.($request->user()?->id ?? $request->ip()));
        });

        RateLimiter::for('plan-signal', function (Request $request) {
            return Limit::perMinute(90)->by('plan-signal:'.($request->user()?->id ?? $request->ip()));
        });

        // Project Lab. One NAMED limiter per route family, keyed per user — never
        // `throttle:N,1`: Laravel keys an unnamed numeric throttle by the user alone,
        // so differently-limited routes would all share a single counter and, say,
        // polling the workspace while it boots would spend the Start button's
        // allowance of 10 a minute (found by the real-Docker end-to-end run).
        foreach ([
            'lab-topic-start' => 20,
            'lab-sow' => 20,
            'lab-milestone' => 60,
            'lab-workspace-start' => 10,
            'lab-workspace-poll' => 120,
            'lab-workspace-heartbeat' => 30,
            'lab-integrity' => 30,
            'lab-workspace-stop' => 20,
            'lab-submit' => 5,
            'lab-purchase' => 20,
            // Paying for a plan. Per user, never per IP (a campus lab shares one address). Opening a checkout
            // creates a real gateway order, so it is the tightest; the verify callback and the status poll
            // are what a student's browser legitimately repeats while waiting on a bank.
            'checkout-create' => 10,
            'checkout-redeem' => 10,
            'checkout-verify' => 20,
            'checkout-status' => 40,
        ] as $name => $perMinute) {
            RateLimiter::for($name, fn (Request $request) => Limit::perMinute($perMinute)->by($name.':'.($request->user()?->id ?? $request->ip())));
        }

        // The payment gateways' webhook senders (Razorpay, PayU). Per IP (it is a handful of gateway addresses,
        // not people), generous on purpose: throttling it would not stop a flood, it would turn a burst of real
        // payment events into 429s and a retry storm. The signature/hash check, not this limit, is what keeps
        // strangers out.
        RateLimiter::for('payment-webhook', fn (Request $request) => Limit::perMinute(600)->by('payment-webhook:'.$request->ip()));

        // PayU sending a student's BROWSER back to us after they paid. Per IP, but loose: a campus lab puts a
        // whole class behind one address and they all finish a payment around the same time. A 429 here would
        // strand a student who has just paid on an error page (their payment would still be found by the webhook,
        // but they would not know that), so this only exists to blunt a script, not to meter people.
        RateLimiter::for('payment-return', fn (Request $request) => Limit::perMinute(300)->by('payment-return:'.$request->ip()));

        // Hack Arena. Named, per user (never per IP: a campus lab shares one address), and one
        // per route family so they do not spend each other's allowance. Registering and team
        // changes are rare, deliberate actions; saving a project is the busiest, and a person
        // writing up their work and pressing Save now and then is nowhere near its ceiling.
        foreach ([
            'arena-action' => 30,
            'arena-submit' => 30,
            'arena-host' => 120,
        ] as $name => $perMinute) {
            RateLimiter::for($name, fn (Request $request) => Limit::perMinute($perMinute)->by($name.':'.($request->user()?->id ?? $request->ip())));
        }

        // Mellow Vault calling AptRun (the pull API and the "hired" callback). Per IP: it is one system, not people,
        // and generous enough for a full reconcile of a large Vault in pages of 200. The bearer key, not this
        // limit, is what keeps strangers out.
        RateLimiter::for('vault-integration', fn (Request $request) => Limit::perMinute(300)->by('vault-integration:'.$request->ip()));

        // Every student account — however it's created (self-registration,
        // admin storeUser, bulk CSV import, seeders) — starts on the free
        // Coder plan, so "does this user have a subscription" is always
        // true and every UI surface can rely on it without a null check.
        User::created(function (User $user) {
            if ($user->role === User::ROLE_USER) {
                app(SubscriptionService::class)->ensureDefaultIndividualPlan($user);
            }

            // A "Mellow Direct" lead (role=user, no college) gets a
            // marketing owner the instant it exists — covers self-registration
            // and superadmin's college-less "Student/Candidate Coder" option
            // with the same one hook. See LeadAssignmentService for the
            // least-loaded formula.
            if ($user->isMellowDirectLead()) {
                app(LeadAssignmentService::class)->assignLead($user);
            }
        });

        // A plan starting, ending or changing decides whether a student may be listed in the Vault (it is a
        // Expert feature), so the same reconcile runs. A college's own plan reaches its students through the
        // nightly `readiness:refresh --all`. Fails soft: a Vault problem must never fail a purchase or a cancellation.
        Subscription::saved(function (Subscription $subscription) {
            if ($subscription->subscriber_type !== User::class
                || ! ($subscription->wasRecentlyCreated || $subscription->wasChanged(['status', 'plan_id', 'current_period_end']))) {
                return;
            }

            try {
                $user = User::find($subscription->subscriber_id);

                if ($user?->isStudent()) {
                    app(VaultService::class)->accountStateChanged($user);
                }
            } catch (Throwable $e) {
                report($e);
            }
        });

        // Blocking a student must take them off the Vault list at once (and unblocking restores them). The block
        // is toggled from several admin screens, so one model hook beats remembering to call it from each.
        // Fails soft: a Vault hiccup must never stop an administrator blocking an account.
        User::updated(function (User $user) {
            if ($user->role === User::ROLE_USER && $user->wasChanged('is_blocked')) {
                try {
                    app(VaultService::class)->accountStateChanged($user);
                } catch (Throwable $e) {
                    report($e);
                }
            }
        });
    }
}
