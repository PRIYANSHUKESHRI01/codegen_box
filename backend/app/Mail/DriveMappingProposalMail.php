<?php

namespace App\Mail;

use App\Models\DriveCollegeMapping;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Sent to every TPO at a college when Mellow proposes mapping a published
 * drive to them — carries the full drive detail so a TPO can decide without
 * having to log in first, plus a CTA back to the dashboard's Pending
 * Approvals tab to actually approve/decline it (see TpoDriveController::
 * pending()/respond()). One of these per TPO recipient — see
 * SendDriveMappingProposalEmail, the queued unit that dispatches it.
 */
class DriveMappingProposalMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $tpo,
        public DriveCollegeMapping $mapping,
    ) {}

    public function build(): self
    {
        $company = $this->mapping->placementDrive->company;

        return $this->subject("New Placement Drive Proposal — {$company->name}")
            ->view('emails.drive-mapping-proposal');
    }
}
