<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A "Talk to Our Team" submission from the public marketing site — a college/
 * TPO or hiring company reaching out, before they're any kind of account
 * holder. See the create_contact_requests_table migration's docblock for why
 * this is its own model rather than a User row.
 */
class ContactRequest extends Model
{
    public const AUDIENCE_INSTITUTION = 'institution';

    public const AUDIENCE_COMPANY = 'company';

    protected $fillable = [
        'name',
        'email',
        'phone',
        'audience',
        'organization_name',
        'message',
        'status',
        'assigned_marketing_id',
    ];

    protected function casts(): array
    {
        return [
            'converted_at' => 'datetime',
        ];
    }

    /** Notes the marketing team has logged about this inquiry — see ContactRequestNote. */
    public function notes(): HasMany
    {
        return $this->hasMany(ContactRequestNote::class)->orderByDesc('created_at');
    }

    /** The Mellow Marketing employee this inquiry is assigned to — see LeadAssignmentService::assignContactRequest(). */
    public function assignedMarketing(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_marketing_id');
    }
}
