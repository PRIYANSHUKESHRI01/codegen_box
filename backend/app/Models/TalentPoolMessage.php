<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A free-text note/outreach message on a TalentPoolInquiry thread — mirrors LeadNote's shape. No `updated_at` (see the creating migration): a sent message is never edited. */
class TalentPoolMessage extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'talent_pool_inquiry_id',
        'sender_id',
        'message',
    ];

    public function inquiry(): BelongsTo
    {
        return $this->belongsTo(TalentPoolInquiry::class, 'talent_pool_inquiry_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }
}
