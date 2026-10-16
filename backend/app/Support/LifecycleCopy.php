<?php

namespace App\Support;

use App\Enums\LifecycleEmail;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Every word of every lifecycle e-mail, in one file, so the copy can be read
 * and edited top to bottom without hunting through twelve templates. Each case
 * returns the same shape, which the single `emails.lifecycle` view lays out:
 *
 *   subject, preheader, badge, tone (green|blue|amber|red), title,
 *   paragraphs[], facts[label => value], list_title, list[],
 *   cta{label,url}, note
 *
 * `$d` is the small bag of plain values the sender put in the job (plan name, a
 * score, an ISO date…): plain values so the job serialises cleanly, and so a
 * retry days later still says what was true when it was queued. Prices and plan
 * perks are the exception — they are read from the plans table at send time, so
 * a message can never quote a price the superadmin has since changed.
 *
 * Nothing here may claim something the product does not do. Where a sentence
 * depends on a plan feature it is generated from the plan's own columns.
 */
final class LifecycleCopy
{
    /** @param array<string, mixed> $d */
    public static function build(LifecycleEmail $type, User $user, array $d = []): array
    {
        $first = trim(Str::before(trim((string) $user->name), ' ')) ?: 'there';

        $c = match ($type) {
            LifecycleEmail::WelcomeActivated => self::welcomeActivated($user, $first, $d),
            LifecycleEmail::PasswordChanged => self::passwordChanged($user, $first, $d),
            LifecycleEmail::PaymentFailed => self::paymentFailed($first, $d),
            LifecycleEmail::RefundProcessed => self::refundProcessed($first, $d),
            LifecycleEmail::PlanGranted => self::planGranted($first, $d),
            LifecycleEmail::PlanExtended => self::planExtended($first, $d),
            LifecycleEmail::PlanEnded => self::planEnded($first, $d),
            LifecycleEmail::PlanExpiring => self::planExpiring($first, $d),
            LifecycleEmail::PlanExpired => self::planExpired($first, $d),
            LifecycleEmail::VaultDelisted => self::vaultDelisted($first, $d),
            LifecycleEmail::UpgradeNudge => self::upgradeNudge($first, $d),
            LifecycleEmail::VaultUpgrade => self::vaultUpgrade($first, $d),
            LifecycleEmail::ReadinessPush => self::readinessPush($first, $d),
            LifecycleEmail::Inactivity => self::inactivity($first, $d),
        };

        return $c + [
            'tone' => 'blue',
            'facts' => [],
            'list_title' => null,
            'list' => [],
            'cta' => null,
            'note' => null,
        ];
    }

    // ───────────────────────────── security & money ─────────────────────────────

    /** An account somebody else created for this person (a student, or any staff role) has just had its password set by its owner for the first time. */
    private static function welcomeActivated(User $user, string $first, array $d): array
    {
        $college = trim((string) ($d['college'] ?? ''));

        if (($d['role'] ?? User::ROLE_USER) !== User::ROLE_USER) {
            return self::welcomeStaff($user, $first, (string) $d['role'], $d);
        }

        return [
            'subject' => "Welcome to AptRun, {$first}",
            'preheader' => 'Your password is set and your account is ready. Here is where to start.',
            'badge' => 'Account ready',
            'tone' => 'green',
            'title' => "You're all set, {$first}",
            'paragraphs' => array_values(array_filter([
                $college !== ''
                    ? "Your password is set and your AptRun account — created for you by **{$college}** — is ready to use."
                    : 'Your password is set and your AptRun account is ready to use.',
                'AptRun is where you practise coding, take AI mock interviews, enter contests and build a readiness score that shows how close you are to being placement-ready.',
                $college !== '' ? 'Your placement cell can follow your progress here, so the work you do counts.' : null,
            ])),
            'facts' => array_filter(['Signed in as' => $user->email, 'College' => $college !== '' ? $college : null]),
            'list_title' => 'Where to start',
            'list' => [
                'Solve your first problem in the Practice Arena.',
                'Take an AI mock interview to see where you stand.',
                "Enter today's contest — a new one is set every day.",
                'Complete your profile so your readiness score is as accurate as it can be.',
            ],
            'cta' => ['label' => 'Go to my dashboard', 'url' => self::app('/dashboard')],
            'note' => 'You are receiving this because an AptRun account was created for this email address and you have just set its password.',
        ];
    }

