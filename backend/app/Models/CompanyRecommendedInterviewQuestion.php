<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Mirrors CompanyRecommendedProblem — which bank questions Ops has tagged
 * as relevant to a specific company, enforced for `company`-type interviews
 * only (see AdminInterviewController::storeQuestion()).
 */
class CompanyRecommendedInterviewQuestion extends Model
{
    protected $fillable = [
        'company_id',
        'interview_question_bank_id',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function questionBank(): BelongsTo
    {
        return $this->belongsTo(InterviewQuestionBank::class, 'interview_question_bank_id');
    }
}
