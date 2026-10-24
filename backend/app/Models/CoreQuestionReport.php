<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A student saying "this question looks wrong". Reaches staff in Core Prep → Reports. */
class CoreQuestionReport extends Model
{
    public const REASONS = ['wrong_answer', 'unclear', 'typo', 'out_of_syllabus', 'other'];

    public const STATUS_OPEN = 'open';

    public const STATUS_RESOLVED = 'resolved';

    public const STATUS_DISMISSED = 'dismissed';

    protected $fillable = ['core_question_id', 'user_id', 'reason', 'note', 'status', 'resolved_by', 'resolved_at'];

    protected function casts(): array
    {
        return ['resolved_at' => 'datetime'];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(CoreQuestion::class, 'core_question_id');
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
