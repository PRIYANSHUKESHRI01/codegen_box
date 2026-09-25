<?php

namespace App\Models;

use App\Models\Concerns\HasSubscription;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class College extends Model
{
    use HasFactory, HasSubscription;

    protected $fillable = [
        'name',
        'short_code',
        'city',
        'state',
        'tier',
        'placement_rate',
        'is_active',
        'placement_target_percent',
        'placement_target_deadline',
    ];

    protected function casts(): array
    {
        return [
            'placement_rate' => 'decimal:2',
            'is_active' => 'boolean',
            'placement_target_percent' => 'decimal:2',
            'placement_target_deadline' => 'date',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function tpoAdmins(): HasMany
    {
        return $this->hasMany(User::class)->where('role', User::ROLE_ADMIN_TPO);
    }

    public function driveApplications(): HasMany
    {
        return $this->hasMany(DriveApplication::class);
    }
}
