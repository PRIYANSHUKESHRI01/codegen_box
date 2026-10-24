<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** "This college runs this department." A college with no rows is engineering-only — see College::departmentCodes(). */
class CollegeDepartment extends Model
{
    protected $fillable = ['college_id', 'department_code', 'enabled_by'];

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }
}
