<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A branch family the product has a dashboard for (cse, ece, eee, mech, civil)
 * plus "other". Rows are the single source of truth for what the family is
 * called and whether its Core Prep is live. Read through
 * App\Support\BranchCatalog, not directly, wherever it runs per student.
 */
class Discipline extends Model
{
    public const CSE = 'cse';

    public const OTHER = 'other';

    protected $fillable = ['code', 'name', 'short', 'sort', 'is_live', 'live_at', 'department_code', 'capabilities'];

    protected function casts(): array
    {
        return [
            'is_live' => 'boolean',
            'live_at' => 'datetime',
            'sort' => 'integer',
            'capabilities' => 'array',
        ];
    }
}
