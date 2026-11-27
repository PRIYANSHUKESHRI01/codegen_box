<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class Problem extends Model
{
    use HasFactory;

    private const CACHE_DIFFICULTY_TOTALS = 'problems:difficulty-totals:v1';

    private const CACHE_TAGS_CATALOG = 'problems:tags-catalog:v1';

    private const CACHE_READINESS_CATALOG = 'problems:readiness-catalog:v1';

    private const CACHE_INDEX_CATALOG = 'problems:index-catalog:v1';

    private const CATALOG_TTL_SECONDS = 3600;

    protected static function booted(): void
    {
        $flush = static fn () => self::flushCatalogCache();
        static::saved($flush);
        static::deleted($flush);
    }

    public static function flushCatalogCache(): void
    {
        Cache::forget(self::CACHE_DIFFICULTY_TOTALS);
        Cache::forget(self::CACHE_TAGS_CATALOG);
        Cache::forget(self::CACHE_READINESS_CATALOG);
        Cache::forget(self::CACHE_INDEX_CATALOG);
    }

    /** @return array<string, int> difficulty => count */
    public static function difficultyTotals(): array
    {
        return Cache::remember(self::CACHE_DIFFICULTY_TOTALS, self::CATALOG_TTL_SECONDS, function () {
            return DB::table('problems')
                ->select('difficulty')
                ->selectRaw('COUNT(*) as total')
                ->groupBy('difficulty')
                ->pluck('total', 'difficulty')
                ->map(fn ($v) => (int) $v)
                ->all();
        });
    }

    /** @return array{tags_by_id: array<int, list<string>>, tag_totals: array<string, int>} */
    public static function tagsCatalog(): array
    {
        return Cache::remember(self::CACHE_TAGS_CATALOG, self::CATALOG_TTL_SECONDS, function () {
            $tagsById = [];
            $tagTotals = [];

            foreach (DB::table('problems')->select(['id', 'tags'])->cursor() as $row) {
                $tags = is_string($row->tags) ? (json_decode($row->tags, true) ?? []) : [];
                $tagsById[(int) $row->id] = $tags;
                foreach ($tags as $tag) {
                    $tagTotals[$tag] = ($tagTotals[$tag] ?? 0) + 1;
                }
            }

            return ['tags_by_id' => $tagsById, 'tag_totals' => $tagTotals];
        });
    }

    /** @return array{totals: array<string, int>, difficulty: array<int, string>, tags: array<int, list<string>>, tag_count: int} */
    public static function readinessCatalog(): array
    {
        return Cache::remember(self::CACHE_READINESS_CATALOG, self::CATALOG_TTL_SECONDS, function () {
            $totals = [];
            $difficulty = [];
            $tags = [];
            $allTags = [];

            foreach (DB::table('problems')->select(['id', 'difficulty', 'tags'])->cursor() as $row) {
                $id = (int) $row->id;
                $diff = (string) $row->difficulty;
                $rowTags = is_string($row->tags) ? (json_decode($row->tags, true) ?? []) : [];

                $totals[$diff] = ($totals[$diff] ?? 0) + 1;
                $difficulty[$id] = $diff;
                $tags[$id] = $rowTags;
                foreach ($rowTags as $tag) {
                    $allTags[$tag] = true;
                }
            }

            return [
                'totals' => $totals,
                'difficulty' => $difficulty,
                'tags' => $tags,
                'tag_count' => count($allTags),
            ];
        });
    }

    /** @return list<array<string, mixed>> */
    public static function indexCatalog(): array
    {
        return Cache::remember(self::CACHE_INDEX_CATALOG, self::CATALOG_TTL_SECONDS, function () {
            $out = [];
            $rows = DB::table('problems')
                ->orderBy('display_order')
                ->orderBy('id')
                ->get(['id', 'slug', 'title', 'difficulty', 'tags', 'companies', 'acceptance_rate', 'total_submissions', 'display_order']);

            foreach ($rows as $row) {
                $out[] = [
                    'id' => (int) $row->id,
                    'slug' => $row->slug,
                    'title' => $row->title,
                    'difficulty' => $row->difficulty,
                    'tags' => is_string($row->tags) ? (json_decode($row->tags, true) ?? []) : [],
                    'companies' => is_string($row->companies) ? json_decode($row->companies, true) : null,
                    'acceptance_rate' => $row->acceptance_rate !== null ? number_format((float) $row->acceptance_rate, 2, '.', '') : null,
                    'total_submissions' => $row->total_submissions !== null ? (int) $row->total_submissions : 0,
                    'serial_number' => ((int) $row->display_order) + 100,
                ];
            }

            return $out;
        });
    }

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

    /**
     * How many test cases a Run (the public samples) and a Submit (all of them) will judge — what the
     * solve screen draws while the judge works, so it is the right number from the first moment even
     * when the queue is synchronous and there is no polling to learn it from. Display only.
     *
     * @return array{samples: int, total: int}
     */
    public function caseCounts(): array
    {
        $counts = $this->testCases()->reorder()->selectRaw('count(*) as total, sum(case when is_sample then 1 else 0 end) as samples')->first();

        return ['samples' => (int) ($counts->samples ?? 0), 'total' => (int) ($counts->total ?? 0)];
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