    private static function passwordChanged(User $user, string $first, array $d): array
    {
        $viaReset = ($d['via'] ?? 'settings') === 'reset';

        return [
            'subject' => 'Your AptRun password was changed',
            'preheader' => 'If this was not you, secure your account now.',
            'badge' => 'Security',
            'tone' => 'amber',
            'title' => 'Your password was changed',
            'paragraphs' => array_values(array_filter([
                "Hi {$first}, the password for your AptRun account (**{$user->email}**) was changed on **".self::when($d['at'] ?? null).'** '
                .($viaReset ? 'using a code sent to this email address.' : 'from your account settings.'),
                $viaReset ? 'For your safety you were signed out of every device — sign in again with the new password.' : null,
                '**If this was you,** there is nothing else to do.',
                '**If it was not you,** reset your password straight away with "Forgot password" on the sign-in page, then reply to this email so we can look at your account.',
            ])),
            'cta' => ['label' => 'Secure my account', 'url' => self::app('/login')],
            'note' => 'We send this every time a password changes, so you always know.',
        ];
    }

    /**
     * The welcome for everyone who is not a student: a TPO, a section coordinator, a company hiring-team member, Mellow
     * internal and marketing staff (a superadmin is never created this way). What each is told they can do is limited to
     * what their role really does; Mellow staff are told only about the areas their own permissions open.
     *
     * @param  array<string, mixed>  $d
     */
    private static function welcomeStaff(User $user, string $first, string $role, array $d): array
    {
        $college = trim((string) ($d['college'] ?? ''));
        $company = trim((string) ($d['company'] ?? ''));
        $section = trim((string) ($d['section'] ?? ''));

        [$title, $org, $intro, $list, $home] = match ($role) {
            User::ROLE_ADMIN_TPO => [
                'Training & Placement Officer',
                $college !== '' ? $college : 'your college',
                'You can bring your students onto AptRun, see how each of them is doing, and run placement drives for your campus.',
                [
                    'Add your students — one at a time or by uploading a roster.',
                    "See every student's readiness score and activity, and who needs a push.",
                    'Run placement drives and contests for your college.',
                    'Add Section Coordinators to look after individual sections.',
                    'Get a weekly email listing the students who are below the readiness line.',
                ],
                '/admin?view=tpo',
            ],
            User::ROLE_SECTION_COORDINATOR => [
                $section !== '' ? "Section Coordinator for Section {$section}" : 'Section Coordinator',
                $college !== '' ? $college : 'your college',
                $section !== ''
                    ? "You can see the students in Section {$section} only — no other section's — and follow how each of them is doing on AptRun."
                    : 'You can see the students in your own section only, and follow how each of them is doing on AptRun.',
                [
                    "See your section's students and their latest activity.",
                    "Open a student's full report — contests, interviews, practice and submissions.",
                    'Send your section a message or reminder in one go.',
                    "Review proctoring flags from your section's contests.",
                ],
                '/coordinator',
            ],
            User::ROLE_ADMIN_COMPANY => [
                'Hiring Team member',
                $company !== '' ? $company : 'your company',
                'AptRun is where you find ready students and run your hiring pipeline.',
                [
                    'Invite candidates and follow their assessments and interviews.',
                    'Run hiring drives, with your own contests and soft-skills tests.',
                    'Browse students in the Vault and show interest in the ones you want to meet.',
                    'Review proctoring flags and reports for your hiring events.',
                ],
                '/admin?view=company',
            ],
            User::ROLE_ADMIN_MARKETING => [
                'Marketing team member',
                'Mellow',
                'You work the leads and website inquiries that come in to AptRun.',
                self::permissionAreas($user, [
                    User::PERM_LEADS => 'Follow up your assigned leads and move them from new to converted.',
                    User::PERM_LEAD_OUTREACH => 'Send outreach messages to your leads.',
                ], 'Your administrator decides which parts of the marketing workspace you can use.'),
                '/marketing',
            ],
            default => [   // User::ROLE_ADMIN_INTERNAL
                'Internal team member',
                'Mellow',
                'You can use the parts of the admin workspace that your administrator has switched on for you.',
                self::permissionAreas($user, [
                    User::PERM_COLLEGES => 'Colleges and their plans',
                    User::PERM_PLATFORM_USERS => 'Platform users',
                    User::PERM_PROBLEM_BANK => 'The problem bank',
                    User::PERM_PLACEMENTS => 'Placements and drives',
                    User::PERM_CONTESTS => 'Contests',
                    User::PERM_INTERVIEWS => 'Interviews',
                    User::PERM_CUSTOMERS => 'Customers',
                    User::PERM_ARTICLES => 'Articles',
                    User::PERM_VAULT => 'The Vault',
                    User::PERM_SOFT_SKILLS => 'Soft-skills assessments',
                    User::PERM_PROJECT_LAB => 'Project Lab',
                    User::PERM_HACKATHONS => 'Hack Arena hackathons',
                ], 'Your administrator has not switched any areas on yet — ask them to add the access you need.'),
                '/admin?view=mellow',
            ],
        };

        $mellowStaff = in_array($role, [User::ROLE_ADMIN_INTERNAL, User::ROLE_ADMIN_MARKETING], true);

        return [
            'subject' => "Welcome to AptRun — {$title} at {$org}",
            'preheader' => "Your password is set. You're the {$title} at {$org}.",
            'badge' => 'Account ready',
            'tone' => 'green',
            'title' => "Welcome to AptRun, {$first}",
            'paragraphs' => [
                "Your password is set and your account is ready. You are the **{$title}** at **{$org}**.",
                $intro,
            ],
            'facts' => ['Signed in as' => $user->email, 'Role' => $title, 'Organisation' => $org],
            'list_title' => $role === User::ROLE_ADMIN_INTERNAL ? 'Areas you can open' : 'What you can do',
            'list' => array_values($list),
            'cta' => ['label' => 'Open my workspace', 'url' => self::app($home)],
            'note' => $mellowStaff
                ? 'You are receiving this because an AptRun account was created for this email address and you have just set its password.'
                : "You are receiving this because {$org} (or Mellow, on its behalf) created an AptRun account for this email address and you have just set its password.",
        ];
    }

