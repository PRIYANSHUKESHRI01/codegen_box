<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One specific branch ("mech", "cse_aiml") and the discipline family it belongs to. */
class Branch extends Model
{
    protected $fillable = ['code', 'discipline_code', 'name', 'short', 'sort', 'is_active', 'capabilities'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sort' => 'integer',
            'capabilities' => 'array',
        ];
    }
}
