<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A still image (webcam or screen) the browser sent as proof. The bytes live on a private disk, encrypted — see EvidenceVault. */
class IntegrityEvidence extends Model
{
    protected $table = 'integrity_evidence';

    public const KIND_WEBCAM = 'webcam';

    public const KIND_SCREEN = 'screen';

    public const KINDS = [self::KIND_WEBCAM, self::KIND_SCREEN];

    protected $fillable = ['integrity_session_id', 'kind', 'disk', 'path', 'bytes', 'sha256', 'encrypted', 'captured_at', 'meta', 'flagged', 'reason'];

    protected function casts(): array
    {
        return [
            'bytes' => 'integer',
            'encrypted' => 'boolean',
            'flagged' => 'boolean',
            'captured_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(IntegritySession::class, 'integrity_session_id');
    }
}