    /**
     * The areas of the admin workspace this person holds a permission for, in the catalogue's own order. A person with
     * none gets the fallback line instead — never a promise of access they do not have.
     *
     * @param  array<string, string>  $catalogue  permission key => sentence
     * @return list<string>
     */
    private static function permissionAreas(User $user, array $catalogue, string $none): array
    {
        $held = array_values(array_filter($catalogue, fn (string $key) => $user->hasPermission($key), ARRAY_FILTER_USE_KEY));

        return $held === [] ? [$none] : $held;
    }

    private static function paymentFailed(string $first, array $d): array
    {
        $plan = $d['plan'] ?? 'your plan';
        $reason = trim((string) ($d['reason'] ?? ''));

        return [
            'subject' => "Your AptRun payment didn't go through",
            'preheader' => "We couldn't complete your payment for {$plan}. Nothing has changed on your account.",
            'badge' => 'Payment failed',
            'tone' => 'red',
            'title' => "We couldn't complete your payment",
            'paragraphs' => array_values(array_filter([
                "Hi {$first}, your payment for **{$plan}** did not go through, so your plan has not changed.",
                $reason !== '' ? "Your bank or payment app said: \"{$reason}\"" : null,
                'If any money left your account, it is reversed by your bank — usually within 5–7 working days. If it was debited and your plan is still not active after a few hours, reply to this email with the reference below and we will sort it out.',
            ])),
            'facts' => array_filter([
                'Plan' => $plan,
                'Amount' => isset($d['amount']) ? self::money((int) $d['amount']) : null,
                'Reference' => $d['order'] ?? null,
            ]),
            'list_title' => 'Things that usually fix it',
            'list' => [
                'Try a different UPI app, card or net banking.',
                'Check that online / international transactions are enabled for your card.',
                'Make sure the amount is within your daily limit.',
            ],
            'cta' => ['label' => 'Try the payment again', 'url' => self::app('/dashboard/billing')],
            'note' => 'You are receiving this because a payment on your AptRun account failed.',
        ];
    }

