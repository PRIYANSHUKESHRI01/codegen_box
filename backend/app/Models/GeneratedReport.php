<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * One stored report — see the generated_reports migration. Always create and read these through
 * App\Services\Reports\ReportArchive, which also owns the file on disk.
 */
class GeneratedReport extends Model
{
    public const KIND_STUDENT = 'student_report';

    public const KIND_INTERVIEW = 'interview_report';

    public const KIND_INTERVIEW_SESSION = 'interview_session_report';

    public const KIND_SECTION = 'section_report';

    /** A student's Vault AI Interview report (final average of the three sets, best series, attempts). One per student and stack. */
    public const KIND_VAULT_AI = 'vault_ai_report';

    public const KINDS = [self::KIND_STUDENT, self::KIND_INTERVIEW, self::KIND_INTERVIEW_SESSION, self::KIND_SECTION, self::KIND_VAULT_AI];

    public const AUDIENCE_STAFF = 'staff';

    public const AUDIENCE_STUDENT = 'student';

    protected $fillable = [
        'public_id', 'kind', 'title', 'filename', 'college_id', 'subject_user_id', 'interview_id', 'interview_session_id',
        'generated_by', 'generated_by_role', 'audience', 'disk', 'path', 'size_bytes', 'sha256', 'pages', 'params', 'summary',
        'downloads', 'last_downloaded_at',
    ];

    protected $hidden = ['disk', 'path', 'sha256'];

    protected function casts(): array
    {
        return [
            'params' => 'array',
            'summary' => 'array',
            'size_bytes' => 'integer',
            'pages' => 'integer',
            'downloads' => 'integer',
            'last_downloaded_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (GeneratedReport $report) {
            $report->public_id ??= (string) Str::ulid();
        });
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(User::class, 'subject_user_id');
    }

    public function generator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }

    public function interview(): BelongsTo
    {
        return $this->belongsTo(Interview::class);
    }

    /** The row as every list and detail screen shows it — never the disk path or checksum. */
    public function present(): array
    {
        return [
            'id' => $this->public_id,
            'kind' => $this->kind,
            'title' => $this->title,
            'filename' => $this->filename,
            'audience' => $this->audience,
            'size_bytes' => $this->size_bytes,
            'pages' => $this->pages,
            'summary' => $this->summary ?? new \stdClass,
            'student' => $this->relationLoaded('subject') && $this->subject ? [
                'id' => $this->subject->id, 'name' => $this->subject->name, 'roll_number' => $this->subject->roll_number,
                'section' => $this->subject->section, 'branch' => $this->subject->branch,
            ] : null,
            'interview' => $this->relationLoaded('interview') && $this->interview ? ['slug' => $this->interview->slug, 'title' => $this->interview->title] : null,
            'generated_by' => $this->relationLoaded('generator') && $this->generator
                ? ['name' => $this->generator->name, 'role' => $this->generated_by_role]
                : ($this->generated_by_role ? ['name' => null, 'role' => $this->generated_by_role] : null),
            'downloads' => $this->downloads,
            'last_downloaded_at' => $this->last_downloaded_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
