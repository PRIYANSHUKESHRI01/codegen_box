<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AptBotFaq extends Model
{
    use HasFactory;

    protected $table = 'apt_bot_faqs';

    protected $fillable = [
        'category',
        'category_label',
        'category_icon',
        'question',
        'slug',
        'answer',
        'action_label',
        'action_url',
        'related_slugs',
        'display_order',
        'is_active',
    ];

    protected $casts = [
        'related_slugs' => 'array',
        'display_order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