    private static function refundProcessed(string $first, array $d): array
    {
        $plan = $d['plan'] ?? 'your plan';
        $full = (bool) ($d['full'] ?? true);
        $amount = self::money((int) ($d['amount'] ?? 0));

        return [
            'subject' => "Your AptRun refund of {$amount} is on its way",
            'preheader' => $full ? "We've refunded your payment for {$plan}." : "We've made a partial refund on your payment for {$plan}.",
            'badge' => 'Refund',
            'tone' => 'green',
            'title' => "We've refunded {$amount}",
            'paragraphs' => array_values(array_filter([
                "Hi {$first}, your payment for **{$plan}** has been refunded ".($full ? 'in full.' : 'in part.'),
                $full
                    ? 'Because the whole payment went back, the plan it bought has ended and your account is on the free Coder plan. All your progress, scores and history are still here.'
                    : 'Your plan stays active — this was a partial refund only.',
                'The money goes back to the payment method you used. Your bank decides how fast it shows up; 5–7 working days is typical.',
            ])),
            'facts' => array_filter([
                'Refunded' => $amount,
                'Plan' => $plan,
                'Reference' => $d['order'] ?? null,
            ]),
            'cta' => ['label' => 'View billing', 'url' => self::app('/dashboard/billing')],
            'note' => 'Keep this email for your records. If you did not expect a refund, reply and we will explain.',
        ];
    }

    // ───────────────────────────── plan lifecycle ─────────────────────────────

    private static function planGranted(string $first, array $d): array
    {
        $plan = $d['plan'] ?? 'a paid plan';
        $comp = (bool) ($d['complimentary'] ?? true);
        $days = (int) ($d['days'] ?? 0);

        return [
            'subject' => "Your {$plan} plan is active",
            'preheader' => "Our team has switched on {$plan} for your account.",
            'badge' => 'Plan activated',
            'tone' => 'green',
            'title' => "{$plan} is now active on your account",
            'paragraphs' => array_values(array_filter([
                $comp
                    ? "Hi {$first}, our team has activated **{$plan}** on your account at no charge."
                    : "Hi {$first}, our team has activated **{$plan}** on your account, against the payment you made to us directly.",
                $days > 0 ? "It runs for **{$days} days**, until **".self::day($d['ends_at'] ?? null).'**. Everything below is unlocked right now — there is nothing to set up.' : null,
            ])),
            'facts' => array_filter(['Plan' => $plan, 'Active until' => isset($d['ends_at']) ? self::day($d['ends_at']) : null]),
            'list_title' => 'What you can do now',
            'list' => self::perks(self::plan($d['plan_code'] ?? null)),
            'cta' => ['label' => 'Go to my dashboard', 'url' => self::app('/dashboard')],
            'note' => 'You are receiving this because a plan was added to your AptRun account.',
        ];
    }

