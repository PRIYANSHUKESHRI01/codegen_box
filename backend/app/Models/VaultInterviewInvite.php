<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Tracks Vault AI Interview email invitations dispatched once a synced Mellow Vault
 * developer hits 90%+ profile completion (`developer_details_tb.profile_complete`).
 */
class VaultInterviewInvite extends Model
{
    public const STATUS_QUEUED = 'queued';

    public const STATUS_SENT = 'sent';

    public const STATUS_OPENED = 'opened';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'user_id',
        'dev_id',
        'pro_id',
        'profile_percent',
        'stack_key',
        'stack_name',
        'invite_url',
        'status',
        'error_message',
        'sent_at',
        'opened_at',
    ];

    protected function casts(): array
    {
        return [
            'dev_id' => 'integer',
            'pro_id' => 'integer',
            'profile_percent' => 'integer',
            'sent_at' => 'datetime',
            'opened_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
