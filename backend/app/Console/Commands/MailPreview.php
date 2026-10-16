<?php

namespace App\Console\Commands;

use App\Enums\LifecycleEmail;
use App\Mail\LifecycleMail;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * See (or inbox-test) every lifecycle e-mail without making anything happen.
 *
 *   php artisan mail:preview --out=storage/mail-preview   write one .html file per e-mail, open in a browser
 *   php artisan mail:preview --to=me@example.com          send all of them to one address, to see them in a real inbox
 *   php artisan mail:preview --to=me@example.com --only=plan_expiring
 *
 * Sample data only: it never touches a real student, never writes to the
 * lifecycle_emails log and never changes any state. The subject lines of what is
 * sent are prefixed "[PREVIEW]" so a test cannot be mistaken for the real thing.
 */
class MailPreview extends Command
{
    protected $signature = 'mail:preview
        {--out= : Directory to write .html files into}
        {--to= : Address to send the previews to}
        {--only=* : Only these kinds}';

    protected $description = 'Render the lifecycle e-mails with sample data, to files or to one inbox';

    public function handle(): int
    {
        $out = (string) $this->option('out');
        $to = (string) $this->option('to');

        if ($out === '' && $to === '') {
            $this->error('Give --out=<directory> and/or --to=<address>.');

            return self::INVALID;
        }

        $only = array_filter((array) $this->option('only'));
        $user = new User(['name' => 'Aarav Sharma', 'email' => $to !== '' ? $to : 'aarav@example.com']);
        $user->id = 1;

        if ($out !== '' && ! is_dir($out) && ! mkdir($out, 0775, true) && ! is_dir($out)) {
            $this->error("Cannot create {$out}.");

            return self::FAILURE;
        }

        $failed = 0;

        foreach (LifecycleEmail::cases() as $type) {
            foreach ($this->samples($type) as $label => $data) {
                $name = $type->value.($label === '' ? '' : "-{$label}");

                if ($only !== [] && ! in_array($type->value, $only, true)) {
                    continue;
                }

                try {
                    $mail = new LifecycleMail($user, $type, $data);
                    $mail->subject('[PREVIEW] '.$mail->content['subject']);

                    if ($out !== '') {
                        file_put_contents(rtrim($out, '/\\')."/{$name}.html", $mail->render());
                    }

                    if ($to !== '') {
                        Mail::to($to)->send($mail);
                    }

                    $this->line("  ok  {$name}  —  {$mail->content['subject']}");
                } catch (Throwable $e) {
                    $failed++;
                    $this->error("  FAIL {$name}: ".$e->getMessage());
                }
            }
        }

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    /** @return array<string, array<string, mixed>> variants of one e-mail, keyed by file-name suffix */
    private function samples(LifecycleEmail $type): array
    {
        $ends = now()->addDays(7)->toIso8601String();
        $steps = [
            'Take another AI mock interview — your recent ones are worth 55% and a few more builds a stronger record.',
            "Enter today's contest, or one your placement cell scheduled, and solve at least one problem.",
            'Show up on more days. A little each day beats a long gap — 6 of the last 14 days.',
        ];

        return match ($type) {
            LifecycleEmail::WelcomeActivated => ['college' => ['college' => 'APEX Institute of Technology'], 'coordinator' => ['college' => 'APEX Institute of Technology', 'role' => 'section_coordinator', 'section' => 'CSE-B'],
                'tpo' => ['college' => 'APEX Institute of Technology', 'role' => 'admin_tpo'],
                'company' => ['company' => 'Acme Technologies', 'role' => 'admin_company'],
                'internal' => ['role' => 'admin_internal'],
                'marketing' => ['role' => 'admin_marketing'],
                'direct' => []],
            LifecycleEmail::PasswordChanged => ['settings' => ['via' => 'settings', 'at' => now()->toIso8601String()], 'reset' => ['via' => 'reset', 'at' => now()->toIso8601String()]],
            LifecycleEmail::PaymentFailed => ['' => ['order' => 'ord_8F3K2Q', 'plan' => 'Expert', 'amount' => 2999, 'reason' => 'Payment declined by the bank']],
            LifecycleEmail::RefundProcessed => ['full' => ['order' => 'ord_8F3K2Q', 'plan' => 'Expert', 'amount' => 2999, 'full' => true], 'partial' => ['order' => 'ord_8F3K2Q', 'plan' => 'Expert', 'amount' => 500, 'full' => false]],
            LifecycleEmail::PlanGranted => ['' => ['plan' => 'Expert', 'plan_code' => 'expert', 'days' => 365, 'ends_at' => now()->addDays(365)->toIso8601String(), 'complimentary' => true]],
            LifecycleEmail::PlanExtended => ['' => ['plan' => 'Expert', 'plan_code' => 'expert', 'days' => 30, 'ends_at' => $ends]],
            LifecycleEmail::PlanEnded => ['' => ['plan' => 'Expert', 'plan_code' => 'expert']],
            LifecycleEmail::PlanExpiring => ['7-days' => ['plan' => 'Expert', 'plan_code' => 'expert', 'days_left' => 7, 'ends_at' => $ends], 'tomorrow' => ['plan' => 'Expert', 'plan_code' => 'expert', 'days_left' => 1, 'ends_at' => now()->addDay()->toIso8601String()]],
            LifecycleEmail::PlanExpired => ['' => ['plan' => 'Expert', 'plan_code' => 'expert', 'ended_at' => now()->subDay()->toIso8601String(), 'had_vault' => true]],
            LifecycleEmail::VaultDelisted => ['' => ['score' => 52, 'enter' => 60, 'exit' => 55, 'steps' => $steps]],
            LifecycleEmail::UpgradeNudge => ['1' => ['stage' => 1], '2' => ['stage' => 2], '3' => ['stage' => 3]],
            LifecycleEmail::VaultUpgrade => ['first' => ['score' => 63, 'enter' => 60, 'stage' => 0], 'reminder' => ['score' => 63, 'enter' => 60, 'stage' => 1]],
            LifecycleEmail::ReadinessPush => ['' => ['score' => 54, 'enter' => 60, 'needed' => 6, 'steps' => $steps, 'needs_plan' => true]],
            LifecycleEmail::Inactivity => ['1' => ['days' => 15, 'score' => 41, 'stage' => 1], '2' => ['days' => 46, 'score' => 33, 'stage' => 2]],
        };
    }
}
