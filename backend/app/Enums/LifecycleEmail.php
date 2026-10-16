<?php

namespace App\Enums;

/**
 * The e-mails AptRun sends because something happened to a student's account,
 * money or progress (as opposed to the one-off account e-mails that have their
 * own mailable: welcome, credentials, password-reset code, payment receipt,
 * "you're Vault-ready", Vault hiring-partner mail…).
 *
 * Two families, and the line between them matters:
 *
 *   transactional  about the student's own account, money or security. Always
 *                  sent; the unsubscribe link does not (and legally should not)
 *                  switch them off.
 *   engagement     we are the ones asking for their attention — buy a plan,
 *                  practise more, come back. Every one carries an unsubscribe
 *                  link and a List-Unsubscribe header, stops for a student who
 *                  used it, and is paced so nobody is mailed more than once
 *                  every few days (config/lifecycle_mail.php).
 *
 * The copy for each case lives in App\Support\LifecycleCopy; who is sent what,
 * and when, in App\Services\LifecycleMailService (things that happen) and
 * App\Services\LifecycleSweepService (things that are due).
 */
enum LifecycleEmail: string
{
    // transactional
    case WelcomeActivated = 'welcome_activated';
    case PasswordChanged = 'password_changed';
    case PaymentFailed = 'payment_failed';
    case RefundProcessed = 'refund_processed';
    case PlanGranted = 'plan_granted';
    case PlanExtended = 'plan_extended';
    case PlanEnded = 'plan_ended';
    case PlanExpiring = 'plan_expiring';
    case PlanExpired = 'plan_expired';
    case VaultDelisted = 'vault_delisted';

    // engagement
    case UpgradeNudge = 'upgrade_nudge';
    case VaultUpgrade = 'vault_upgrade';
    case ReadinessPush = 'readiness_push';
    case Inactivity = 'inactivity';

    public function isEngagement(): bool
    {
        return in_array($this, [self::UpgradeNudge, self::VaultUpgrade, self::ReadinessPush, self::Inactivity], true);
    }

    /** @return list<string> the `type` values of every engagement message */
    public static function engagementValues(): array
    {
        return array_values(array_map(
            fn (self $t) => $t->value,
            array_filter(self::cases(), fn (self $t) => $t->isEngagement())
        ));
    }
}
