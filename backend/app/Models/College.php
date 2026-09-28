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

    /** The plan actually governing this college right now, or null if it has no active subscription. */
    public function activePlan(): ?Plan
    {
        return $this->activeSubscription()?->plan;
    }

    /** Student headcount counted against the plan's seat cap — TPOs/coordinators don't consume a seat. */
    public function studentCount(): int
    {
        return $this->users()->where('role', User::ROLE_USER)->count();
    }

    /** Null means unlimited — see 2026_09_28_010000_add_max_students_to_plans_table's docblock. */
    public function studentLimit(): ?int
    {
        return $this->activePlan()?->max_students;
    }
}
