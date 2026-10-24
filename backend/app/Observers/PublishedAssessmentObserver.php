<?php

namespace App\Observers;

use App\Services\Notifications\AssessmentNotifier;
use Illuminate\Database\Eloquent\Model;

/**
 * One observer for every scheduled-assessment model (Contest, Interview, SoftSkillAssessment, CoreTest, InterviewTrack): they
 * all share the draft → published → cancelled lifecycle, and the moment one turns `published` is the moment students
 * should hear about it. Who is told, and which kinds are announced at all, is AssessmentNotifier's decision.
 */
class PublishedAssessmentObserver
{
    public function __construct(private readonly AssessmentNotifier $notifier) {}

    public function saved(Model $assessment): void
    {
        if ($assessment->status !== 'published') {
            return;
        }

        if ($assessment->wasRecentlyCreated || $assessment->wasChanged('status')) {
            $this->notifier->published($assessment);
        }
    }
}
