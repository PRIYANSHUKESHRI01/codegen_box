<?php

namespace App\Models;

use App\Models\Concerns\HasSubscription;
use App\Support\BranchCatalog;
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
        'exam_networks',
    ];

    /** The relation is exposed through the `departments` codes below, never as raw rows. */
    protected $hidden = ['collegeDepartments'];

    /** Null unless `collegeDepartments` was eager loaded (see departments()): serialising a list of colleges must not cost a query each. */
    protected $appends = ['departments'];

    protected function casts(): array
    {
        return [
            'placement_rate' => 'decimal:2',
            'is_active' => 'boolean',
            'placement_target_percent' => 'decimal:2',
            'placement_target_deadline' => 'date',
            'exam_networks' => 'array',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function collegeDepartments(): HasMany
    {
        return $this->hasMany(CollegeDepartment::class);
    }

    /**
     * The departments this college runs, in catalogue order. A college with no rows (created before departments existed,
     * or by code that never enabled one) is engineering-only — the product it has always been — so nothing depends on
     * every college having been backfilled.
     *
     * @return list<string>
     */
    public function departmentCodes(): array
    {
        $enabled = $this->relationLoaded('collegeDepartments')
            ? $this->collegeDepartments->pluck('department_code')->all()
            : $this->collegeDepartments()->pluck('department_code')->all();

        if ($enabled === []) {
            return [config('departments.fallback', Department::ENGINEERING)];
        }

        $order = array_flip(array_column(BranchCatalog::instance()->departments(activeOnly: false), 'code'));
        usort($enabled, fn (string $a, string $b) => ($order[$a] ?? 999) <=> ($order[$b] ?? 999));

        return array_values($enabled);
    }

    /** Serialized as `departments`: the codes this college runs, or null when the relation was not loaded (callers then assume engineering). */
    protected function getDepartmentsAttribute(): ?array
    {
        return $this->relationLoaded('collegeDepartments') ? $this->departmentCodes() : null;
    }

    public function runsDepartment(?string $code): bool
    {
        return $code !== null && in_array($code, $this->departmentCodes(), true);
    }

    public function tpoAdmins(): HasMany
    {
        return $this->hasMany(User::class)->where('role', User::ROLE_ADMIN_TPO);
    }

    public function driveApplications(): HasMany
    {
        return $this->hasMany(DriveApplication::class);
    }

    /**
     * The plan actually governing this college right now, or null if it has
     * no active subscription. `activeSubscription()` only filters on
     * `status`, not on whether `current_period_end` has actually passed
     * (see its own docblock) — this is the one place on College that does
     * the full `isActive()` check, mirroring User::effectiveSubscription().
     */
    public function activePlan(): ?Plan
    {
        $subscription = $this->activeSubscription();

        return ($subscription !== null && $subscription->isActive()) ? $subscription->plan : null;
    }

    /**
     * Whether this college is currently entitled to add/import students at
     * all. Deliberately a separate method from `studentLimit() === null`,
     * which means something different ("active, but an unlimited-seat
     * plan") — every seat-cap enforcement call site must check this FIRST,
     * because a null limit from a plan that simply doesn't exist (no active
     * subscription) must block, not allow unlimited imports.
     */
    public function hasActiveSubscription(): bool
    {
        $subscription = $this->activeSubscription();

        return $subscription !== null && $subscription->isActive();
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
