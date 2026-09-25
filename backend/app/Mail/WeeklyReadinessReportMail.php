<?php

namespace App\Mail;

use App\Models\College;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Queue\SerializesModels;

/**
 * The weekly "students below 60% readiness" digest sent to a college's
 * TPO(s) — see WeeklyReadinessReportService, which builds $excelPath and is
 * responsible for deleting it once every recipient has been sent to.
 */
class WeeklyReadinessReportMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $tpo,
        public College $college,
        public int $atRiskCount,
        public string $excelPath,
    ) {}

    public function build(): self
    {
        return $this->subject("Weekly Readiness Report — {$this->atRiskCount} student(s) below 60% — {$this->college->name}")
            ->view('emails.weekly-readiness-report')
            ->attach(Attachment::fromPath($this->excelPath)
                ->as('at-risk-students-'.now()->toDateString().'.xlsx')
                ->withMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
    }
}
