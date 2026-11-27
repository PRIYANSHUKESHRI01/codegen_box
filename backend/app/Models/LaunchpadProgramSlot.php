<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LaunchpadProgramSlot extends Model
{
    protected $fillable = [
        'launchpad_program_id',
        'assessment_number',
        'set_number',
        'college_assessment_id',
    ];

    protected function casts(): array
    {
        return [
            'assessment_number' => 'integer',
            'set_number' => 'integer',
        ];
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(LaunchpadProgram::class, 'launchpad_program_id');
    }

    public function assessment(): BelongsTo
    {
        return $this->belongsTo(CollegeAssessment::class, 'college_assessment_id');
    }
}
