<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One bulk-import run: a dry-run report, or a committed upsert. */
class CoreQuestionImport extends Model
{
    public const MODE_DRY_RUN = 'dry_run';

    public const MODE_COMMIT = 'commit';

    public const STATUS_PENDING = 'pending';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_CHECKED = 'checked';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_COMPLETED_WITH_ERRORS = 'completed_with_errors';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'user_id', 'original_filename', 'file_path', 'images_path', 'mode', 'status', 'total_rows', 'valid_rows',
        'created_rows', 'updated_rows', 'failed_rows', 'errors', 'summary', 'options',
    ];

    protected function casts(): array
    {
        return ['errors' => 'array', 'summary' => 'array', 'options' => 'array'];
    }
}
