<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanyRecommendedProblem extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'problem_slug',
        'topic_tag',
        'priority',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
