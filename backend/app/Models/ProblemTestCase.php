<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One test case for a Problem — either a public sample (is_sample=true,
 * shown on the problem page and used by "Run") or a hidden case (used only
 * by "Submit", never serialized to the client). See
 * App\Services\ProblemCodeGenerator\HarnessGenerator for how `inputs` gets
 * turned into real per-language literals, and JudgeService for how
 * `expected_output` gets compared against the harness's actual output.
 */
class ProblemTestCase extends Model
{
    protected $fillable = [
        'problem_id',
        'inputs',
        'expected_output',
        'explanation',
        'is_sample',
        'display_order',
    ];

    protected function casts(): array
    {
        return [
            'inputs' => 'array',
            'expected_output' => 'array',
            'is_sample' => 'boolean',
            'display_order' => 'integer',
        ];
    }

    public function problem(): BelongsTo
    {
        return $this->belongsTo(Problem::class);
    }

    /**
     * "nums = [2,7,11,15], target = 9" — the same LeetCode-style display
     * string the old hand-written `examples[].input` values used, now
     * derived from structured `inputs` + the problem's declared param
     * order. Shared by ProblemController (public sample display) and
     * JudgeService (per-case Run/Submit result display) so the two can
     * never drift into different formats for the same test case.
     */
    public function prettyInput(array $params): string
    {
        $parts = array_map(
            fn ($p) => "{$p['name']} = ".json_encode($this->inputs[$p['name']] ?? null),
            $params
        );

        return implode(', ', $parts);
    }
}
