<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * The one-time welcome email carrying a newly-created account's login
 * credentials — reused across every "someone else provisioned this account"
 * path (TPO adds/imports a student, Mellow onboards a college's TPO, Mellow
 * staff adds a student directly, superadmin creates staff/TPO/student), not
 * just students, hence the role-branched copy in the view. Deliberately a
 * plain Mailable (not itself queued) — the caller (SendAccountCredentialsEmail)
 * is the queued, retryable, rate-limited unit; double-queueing here would
 * just add a redundant layer.
 */
class AccountCredentialsMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $plainPassword,
    ) {}

    public function build(): self
    {
        $subject = 'Your AptRun account is ready';

        if ($this->user->college) {
            $subject .= " — {$this->user->college->name}";
        }

        return $this->subject($subject)->view('emails.account-credentials');
    }
}
