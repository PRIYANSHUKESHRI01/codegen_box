<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A "Talk to Our Team" submission from the public marketing site — a college/
 * TPO, a hiring company, or a student asking about Mellow Academy (the
 * team-sold Grandmaster plan), reaching out before they're any kind of
 * account holder. See the create_contact_requests_table migration's docblock for why
 * this is its own model rather than a User row.
 */
class ContactRequest extends Model
{
    public const AUDIENCE_INSTITUTION = 'institution';

    public const AUDIENCE_COMPANY = 'company';

    /** A student (or parent) asking about Mellow Academy — the Grandmaster card's "Contact our team". `organization_name` is the college or institute they study at. */
    public const AUDIENCE_ACADEMY = 'academy';

    /** What each audience is called in the team's inbox and in emails to them. */
    private const AUDIENCE_LABELS = [
        self::AUDIENCE_INSTITUTION => 'College / TPO',
        self::AUDIENCE_COMPANY => 'Employer',
        self::AUDIENCE_ACADEMY => 'Mellow Academy',
    ];

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

    public function audienceLabel(): string
    {
        return self::AUDIENCE_LABELS[$this->audience] ?? 'Inquiry';
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
