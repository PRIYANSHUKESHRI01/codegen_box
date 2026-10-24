<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Who changed a Core Prep question, how, and why — the record that makes a key fix defensible. */
class CoreQuestionAudit extends Model
{
    protected $fillable = ['core_question_id', 'user_id', 'action', 'changes', 'note'];

    protected function casts(): array
    {
        return ['changes' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
