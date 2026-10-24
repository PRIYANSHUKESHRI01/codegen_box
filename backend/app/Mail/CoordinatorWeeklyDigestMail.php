<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Monday morning, one e-mail to each Section Coordinator: how their section is doing and the handful of students most
 * worth a conversation this week (see CoordinatorDigestService). The numbers are the dashboard's own, so the e-mail and the
 * page never disagree.
 */
class CoordinatorWeeklyDigestMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  array<string, mixed>  $summary  CoordinatorOverviewService::summary()
     * @param  list<array<string, mixed>>  $attention  the top of CoordinatorOverviewService::attention()
     */
    public function __construct(
        public User $coordinator,
        public string $collegeName,
        public string $scopeLabel,
        public array $summary,
        public array $attention,
    ) {}

    public function build(): self
    {
        $needs = count($this->attention);
        $subject = $needs > 0
            ? "Section {$this->coordinator->section}: {$needs} student".($needs === 1 ? '' : 's').' to follow up this week'
            : "Section {$this->coordinator->section}: nobody needs chasing this week";

        return $this->subject($subject)->view('emails.coordinator-weekly-digest');
    }
}
