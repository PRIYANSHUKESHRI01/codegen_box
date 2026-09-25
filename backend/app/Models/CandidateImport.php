<?php

namespace App\Models;

use Illuminate\Bus\Batch;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Bus;

/** Structural mirror of StudentImport, scoped to a job opening (placement_drive_id) instead of a college — see the migration's docblock for why. */
class CandidateImport extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_COMPLETED_WITH_ERRORS = 'completed_with_errors';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'placement_drive_id',
        'uploaded_by',
        'original_filename',
        'status',
        'total_rows',
        'processed_rows',
        'successful_rows',
        'failed_rows',
        'errors',
        'email_batch_id',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'errors' => 'array',
            'completed_at' => 'datetime',
        ];
    }

    public function placementDrive(): BelongsTo
    {
        return $this->belongsTo(PlacementDrive::class);
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function emailBatch(): ?Batch
    {
        return $this->email_batch_id ? Bus::findBatch($this->email_batch_id) : null;
    }
}
