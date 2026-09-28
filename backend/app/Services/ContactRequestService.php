<?php

namespace App\Services;

use App\Jobs\SendContactRequestConfirmation;
use App\Jobs\SendContactRequestNotification;
use App\Models\ActivityLog;
use App\Models\ContactRequest;
use App\Models\ContactRequestNote;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * The one write path for "Talk to Our Team" contact requests — mirrors
 * MarketingLeadService's "one focused service per concern" shape in this
 * codebase, for the ContactRequest side of the lead pipeline instead of the
 * User-based one.
 */
class ContactRequestService
{
    public function __construct(private readonly LeadAssignmentService $assignment) {}

    /**
     * The public form's entry point: create the row, hand it to a marketing
     * employee (least-loaded, same formula as a Mellow Direct lead), and
     * fire both the assigned employee's notification and the submitter's
     * confirmation. The confirmation always sends, even if nobody was
     * available to assign yet — the submitter shouldn't see any difference
     * in that case; the request just sits unassigned until the next
     * marketing hire triggers the backlog sweep (see
     * LeadAssignmentService::assignUnassignedContactRequests()).
     */
    public function submit(array $data): ContactRequest
    {
        $contactRequest = ContactRequest::create($data);

        $this->assignment->assignContactRequest($contactRequest);

        if ($contactRequest->assigned_marketing_id !== null) {
            SendContactRequestNotification::dispatch($contactRequest->id);
        }

        SendContactRequestConfirmation::dispatch($contactRequest->id);

        return $contactRequest;
    }

    public function updateStatus(ContactRequest $contactRequest, string $status, User $actor): ContactRequest
    {
        if (! in_array($status, User::LEAD_STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => ['That is not a valid status.'],
            ]);
        }

        $attributes = ['status' => $status];

        if ($status === User::LEAD_STATUS_CONVERTED && $contactRequest->converted_at === null) {
            $attributes['converted_at'] = now();
        }

        $contactRequest->forceFill($attributes)->save();

        ActivityLog::record(
            $actor,
            "Updated contact request status to \"{$status}\"",
            'ContactRequest',
            $contactRequest->name,
            ['contact_request_id' => $contactRequest->id]
        );

        return $contactRequest->fresh();
    }

    public function addNote(ContactRequest $contactRequest, string $note, User $actor): ContactRequestNote
    {
        return ContactRequestNote::create([
            'contact_request_id' => $contactRequest->id,
            'author_id' => $actor->id,
            'note' => $note,
        ]);
    }
}