    private static function planExtended(string $first, array $d): array
    {
        $plan = $d['plan'] ?? 'your plan';
        $days = (int) ($d['days'] ?? 0);

        return [
            'subject' => "{$days} more days added to your {$plan} plan",
            'preheader' => 'Your plan now runs until '.self::day($d['ends_at'] ?? null).'.',
            'badge' => 'Plan extended',
            'tone' => 'green',
            'title' => "We've added {$days} days to {$plan}",
            'paragraphs' => [
                "Hi {$first}, our team has added **{$days} days** to your **{$plan}** plan. Nothing else about it changed.",
            ],
            'facts' => ['Plan' => $plan, 'Now active until' => self::day($d['ends_at'] ?? null)],
            'cta' => ['label' => 'Open my dashboard', 'url' => self::app('/dashboard')],
            'note' => 'You are receiving this because your AptRun plan was changed.',
        ];
    }

    private static function planEnded(string $first, array $d): array
    {
        $plan = $d['plan'] ?? 'Your plan';

        return [
            'subject' => "Your {$plan} plan has been ended",
            'preheader' => 'Your account is back on the free Coder plan. Your progress is untouched.',
            'badge' => 'Plan ended',
            'tone' => 'amber',
            'title' => "Your {$plan} plan has ended",
            'paragraphs' => [
                "Hi {$first}, our team has ended the **{$plan}** plan on your account, so you are now on the free **Coder** plan.",
                'Your progress, scores, submissions and history are all still here. If you think this is a mistake, just reply to this email.',
            ],
            'cta' => ['label' => 'See plans', 'url' => self::app('/dashboard/billing')],
            'note' => 'You are receiving this because your AptRun plan was changed.',
        ];
    }

    private static function planExpiring(string $first, array $d): array
    {
        $plan = $d['plan'] ?? 'Your plan';
        $left = max(0, (int) ($d['days_left'] ?? 1));
        $when = match ($left) {
            0 => 'today',
            1 => 'tomorrow',
            default => "in {$left} days",
        };
        $model = self::plan($d['plan_code'] ?? null);
        $price = $model !== null && $model->listPrice() > 0 ? self::money($model->salePrice()) : null;

        return [
            'subject' => "Your {$plan} plan ends {$when}",
            'preheader' => 'Renew now and the new term is added on top of the days you have left.',
            'badge' => 'Plan ending',
            'tone' => 'amber',
            'title' => "{$plan} ends {$when}",
            'paragraphs' => array_values(array_filter([
                "Hi {$first}, your **{$plan}** plan ends on **".self::day($d['ends_at'] ?? null).'**. After that your account moves to the free Coder plan.',
                'Renewing early costs you nothing extra in time: the new term is added **on top of** the days you have left.',
                $price !== null ? "Renewal price: **{$price}**".($model->termUnit() ? " per {$model->termUnit()}" : '').'.' : null,
            ])),
            'list_title' => "What you'll lose when it ends",
            'list' => self::perks($model),
            'cta' => ['label' => "Renew {$plan}", 'url' => self::app('/dashboard/billing')],
            'note' => 'You are receiving this because your AptRun plan is about to end.',
        ];
    }

    private static function planExpired(string $first, array $d): array
    {
        $plan = $d['plan'] ?? 'Your plan';
        $model = self::plan($d['plan_code'] ?? null);

        return [
            'subject' => "Your {$plan} plan has expired",
            'preheader' => 'Your progress is safe. Renew to switch everything back on.',
            'badge' => 'Plan expired',
            'tone' => 'amber',
            'title' => "{$plan} has expired",
            'paragraphs' => array_values(array_filter([
                "Hi {$first}, your **{$plan}** plan ended on **".self::day($d['ended_at'] ?? null).'** and your account is now on the free Coder plan.',
                'Your progress, scores and history are all still here — nothing was deleted.',
                ! empty($d['had_vault']) ? 'If you were listed in the Vault, your listing is paused. Your "yes" to being listed is remembered, so renewing puts you straight back.' : null,
            ])),
            'list_title' => 'Paused until you renew',
            'list' => self::perks($model),
            'cta' => ['label' => "Renew {$plan}", 'url' => self::app('/dashboard/billing')],
            'note' => 'You are receiving this because your AptRun plan ended.',
        ];
    }

