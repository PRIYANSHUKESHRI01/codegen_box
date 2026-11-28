<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Full security telemetry record for every superadmin authentication event
 * (login, failed attempt, blocked attempt, trusted device/IP rejection, logout, password change).
 */
class SuperadminLoginLog extends Model
{
    public const EVENT_LOGIN = 'login';

    public const EVENT_LOGIN_FAILED = 'login_failed';

    public const EVENT_LOGIN_BLOCKED = 'login_blocked';

    public const EVENT_LOGIN_REJECTED_DEVICE_IP = 'login_rejected_device_ip';

    public const EVENT_LOGOUT = 'logout';

    public const EVENT_PASSWORD_CHANGED = 'password_changed';

    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'email',
        'event',
        'reason',
        'portal',
        'token_id',
        'ip_address',
        'forwarded_for',
        'is_private_ip',
        'hostname',
        'isp',
        'asn',
        'network_org',
        'city',
        'region',
        'country',
        'country_code',
        'network_type',
        'effective_type',
        'downlink_mbps',
        'rtt_ms',
        'device_fingerprint',
        'device_id',
        'device_type',
        'device_label',
        'os',
        'os_version',
        'browser',
        'browser_version',
        'platform',
        'architecture',
        'cpu_cores',
        'device_memory_gb',
        'gpu_vendor',
        'gpu_renderer',
        'screen_resolution',
        'timezone',
        'language',
        'user_agent',
        'client_hints',
        'raw_telemetry',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'is_private_ip' => 'boolean',
            'downlink_mbps' => 'float',
            'rtt_ms' => 'integer',
            'cpu_cores' => 'integer',
            'device_memory_gb' => 'float',
            'client_hints' => 'array',
            'raw_telemetry' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
