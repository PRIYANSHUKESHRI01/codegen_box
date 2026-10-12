<?php

namespace App\Support;

use Throwable;

/**
 * Sends ONE email without needing a queue worker.
 *
 * The rule in this app: an email that is the direct result of one action for
 * one recipient (an admin creating a TPO login, a student asking for a
 * password-reset code) goes out right there, in the request that caused it —
 * so it still arrives on a server where nobody is running `queue:work`. Only
 * genuine fan-out (bulk imports, bulk notifications, one drive proposed to
 * many colleges, a contest finalising for hundreds of students) is dispatched
 * to the queue, where a worker, per-recipient retries and the
 * `transactional-emails` rate limit earn their keep.
 *
 * The mail classes are the existing Send* jobs: this calls their handle()
 * directly instead of pushing them. That deliberately bypasses the job
 * middleware — a one-off send must not be silently dropped by the bulk
 * limiter (on the sync queue, a rate-limited job is "released" into nowhere).
 * Nothing is written to the jobs table on success, so a temporary password
 * is never stored there either.
 *
 * If the send fails (SMTP down, bad credentials, timeout) the error is
 * reported and the job is handed to the queue instead, so a worker — when one
 * is running — retries it with the job's own backoff. Jobs that guard against
 * double-sending (SendAccountCredentialsEmail's credentials_email_sent_at)
 * stay safe to retry.
 */
final class SingleMail
{
    /**
     * Send now, inside this request, and say whether it went out. Use it when
     * the response can tell the caller about it (e.g. "credentials emailed" vs
     * "couldn't email — share the password yourself").
     */
    public static function now(object $job): bool
    {
        try {
            app()->call([$job, 'handle']);

            return true;
        } catch (Throwable $e) {
            report($e);
            self::retryViaQueue($job);

            return false;
        }
    }

    /**
     * Send as soon as the HTTP response has been delivered. The caller is not
     * kept waiting on the mail server, and — for public endpoints such as
     * password reset — the response time can't reveal whether an address
     * exists (a real send is slower than doing nothing).
     *
     * From the console (an artisan command, a queue worker running some other
     * job) there is no response to wait for, and a worker never "terminates"
     * between jobs — so it just sends straight away. The callback is
     * single-shot: Laravel never clears terminating callbacks, so an app
     * instance that handles several requests (tests, Octane) would otherwise
     * re-send every earlier mail on each later request.
     */
    public static function afterResponse(object $job): void
    {
        if (app()->runningInConsole()) {
            self::now($job);

            return;
        }

        $sent = false;

        app()->terminating(static function () use ($job, &$sent) {
            if ($sent) {
                return;
            }

            $sent = true;
            self::now($job);
        });
    }

    private static function retryViaQueue(object $job): void
    {
        try {
            dispatch($job);
        } catch (Throwable $e) {
            report($e);
        }
    }
}
