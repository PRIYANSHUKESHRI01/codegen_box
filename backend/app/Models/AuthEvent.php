<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A sign-in attempt or password event, including the ones that failed. See the auth_events migration; written by AuthEventRecorder. */
class AuthEvent extends Model
{
    public const LOGIN = 'login';

    public const LOGIN_FAILED = 'login_failed';

    public const LOGIN_BLOCKED = 'login_blocked';

    /** The right one-time password was typed: the person opened the login they were given. */
    public const TEMP_PASSWORD = 'temp_password';

    /** A one-time code was asked for (the step between the temporary password and choosing one's own). */
    public const OTP_REQUESTED = 'otp_requested';

    /** The owner chose their first password: the account is theirs now. */
    public const PASSWORD_SET = 'password_set';

    public const PASSWORD_CHANGED = 'password_changed';

    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'college_id', 'role', 'email', 'event', 'reason', 'portal', 'device', 'browser', 'os', 'ip', 'created_at'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
