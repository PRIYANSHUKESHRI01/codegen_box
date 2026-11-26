<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VoiceVerificationPrompt extends Model
{
    protected $fillable = [
        'position',
        'slug',
        'title',
        'category',
        'prompt_text',
        'guidance',
        'target_seconds',
        'min_seconds',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'target_seconds' => 'integer',
            'min_seconds' => 'integer',
            'is_active' => 'boolean',
        ];
    }
}
