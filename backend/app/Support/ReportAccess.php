<?php

namespace App\Support;

use App\Models\GeneratedReport;
use App\Models\Interview;
use App\Models\User;

/**
 * THE rule for who may generate or open which report. Every controller that touches a PDF report asks here, so the answer is
 * the same on the TPO screen, the coordinator screen, the student's own page and the platform-staff page — and a wrong guess
 * is always a 404, never a 403, so an id cannot be used to learn that someone else's student or report exists.
 *
 *   TPO ................ any student, interview or report of their own college
 *   Section coordinator . students they coordinate (the one scope rule, User::coordinates) and reports about them
 *   Platform staff ..... any student's report (the `platform_users` permission), nothing else
 *   Student ............ their own report, written for them (no internal follow-up notes)
 */
final class ReportAccess
{
    public static function student(User $actor, User $student): bool
    {
        if ($student->role !== User::ROLE_USER) {
            return false;
        }

        return match ($actor->role) {
            User::ROLE_ADMIN_TPO => $actor->college_id !== null && (int) $actor->college_id === (int) $student->college_id,
            User::ROLE_SECTION_COORDINATOR => $actor->coordinates($student),
            User::ROLE_ADMIN_INTERNAL, User::ROLE_SUPERADMIN => $actor->hasPermission(User::PERM_PLATFORM_USERS),
            User::ROLE_USER => $actor->id === $student->id,
            default => false,
        };
    }

    /** The audience a report for this student is written for when `$actor` asks. */
    public static function audience(User $actor, User $student): string
    {
        return $actor->id === $student->id ? GeneratedReport::AUDIENCE_STUDENT : GeneratedReport::AUDIENCE_STAFF;
    }

    /** A college TPO's own mock AI interview (the only interviews that have college-level reports). */
    public static function interview(User $actor, Interview $interview): bool
    {
        return $actor->role === User::ROLE_ADMIN_TPO
            && $interview->isTpoMock()
            && $actor->college_id !== null
            && (int) $interview->owning_college_id === (int) $actor->college_id;
    }

    public static function report(User $actor, GeneratedReport $report): bool
    {
        // The Vault AI Interview report holds no internal notes, so it is for the student and everyone who looks after them: the same
        // people who may read the student at all (self::student), whatever the report's audience.
        if ($report->kind === GeneratedReport::KIND_VAULT_AI) {
            return $report->subject !== null && self::student($actor, $report->subject);
        }

        return match ($actor->role) {
            User::ROLE_ADMIN_TPO => $actor->college_id !== null && (int) $report->college_id === (int) $actor->college_id,
            User::ROLE_SECTION_COORDINATOR => $report->audience === GeneratedReport::AUDIENCE_STAFF
                && ($report->generated_by === $actor->id
                    || ($report->subject !== null && $actor->coordinates($report->subject))),
            User::ROLE_ADMIN_INTERNAL, User::ROLE_SUPERADMIN => $report->kind === GeneratedReport::KIND_STUDENT
                && $report->subject !== null
                && $actor->hasPermission(User::PERM_PLATFORM_USERS),
            User::ROLE_USER => $report->subject_user_id === $actor->id && $report->audience === GeneratedReport::AUDIENCE_STUDENT,
            default => false,
        };
    }
}
