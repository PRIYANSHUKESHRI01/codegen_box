<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A team's project for one hackathon — one per team.
 *
 * A `draft` can be saved half-finished and is invisible to the judges; a
 * `submitted` entry is what gets scored. Both stay editable until the
 * hackathon's deadline. The score columns are written only by the host's
 * judging endpoints (see HackathonResultsService) and are never exposed to
 * students until the results are published.
 */
class HackathonSubmission extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_SUBMITTED = 'submitted';

    /** The fields a project must have before it can be submitted rather than merely saved. */
    public const REQUIRED_TO_SUBMIT = ['title', 'description', 'repo_url'];

    protected $fillable = [
        'hackathon_id',
        'hackathon_team_id',
        'submitted_by',
        'title',
        'tagline',
        'description',
        'track',
        'repo_url',
        'demo_url',
        'video_url',
        'tech_stack',
        'status',
        'submitted_at',
        'scores',
        'final_score',
        'rank',
        'award_label',
        'feedback',
        'scored_by',
        'scored_at',
        'is_disqualified',
        'disqualified_reason',
    ];

    protected function casts(): array
    {
        return [
            'tech_stack' => 'array',
            'submitted_at' => 'datetime',
            'scores' => 'array',
            'final_score' => 'decimal:2',
            'rank' => 'integer',
            'scored_at' => 'datetime',
            'is_disqualified' => 'boolean',
        ];
    }

    public function hackathon(): BelongsTo
    {
        return $this->belongsTo(Hackathon::class);
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(HackathonTeam::class, 'hackathon_team_id');
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function scorer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'scored_by');
    }

    /**
     * Best placed first, unranked last. `rank` is a reserved word in MySQL 8, so the raw part must be
     * quoted by the connection's own grammar rather than written out by hand.
     */
    public function scopeBestRankFirst(Builder $query): Builder
    {
        $rank = $query->getQuery()->getGrammar()->wrap('rank');

        return $query->orderByRaw("CASE WHEN {$rank} IS NULL THEN 1 ELSE 0 END")->orderBy('rank');
    }

    public function isSubmitted(): bool
    {
        return $this->status === self::STATUS_SUBMITTED;
    }

    public function isScored(): bool
    {
        return $this->final_score !== null;
    }

    /** Names of the fields still empty that a submission needs. */
    public function missingRequiredFields(): array
    {
        return array_values(array_filter(
            self::REQUIRED_TO_SUBMIT,
            fn (string $field) => trim((string) $this->{$field}) === ''
        ));
    }
}
