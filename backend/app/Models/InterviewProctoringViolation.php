<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Mirrors ProctoringViolation — see App\Models\ProctoringViolation for the type-by-type rationale, identical here. */
class InterviewProctoringViolation extends Model
{
    public const TYPE_FULLSCREEN_EXIT = 'fullscreen_exit';

    public const TYPE_TAB_SWITCH = 'tab_switch';

    public const TYPE_DEVTOOLS_DETECTED = 'devtools_detected';

    public const TYPE_PASTE_ATTEMPT = 'paste_attempt';

    public const TYPE_WINDOW_BLUR = 'window_blur';

    public const TYPE_CONTEXT_MENU_BLOCKED = 'context_menu_blocked';

    public const TYPE_TAB_CLOSE_ATTEMPT = 'tab_close_attempt';

    public const STRIKE_TYPES = [
        self::TYPE_FULLSCREEN_EXIT,
        self::TYPE_TAB_SWITCH,
        self::TYPE_DEVTOOLS_DETECTED,
    ];

    public const TYPES = [
        self::TYPE_FULLSCREEN_EXIT,
        self::TYPE_TAB_SWITCH,
        self::TYPE_DEVTOOLS_DETECTED,
        self::TYPE_PASTE_ATTEMPT,
        self::TYPE_WINDOW_BLUR,
        self::TYPE_CONTEXT_MENU_BLOCKED,
        self::TYPE_TAB_CLOSE_ATTEMPT,
    ];

    protected $fillable = [
        'interview_proctoring_session_id',
        'interview_question_id',
        'type',
        'counted_toward_lock',
        'ip_address',
        'meta',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'counted_toward_lock' => 'boolean',
            'meta' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(InterviewProctoringSession::class, 'interview_proctoring_session_id');
    }

    public function interviewQuestion(): BelongsTo
    {
        return $this->belongsTo(InterviewQuestion::class);
    }

    public static function isStrikeType(string $type): bool
    {
        return in_array($type, self::STRIKE_TYPES, true);
    }

    public static function label(string $type): string
    {
        return match ($type) {
            self::TYPE_FULLSCREEN_EXIT => 'Exited fullscreen',
            self::TYPE_TAB_SWITCH => 'Switched tab / window',
            self::TYPE_DEVTOOLS_DETECTED => 'Developer tools opened',
            self::TYPE_PASTE_ATTEMPT => 'Attempted to paste',
            self::TYPE_WINDOW_BLUR => 'Window lost focus',
            self::TYPE_CONTEXT_MENU_BLOCKED => 'Right-click blocked',
            self::TYPE_TAB_CLOSE_ATTEMPT => 'Attempted to close or navigate away',
            default => $type,
        };
    }
}
