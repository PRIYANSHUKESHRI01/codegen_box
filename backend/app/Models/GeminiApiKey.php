<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Represents a Gemini API Key in the rotating pool.
 * Supports time-of-day scheduled rotation (e.g. 0-4h, 4-8h, etc. repeating every 24 hours),
 * dynamic duration adjustment, and automatic quota/rate-limit fallback.
 */
class GeminiApiKey extends Model
{
    protected $fillable = [
        'label',
        'api_key',
        'order_index',
        'duration_hours',
        'is_active',
        'is_exhausted',
        'exhausted_until',
        'last_used_at',
        'last_error_at',
        'last_error_message',
        'total_requests',
        'successful_requests',
        'failed_requests',
    ];

    protected function casts(): array
    {
        return [
            'order_index' => 'integer',
            'duration_hours' => 'float',
            'is_active' => 'boolean',
            'is_exhausted' => 'boolean',
            'exhausted_until' => 'datetime',
            'last_used_at' => 'datetime',
            'last_error_at' => 'datetime',
            'total_requests' => 'integer',
            'successful_requests' => 'integer',
            'failed_requests' => 'integer',
        ];
    }

    public function getMaskedKeyAttribute(): string
    {
        $raw = trim((string) $this->api_key);
        if ($raw === '') {
            return '';
        }
        $len = strlen($raw);
        if ($len <= 10) {
            return substr($raw, 0, 3) . '***' . substr($raw, -2);
        }
        return substr($raw, 0, 7) . '...' . substr($raw, -5);
    }

    public function hasKey(): bool
    {
        return ! empty(trim((string) $this->api_key));
    }

    public function isAvailable(): bool
    {
        if (! $this->is_active || ! $this->hasKey()) {
            return false;
        }

        if ($this->is_exhausted) {
            if ($this->exhausted_until !== null && $this->exhausted_until->isPast()) {
                // Period expired, auto-recovered!
                return true;
            }
            return false;
        }

        return true;
    }
}
