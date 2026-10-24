<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * "This college's students of this branch family get Core Prep before it is live for everyone."
 * Read through App\Support\BranchCatalog wherever it runs per student.
 */
class DisciplinePilot extends Model
{
    protected $fillable = ['discipline_code', 'college_id', 'added_by'];

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }
}