    // ───────────────────────────── the Vault ─────────────────────────────

    private static function vaultDelisted(string $first, array $d): array
    {
        $score = (int) ($d['score'] ?? 0);
        $enter = (int) ($d['enter'] ?? 60);
        $exit = (int) ($d['exit'] ?? 55);

        return [
            'subject' => 'Your readiness score dipped — your Vault listing is paused',
            'preheader' => "You're at {$score}. Get back to {$enter} and you are listed again automatically.",
            'badge' => 'Vault',
            'tone' => 'amber',
            'title' => 'Your Vault listing is paused',
            'paragraphs' => [
                "Hi {$first}, your readiness score is now **{$score}**. The Vault lists students at **{$enter}** and above, and takes a profile down once the score falls below **{$exit}**.",
                "Your profile is hidden from hiring partners and Mellow Vault for now. Nothing is lost — your consent is remembered, and you are listed again automatically when you are back at {$enter}.",
                'The score only counts recent work, so it slips when you go quiet. A few focused sessions are usually enough to bring it back.',
            ],
            'facts' => ['Your score' => (string) $score, 'Vault opens at' => (string) $enter],
            'list_title' => 'The quickest ways back',
            'list' => array_slice((array) ($d['steps'] ?? []), 0, 3),
            'cta' => ['label' => 'See my readiness', 'url' => self::app('/dashboard/vault')],
            'note' => 'You are receiving this because your Vault status changed.',
        ];
    }

    private static function vaultUpgrade(string $first, array $d): array
    {
        $score = (int) ($d['score'] ?? 60);
        $enter = (int) ($d['enter'] ?? 60);
        $reminder = (int) ($d['stage'] ?? 0) > 0;
        $expert = self::plan(Plan::CODE_EXPERT);

        return [
            'subject' => $reminder ? 'Reminder: your Vault listing is waiting for you' : "You're Vault-ready — one step left to be seen by employers",
            'preheader' => "Your readiness score is {$score}. Your plan doesn't include Vault listing yet.",
            'badge' => 'Vault',
            'tone' => 'green',
            'title' => $reminder ? 'Your Vault listing is still waiting' : "You've earned your place in the Vault",
            'paragraphs' => [
                "Hi {$first}, your readiness score is **{$score}** — above the **{$enter}** the Vault looks for. That number comes from real work on AptRun: interviews, coding, the Learning Centre, soft skills and contests.",
                "Listing in the Vault — where hiring partners and employers on Mellow Vault find students — is part of the **Expert** plan, and your current plan doesn't include it. Right now you are not visible to anyone.",
                "Upgrading unlocks it straight away, with no retake needed. Your score has already done the hard part.",
            ],
            'facts' => ['Your score' => (string) $score, 'Vault opens at' => (string) $enter] + self::priceFacts($expert),
            'cta' => ['label' => 'Unlock my Vault listing', 'url' => self::app('/dashboard/billing')],
            'note' => 'You are receiving this because you reached the Vault score on AptRun.',
        ];
    }

    private static function readinessPush(string $first, array $d): array
    {
        $score = (int) ($d['score'] ?? 0);
        $enter = (int) ($d['enter'] ?? 60);
        $needed = max(1, (int) ($d['needed'] ?? ($enter - $score)));
        $points = $needed === 1 ? '1 point' : "{$needed} points";
        $steps = array_slice((array) ($d['steps'] ?? []), 0, 3);

        return [
            'subject' => "You're {$points} away from the Vault",
            'preheader' => "Your readiness score is {$score}. {$enter} puts you in front of employers.",
            'badge' => 'Almost there',
            'tone' => 'blue',
            'title' => "{$points} to go",
            'paragraphs' => array_values(array_filter([
                "Hi {$first}, your AptRun readiness score is **{$score} out of 100**. The Vault opens at **{$enter}** — that is where hiring partners and employers on Mellow Vault look for students who are ready to be hired.",
                "You're {$points} away. Here is where the next points are easiest to find:",
                ! empty($d['needs_plan']) ? 'You can build your score on any plan. Vault listing itself is part of Expert, so you can upgrade when you get there.' : null,
            ])),
            'facts' => ['Your score' => (string) $score, 'Vault opens at' => (string) $enter],
            'list_title' => 'Your quickest wins',
            'list' => $steps,
            'cta' => ['label' => 'See my readiness', 'url' => self::app('/dashboard/vault')],
            'note' => 'You are receiving this because your readiness score is close to the Vault line.',
        ];
    }

