<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * The student's browser VS Code environment for one enrollment: a container on
 * one workspace host plus a named volume holding /home/workspace. The row is
 * the control plane's record of it; the container itself is cattle (stopped
 * when idle, recreated on demand) while the volume — the student's code — is
 * the thing that persists.
 *
 * `public_id` is the unguessable part of the workspace hostname, and
 * `connection_token` (encrypted, rotated on every start) is what the editor
 * itself demands — together they are the access control, handed only to the
 * entitled owner.
 */
class ProjectWorkspace extends Model
{
    /** The container is being created / the editor is booting. */
    public const STATUS_STARTING = 'starting';

    public const STATUS_RUNNING = 'running';

    /** No container; only the volume exists. Also the state of a workspace that was provisioned but never started. */
    public const STATUS_STOPPED = 'stopped';

    public const STATUS_FAILED = 'failed';

    public const STATUS_DESTROYED = 'destroyed';

    /** Statuses in which a container exists and is consuming host resources. */
    public const LIVE = [self::STATUS_STARTING, self::STATUS_RUNNING];

    public const STOP_USER = 'user';

    /** Stopped because the project was handed in: the snapshot is taken, so there is nothing left to build (and no reason to keep spending hours). */
    public const STOP_SUBMITTED = 'submitted';

    public const STOP_IDLE = 'idle';

    public const STOP_MAX_SESSION = 'max_session';

    public const STOP_LAPSED = 'lapsed';

    public const STOP_HOURS_EXHAUSTED = 'hours_exhausted';

    public const STOP_DISK_FULL = 'disk_full';

    public const STOP_HOST_ERROR = 'host_error';

    protected $fillable = [
        'public_id',
        'project_enrollment_id',
        'user_id',
        'host',
        'container_name',
        'volume_name',
        'status',
        'connection_token',
        'last_heartbeat_at',
        'guard_last_seen_at',
        'guard_version',
        'last_started_at',
        'last_stopped_at',
        'stop_reason',
        'error',
        'disk_mb',
    ];

    /** Never serialised: the token is delivered through one deliberate field, not by accident of toArray(). */
    protected $hidden = ['connection_token'];

    protected function casts(): array
    {
        return [
            'connection_token' => 'encrypted',
            'last_heartbeat_at' => 'datetime',
            'guard_last_seen_at' => 'datetime',
            'last_started_at' => 'datetime',
            'last_stopped_at' => 'datetime',
            'disk_mb' => 'integer',
        ];
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(ProjectEnrollment::class, 'project_enrollment_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(ProjectWorkspaceSession::class);
    }

    public function integrityEvents(): HasMany
    {
        return $this->hasMany(ProjectWorkspaceIntegrityEvent::class);
    }

    public function isLive(): bool
    {
        return in_array($this->status, self::LIVE, true);
    }

    /** The Docker-network hostname / subdomain label: ws-<public_id>. */
    public function hostLabel(): string
    {
        return 'ws-'.$this->public_id;
    }

    /** 24 chars of [a-z0-9]: 36^24 possibilities, far past guessable, and a valid DNS label with its "ws-" prefix. */
    public static function newPublicId(): string
    {
        return Str::lower(Str::random(24));
    }
}
