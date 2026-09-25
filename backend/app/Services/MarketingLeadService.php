<?php

namespace App\Services;

use App\Jobs\SendStudentBulkNotification;
use App\Models\ActivityLog;
use App\Models\LeadNote;
use App\Models\User;
use Illuminate\Support\Facades\Bus;
use Illuminate\Validation\ValidationException;

/**
 * The one write path for the marketing team's lead-management actions —
 * mirrors DrivePipelineService/PasswordResetService's "one focused service
 * per feature" shape in this codebase.
 */
class MarketingLeadService
{
    public function updateStatus(User $lead, string $status, User $actor): User
    {
        if (! in_array($status, User::LEAD_STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => ['That is not a valid lead status.'],
            ]);
        }

        $lead->forceFill(['lead_status' => $status])->save();

        ActivityLog::record(
            $actor,
            "Updated lead status to \"{$status}\"",
            'User',
            $lead->name,
            ['lead_id' => $lead->id]
        );

        return $lead->fresh();
    }

    public function addNote(User $lead, string $note, User $actor): LeadNote
    {
        return LeadNote::create([
            'user_id' => $lead->id,
            'author_id' => $actor->id,
            'note' => $note,
        ]);
    }

    /**
     * Re-validates every id is a real "Mellow Direct" lead before sending
     * anything — a marketing staffer id-guessing a college student or
     * another staff account must never reach them, silently dropped rather
     * than erroring, same convention TpoStudentController::bulkNotify()
     * already uses for its own out-of-scope ids. A marketing employee is
     * further restricted to leads assigned to them — id-guessing a
     * colleague's lead must silently drop too, not send. Email only:
     * self-registered leads have no phone on file (see
     * AuthController::register()), so there's no WhatsApp path to offer here.
     * Excludes already-converted leads: they're paying customers Mellow
     * Internal now owns the relationship with (see
     * InternalCustomerController), so a generic lead-nurture blast has no
     * business reaching them from here.
     */
    public function notifyLeads(array $leadIds, User $actor): int
    {
        $query = User::mellowDirectLeads()
            ->where('lead_status', '!=', User::LEAD_STATUS_CONVERTED)
            ->whereIn('id', $leadIds);

        if ($actor->role === User::ROLE_ADMIN_MARKETING) {
            $query->where('assigned_marketing_id', $actor->id);
        }

        $leads = $query->get();

        if ($leads->isEmpty()) {
            return 0;
        }

        Bus::batch(
            $leads->map(fn (User $lead) => new SendStudentBulkNotification($lead->id, SendStudentBulkNotification::TEMPLATE_GENERIC))->all()
        )->name('marketing-lead-notify-'.now()->timestamp)->dispatch();

        ActivityLog::record(
            $actor,
            "Emailed {$leads->count()} lead(s)",
            'User',
            null,
            ['lead_ids' => $leads->pluck('id')->all()]
        );

        return $leads->count();
    }
}
