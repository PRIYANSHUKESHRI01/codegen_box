<?php

namespace App\Models;

use Illuminate\Bus\Batch;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Bus;

class StudentImport extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_COMPLETED_WITH_ERRORS = 'completed_with_errors';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'college_id',
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

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /**
     * The live progress of the welcome-email fan-out, straight from
     * Laravel's job_batches table — null until the row-processing pass has
     * finished and actually dispatched the batch.
     */
    public function emailBatch(): ?Batch
    {
        return $this->email_batch_id ? Bus::findBatch($this->email_batch_id) : null;
    }
}
