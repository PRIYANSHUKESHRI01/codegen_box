<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Transport\Smtp\SmtpTransport;
use Throwable;

/**
 * "Will e-mail actually leave this server?" — the question to ask before
 * debugging anything else.
 *
 *   php artisan mail:check                    config + a real SMTP connect and login. Sends NOTHING.
 *   php artisan mail:check --send-to=me@x.com also sends one small test message there.
 *
 * With MAIL_MAILER=log or array the check says so plainly: those mailers "succeed"
 * without delivering anything, which is the most common reason an app looks like
 * it is sending e-mail and is not.
 */
class MailCheck extends Command
{
    protected $signature = 'mail:check {--send-to= : Also send one test message to this address}';

    protected $description = 'Check the mail configuration, log in to the SMTP server, and optionally send a test message';

    public function handle(): int
    {
        $default = (string) config('mail.default');
        $mailer = (array) config("mail.mailers.{$default}");
        $from = config('mail.from');

        $this->line("Mailer ........ {$default}");
        $this->line('From .......... '.($from['name'] ?? '').' <'.($from['address'] ?? '').'>');

        if (in_array($default, ['log', 'array'], true)) {
            $this->warn("MAIL_MAILER={$default}: messages are written to the log / memory and NEVER delivered. Set MAIL_MAILER=smtp (or ses, postmark, resend) in .env.");

            return self::FAILURE;
        }

        if (($mailer['transport'] ?? null) === 'smtp') {
            $this->line('Server ........ '.($mailer['host'] ?? '?').':'.($mailer['port'] ?? '?').' ('.($mailer['scheme'] ?? 'auto').')');
            $this->line('Login ......... '.($mailer['username'] ?? '(none)').'  password '.(empty($mailer['password']) ? 'NOT SET' : 'set'));

            if (empty($mailer['username']) || empty($mailer['password'])) {
                $this->error('MAIL_USERNAME / MAIL_PASSWORD are empty — the server will refuse to relay.');

                return self::FAILURE;
            }
        }

        if (in_array(strtolower((string) ($from['address'] ?? '')), ['', 'hello@example.com'], true)) {
            $this->error('MAIL_FROM_ADDRESS is not set to a real address.');

            return self::FAILURE;
        }

        try {
            $transport = Mail::mailer($default)->getSymfonyTransport();

            if ($transport instanceof SmtpTransport) {
                $transport->start();   // connects, negotiates TLS and authenticates — no message is sent
                $transport->stop();
                $this->info('SMTP connection and login: OK.');
            } else {
                $this->line('Transport is not SMTP; skipping the connection test.');
            }
        } catch (Throwable $e) {
            $this->error('Could not connect/login: '.$e->getMessage());
            $this->line('Gmail/Workspace needs an App Password (2-Step Verification on), not the account password; check MAIL_HOST/PORT/SCHEME (465 + smtps, or 587 + smtp).');

            return self::FAILURE;
        }

        if (($to = (string) $this->option('send-to')) !== '') {
            try {
                Mail::raw(
                    "This is a test message from AptRun's mail:check command, sent ".now()->toDayDateTimeString().".\nIf you can read it, e-mail delivery from this server works.",
                    fn ($message) => $message->to($to)->subject('AptRun mail check')
                );
                $this->info("Test message handed to the mail server for {$to}.");
            } catch (Throwable $e) {
                $this->error('Sending failed: '.$e->getMessage());

                return self::FAILURE;
            }
        }

        return self::SUCCESS;
    }
}
