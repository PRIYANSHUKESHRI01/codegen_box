<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A department a college can run (Engineering & Technology, Management & Business Administration, Commerce &
 * Accounting, Arts/Humanities & Social Sciences …). The level above disciplines and branches. Rows are the single
 * source of truth for the department's name and for which modules its students see (`capabilities`, a sparse
 * {capability: bool} map over config/departments.php). Read through App\Support\BranchCatalog wherever it runs per
 * student — never query this table per request.
 */
class Department extends Model
{
    public const ENGINEERING = 'engineering';

    protected $fillable = ['code', 'name', 'short', 'description', 'icon', 'accent', 'sort', 'is_active', 'capabilities', 'settings'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sort' => 'integer',
            'capabilities' => 'array',
            'settings' => 'array',
        ];
    }
}
