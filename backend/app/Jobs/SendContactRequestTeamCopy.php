<?php

namespace App\Jobs;

use App\Mail\ContactRequestNotificationMail;
use App\Models\ContactRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/**
 * A copy of every "Talk to Our Team" enquiry to the marketing team's shared inbox (config brand.enquiry_email / MARKETING_ENQUIRY_EMAIL),
 * sent whether or not an employee has been given it — so an enquiry that arrives while nobody is hired, or everybody is blocked, still
 * lands somewhere a person reads. Does nothing when no inbox is configured, or when it is the very address the assigned employee already
 * received the notification on (one mail, not two). Replying to it replies to the enquirer (Reply-To).
 */
class SendContactRequestTeamCopy implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(public int $contactRequestId) {}

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(): void
    {
        $inbox = trim((string) config('brand.enquiry_email'));
        $request = ContactRequest::with('assignedMarketing')->find($this->contactRequestId);

        if ($inbox === '' || ! $request) {
            return;
        }

        if ($request->assignedMarketing && strcasecmp($request->assignedMarketing->email, $inbox) === 0) {
            return;
        }

        \Illuminate\Support\Facades\Mail::to($inbox)->send(new ContactRequestNotificationMail($request, forTeam: true));
    }
}