    // ───────────────────────────── nudges ─────────────────────────────

    private static function upgradeNudge(string $first, array $d): array
    {
        $stage = max(1, min(3, (int) ($d['stage'] ?? 1)));
        $expert = self::plan(Plan::CODE_EXPERT);
        $perks = self::perks($expert, compareWithFree: true);
        $price = self::priceFacts($expert);
                $cta = ['label' => 'See what Expert includes', 'url' => self::app('/dashboard/billing')];
        $note = 'You are receiving this because you have a free AptRun account.';

        return match ($stage) {
            1 => [
                'subject' => 'What Expert adds to your AptRun practice',
                'preheader' => 'More practice, more AI mock interviews, and a route to employers.',
                'badge' => 'Your plan',
                'title' => 'Ready for more than the free plan?',
                'paragraphs' => [
                    "Hi {$first}, you've been on AptRun's free Coder plan for a few days. It is a good way to start — and the limits are where most people hit a wall.",
                    '**Expert** removes those limits and adds the things employers look for.',
                ],
                'facts' => $price,
                'list_title' => "What's included",
                'list' => $perks,
                'cta' => $cta,
                'note' => $note,
            ],
            2 => [
                'subject' => 'How students get in front of employers on AptRun',
                'preheader' => 'Your readiness score is your proof. The Vault is where it gets seen.',
                'badge' => 'The Vault',
                'title' => 'Employers hire from the Vault',
                'paragraphs' => [
                    "Hi {$first}, every AptRun student has a **readiness score** out of 100, built from the work they actually do — mock interviews, coding practice, the Learning Centre, soft skills and contests.",
                    'Reach **60** and you qualify for the **Vault**: your profile, with that score as proof, is shown to hiring partners on AptRun and to employers on Mellow Vault. Nothing is shared until you say yes.',
                    'Building the score is open to everyone. Vault listing — and the practice volume to get there faster — is part of Expert.',
                ],
                'facts' => $price,
                'cta' => ['label' => 'Get Expert', 'url' => self::app('/dashboard/billing')],
                'note' => $note,
            ],
            default => [
                'subject' => 'Our last note about Expert',
                'preheader' => 'We will not keep emailing you about this.',
                'badge' => 'Your plan',
                'title' => 'One last note from us',
                'paragraphs' => [
                    "Hi {$first}, this is the last time we will mention upgrading.",
                    'If you are serious about placements this year, Expert is the plan built for it.',
                    'If now is not the time, the free plan stays free and your progress stays yours. We will not email you about plans again.',
                ],
                'facts' => $price,
                'list_title' => 'What you would get',
                'list' => $perks,
                'cta' => ['label' => 'Take a look at Expert', 'url' => self::app('/dashboard/billing')],
                'note' => $note,
            ],
        };
    }

