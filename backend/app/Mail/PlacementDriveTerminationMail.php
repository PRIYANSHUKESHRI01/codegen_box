<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * The second placeholder template offered in the TPO's bulk-notify flow —
 * a formal-toned warning for a student well below the readiness threshold.
 * Same "placeholder, not final copy" honesty as StudentBulkNotificationMail:
 * this does NOT actually revoke drive access anywhere (no per-student,
 * per-drive application/participation table exists in this schema to
 * revoke), it is purely the notification a TPO can choose to send.
 */
class PlacementDriveTerminationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public User $user) {}

    public function build(): self
    {
        return $this->subject('Action Required: Placement Drive Eligibility Notice — '.($this->user->college?->name ?? 'CodeGen Box'))
            ->view('emails.placement-drive-termination');
    }
}
