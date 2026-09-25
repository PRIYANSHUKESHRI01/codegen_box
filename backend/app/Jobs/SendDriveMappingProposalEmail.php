<?php

namespace App\Jobs;

use App\Mail\DriveMappingProposalMail;
use App\Models\DriveCollegeMapping;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Mail;

/**
 * Emails every TPO at the mapping's college the full drive detail, once the
 * mapping has been created as `pending` by AdminPlacementDriveController::
 * mapColleges(). Skips silently if the mapping is no longer pending by the
 * time this runs (a TPO already responded, or Mellow re-proposed and the
 * row moved on) — same idempotency guard convention as
 * SendAccountCredentialsEmail's credentials_email_sent_at check.
 */
class SendDriveMappingProposalEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(public int $mappingId) {}

    /** Exponential-ish backoff: transient SMTP/API hiccups get a moment to clear before retrying. */
    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function middleware(): array
    {
        return [new RateLimited('transactional-emails')];
    }

    public function handle(): void
    {
        $mapping = DriveCollegeMapping::with('placementDrive.company', 'college.tpoAdmins', 'mappedBy')->find($this->mappingId);

        if (! $mapping || ! $mapping->isPending()) {
            return;
        }

        foreach ($mapping->college->tpoAdmins as $tpo) {
            Mail::to($tpo->email)->send(new DriveMappingProposalMail($tpo, $mapping));
        }
    }
}
