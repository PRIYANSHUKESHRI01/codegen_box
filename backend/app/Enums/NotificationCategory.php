<?php

namespace App\Enums;

/**
 * What a person can mute in Settings → Notifications. Every NotificationType belongs to exactly one.
 *
 * `mandatory()` categories can't be muted: they are about the person's own account, money or access, and a
 * notification someone switched off and then missed ("your plan ended", "your password was changed") costs
 * them more than the bell badge ever could.
 */
enum NotificationCategory: string
{
    case Drives = 'drives';
    case Assessments = 'assessments';
    case Hackathons = 'hackathons';
    case Announcements = 'announcements';
    case Vault = 'vault';
    case Progress = 'progress';
    case Operations = 'operations';
    case Plan = 'plan';
    case Account = 'account';

    public function label(): string
    {
        return match ($this) {
            self::Drives => 'Placement drives',
            self::Assessments => 'Tests, contests & interviews',
            self::Hackathons => 'Hackathons',
            self::Announcements => 'Messages from your college',
            self::Vault => 'Vault & hiring partners',
            self::Progress => 'Readiness & daily practice',
            self::Operations => 'Team & operations',
            self::Plan => 'Plans & payments',
            self::Account => 'Account & security',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::Drives => 'A drive goes live for you, your application moves to a new round, or a college proposal needs an answer.',
            self::Assessments => 'A mock test, contest, AI interview or soft-skills assessment is scheduled for you.',
            self::Hackathons => 'A hackathon opens for you, or the organiser posts an announcement or cancels it.',
            self::Announcements => 'Messages your TPO or section coordinator sends to students.',
            self::Vault => 'A hiring partner shows interest, invites you to interview or makes an offer.',
            self::Progress => 'Your readiness score is slipping because you have missed days of practice.',
            self::Operations => 'New leads and enquiries, payments received and finished imports.',
            self::Plan => 'Your plan is given, extended, ends or expires, and payment receipts and refunds.',
            self::Account => 'Password changes and sign-in security.',
        };
    }

    public function mandatory(): bool
    {
        return in_array($this, [self::Plan, self::Account], true);
    }
}
