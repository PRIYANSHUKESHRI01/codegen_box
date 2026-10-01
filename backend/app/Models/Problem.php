<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Problem extends Model
{
    use HasFactory;

    public const DIFFICULTY_EASY = 'easy';

    public const DIFFICULTY_MEDIUM = 'medium';

    public const DIFFICULTY_HARD = 'hard';

    public const DIFFICULTIES = [
        self::DIFFICULTY_EASY,
        self::DIFFICULTY_MEDIUM,
        self::DIFFICULTY_HARD,
    ];

    public const COMPARISON_EXACT = 'exact';

    public const COMPARISON_UNORDERED = 'unordered';

    public const COMPARISON_FLOAT_TOLERANCE = 'float_tolerance';

    public const COMPARISON_MODES = [
        self::COMPARISON_EXACT,
        self::COMPARISON_UNORDERED,
        self::COMPARISON_FLOAT_TOLERANCE,
    ];

    protected $fillable = [
        'slug',
        'title',
        'difficulty',
        'tags',
        'companies',
        'description',
        'function_name',
        'params',
        'return_type',
        'comparison_mode',
        'comparison_epsilon',
        'constraints',
        'hints',
        'acceptance_rate',
        'total_submissions',
        'display_order',
    ];

    protected function casts(): array
    {
        return [
            'tags' => 'array',
            'companies' => 'array',
            'params' => 'array',
            'comparison_epsilon' => 'decimal:8',
            'constraints' => 'array',
            'hints' => 'array',
            'acceptance_rate' => 'decimal:2',
            'total_submissions' => 'integer',
            'display_order' => 'integer',
        ];
    }

    /** Problems are looked up by slug in routes (e.g. GET /problems/two-sum), not by numeric id. */
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function testCases(): HasMany
    {
        return $this->hasMany(ProblemTestCase::class)->orderBy('display_order');
    }

    public function sampleTestCases(): HasMany
    {
        return $this->testCases()->where('is_sample', true);
    }

    /**
     * Real submission history — deliberately NOT the same thing as
     * `total_submissions`/`acceptance_rate` above, which are static seed
     * flavor-text values nothing in this codebase ever recalculates. Use
     * this relation (via withCount, see AdminProblemController::index())
     * whenever a real, live count is actually needed.
     */
    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }
}
