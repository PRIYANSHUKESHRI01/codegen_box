<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CoreTestQuestion extends Model
{
    protected $fillable = ['core_test_id', 'core_question_id', 'position', 'section'];

    public function test(): BelongsTo
    {
        return $this->belongsTo(CoreTest::class, 'core_test_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(CoreQuestion::class, 'core_question_id');
    }
}
