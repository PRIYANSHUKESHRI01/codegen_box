<?php

namespace App\Providers;

use App\Models\User;
use App\Services\LeadAssignmentService;
use App\Services\SubscriptionService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
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

        // AI interview question generation (Gemini) — per USER, same
        // reasoning as the judge limiters above. Generous enough for a
        // couple of "regenerate this one" retries per minute, caps
        // runaway API cost from a broken/looping client.
        RateLimiter::for('ai-generation', function (Request $request) {
            return Limit::perMinute(5)->by('ai-generation:'.$request->user()?->id);
        });

        // Phone OTP verification (PhoneVerificationController) — per USER,
        // same reasoning as the judge limiters above. The actual OTP
        // send/guess loop is entirely Firebase's problem (rate-limited by
        // Google itself, never touches this endpoint); this only caps how
        // often one account can hammer OUR id-token-verification call.
        RateLimiter::for('phone-verify', function (Request $request) {
            return Limit::perMinute(10)->by('phone-verify:'.$request->user()?->id);
        });

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
    }
}