    private static function inactivity(string $first, array $d): array
    {
        $days = (int) ($d['days'] ?? 14);
        $score = isset($d['score']) ? (int) $d['score'] : null;
        $second = (int) ($d['stage'] ?? 1) > 1;

        return [
            'subject' => $second ? 'Still planning for placements? A quick restart' : "We haven't seen you on AptRun in {$days} days",
            'preheader' => $score !== null ? "Your readiness score is {$score} and it slips while you're away." : 'Pick up where you left off.',
            'badge' => 'Welcome back',
            'title' => $second ? 'A quick way back in' : 'Your practice is where you left it',
            'paragraphs' => array_values(array_filter([
                "Hi {$first}, it has been about **{$days} days** since you last opened AptRun.",
                $score !== null ? "Your readiness score only counts recent work, so it drifts down while you are away — it is **{$score}** today. The good news: a few sessions move it back up quickly." : null,
                'You do not need a long session. Fifteen focused minutes is enough to be back in the habit.',
            ])),
            'list_title' => 'Easy ways to restart',
            'list' => [
                'Solve a problem from the Practice Arena.',
                "Enter today's contest — a new one is set every day.",
                'Take a short AI mock interview and see where you stand.',
            ],
            'cta' => ['label' => 'Back to AptRun', 'url' => self::app('/dashboard')],
            'note' => 'You are receiving this because you have an AptRun account.',
        ];
    }

    // ───────────────────────────── helpers ─────────────────────────────

    public static function app(string $path): string
    {
        return rtrim((string) config('app.frontend_url'), '/').$path;
    }

    private static function money(int $rupees): string
    {
        return '₹'.number_format($rupees, 0, '.', ',');
    }

    private static function when(?string $iso): string
    {
        $tz = (string) config('lifecycle_mail.timezone', 'Asia/Kolkata');

        return Carbon::parse($iso ?? now())->timezone($tz)->format('j M Y, g:i A').' IST';
    }

    private static function day(?string $iso): string
    {
        return $iso === null ? 'the end of your term' : Carbon::parse($iso)->timezone((string) config('lifecycle_mail.timezone', 'Asia/Kolkata'))->format('j F Y');
    }

    private static function plan(?string $code): ?Plan
    {
        return $code === null ? null : Plan::where('code', $code)->first();
    }

    /**
     * The price rows of an upgrade e-mail, straight from the plan row ("Expert plan ₹2,999 a year", and the discount when
     * there is one). Empty for a plan with no online price, so a nudge never quotes a number that does not exist.
     *
     * @return array<string, string>
     */
    private static function priceFacts(?Plan $plan): array
    {
        if ($plan === null || $plan->listPrice() <= 0) {
            return [];
        }

        $unit = $plan->termUnit() ? " a {$plan->termUnit()}" : '';
        $facts = [$plan->name.' plan' => self::money($plan->salePrice()).$unit];

        if ($plan->hasDiscount()) {
            $facts['Discount'] = $plan->discount_percent.'% off the '.self::money($plan->listPrice()).' list price';
        }

        return $facts;
    }

    /**
     * What a plan includes, in sentences, generated from the columns that
     * enforce it. `$compareWithFree` adds "(Coder: 1)" to the practice line.
     *
     * @return list<string>
     */
    private static function perks(?Plan $plan, bool $compareWithFree = false): array
    {
        if ($plan === null) {
            return [];
        }

        $free = $compareWithFree
            ? Plan::where('audience', Plan::AUDIENCE_INDIVIDUAL)->where('kind', Plan::KIND_BASE)->where('list_price', 0)->first()
            : null;

        $out = [];

        $practice = $plan->max_practice_problems_per_day;
        $out[] = $practice === null
            ? 'Unlimited practice problems every day'
            : "{$practice} practice problems a day".($free?->max_practice_problems_per_day !== null ? " (the free plan: {$free->max_practice_problems_per_day})" : '');

        $interviews = $plan->max_mock_interviews_per_day;
        $out[] = $interviews === null ? 'Unlimited AI mock interviews' : "{$interviews} AI mock interviews a day";

        if ($plan->hackathon_access) {
            $out[] = 'Register and submit in Hack Arena hackathons';
        }

        if ($plan->project_lab_access) {
            $out[] = 'Project Lab — build real projects in a hosted workspace';
        }

        if ($plan->vault_access) {
            $out[] = 'Vault listing — be found by hiring partners and Mellow Vault employers';
        }

        return $out;
    }
}
