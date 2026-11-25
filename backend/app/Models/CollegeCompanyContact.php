<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CollegeCompanyContact extends Model
{
    public const STATUS_ACTIVE = 'active';
    public const STATUS_WARM = 'warm';
    public const STATUS_INACTIVE = 'inactive';

    public const STATUSES = [
        self::STATUS_ACTIVE,
        self::STATUS_WARM,
        self::STATUS_INACTIVE,
    ];

    protected $fillable = [
        'college_id',
        'company_id',
        'contact_name',
        'designation',
        'email',
        'phone',
        'relationship_status',
        'notes',
        'last_contacted_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'last_contacted_at' => 'datetime',
        ];
    }

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
