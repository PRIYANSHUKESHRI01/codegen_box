<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A spelling that means a branch. `college_id` 0 = recognised everywhere; a
 * college id = that TPO's own mapping, which only ever applies to its own
 * students (and wins over the global list). `department_code` '' = the spelling means the same everywhere; a department
 * code = it only means this inside that department ("Finance" in a Management import vs a Commerce one).
 */
class BranchAlias extends Model
{
    public const GLOBAL_SCOPE = 0;

    protected $fillable = ['alias_key', 'branch_code', 'college_id', 'department_code', 'label', 'created_by'];

    protected function casts(): array
    {
        return ['college_id' => 'integer'];
    }
}
