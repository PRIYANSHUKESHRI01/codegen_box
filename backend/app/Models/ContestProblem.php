<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ContestProblem extends Model
{
    protected $fillable = [
        'contest_id',
        'problem_id',
        'points',
        'display_order',
    ];

    protected function casts(): array
    {
        return [
            'points' => 'integer',
            'display_order' => 'integer',
        ];
    }

    public function contest(): BelongsTo
    {
        return $this->belongsTo(Contest::class);
    }

    public function problem(): BelongsTo
    {
        return $this->belongsTo(Problem::class);
    }

    public function contestSubmissions(): HasMany
    {
        return $this->hasMany(ContestSubmission::class);
    }
}
