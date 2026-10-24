<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A topic inside a subject ("Feedback amplifiers"). */
class CoreTopic extends Model
{
    protected $fillable = ['subject_id', 'code', 'name', 'sort', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'sort' => 'integer'];
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(CoreSubject::class, 'subject_id');
    }
}
