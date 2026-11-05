<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Who won which voucher in a finished week, and whether it has been sent. See the weekly_reward_winners migration. */
class WeeklyRewardWinner extends Model
{
    public const PENDING = 'pending';

    public const SENT = 'sent';

    public const CANCELLED = 'cancelled';

    public const STATUSES = [self::PENDING, self::SENT, self::CANCELLED];

    protected $fillable = [
        'week_key', 'rank', 'user_id', 'user_name', 'user_handle', 'email', 'college', 'contest_score', 'card', 'brand', 'amount',
        'status', 'voucher_code', 'note', 'sent_at', 'handled_by', 'notified_at',
    ];

    protected $hidden = ['voucher_code'];

    protected function casts(): array
    {
        return [
            'week_key' => 'date:Y-m-d',
            'voucher_code' => 'encrypted',
            'sent_at' => 'datetime',
            'notified_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
