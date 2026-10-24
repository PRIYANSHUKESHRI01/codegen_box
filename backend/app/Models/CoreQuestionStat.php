<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** What students' answers say about one Core question — see the creating migration. Written only by CoreItemAnalysisService. */
class CoreQuestionStat extends Model
{
    public const FLAG_TOO_EASY = 'too_easy';

    public const FLAG_TOO_HARD = 'too_hard';

    public const FLAG_LOW_DISCRIMINATION = 'low_discrimination';

    public const FLAG_NEGATIVE_DISCRIMINATION = 'negative_discrimination';

    public const FLAG_SUSPECTED_KEY = 'suspected_key';

    protected $fillable = [
        'core_question_id', 'test_attempts', 'facility', 'discrimination', 'practice_attempts', 'practice_facility',
        'flags', 'flagged', 'suspect_option', 'computed_at',
    ];

    protected function casts(): array
    {
        return [
            'test_attempts' => 'integer',
            'facility' => 'float',
            'discrimination' => 'float',
            'practice_attempts' => 'integer',
            'practice_facility' => 'float',
            'flags' => 'array',
            'flagged' => 'boolean',
            'computed_at' => 'datetime',
        ];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(CoreQuestion::class, 'core_question_id');
    }
}
