<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Maps Mellow Vault's `higher_professional_tb.id` (`pro_id`) and heading to AptRun's
 * curated Vault AI Interview stack key so synced developers land straight on their track.
 */
class MellowVaultStackMapping extends Model
{
    protected $fillable = [
        'pro_id',
        'higher_professional_heading',
        'aptrun_stack_key',
        'aptrun_role_key',
        'display_name',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'pro_id' => 'integer',
            'is_active' => 'boolean',
        ];
    }
}
