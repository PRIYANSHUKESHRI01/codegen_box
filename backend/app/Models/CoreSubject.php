<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A subject a Domain Prep (Core Prep) question is filed under ("Analog Circuits", "Marketing Management"), per discipline.
 * `branch_codes` null = shared by every branch of the discipline; a list = a specialisation only those branches see.
 */
class CoreSubject extends Model
{
    protected $fillable = ['discipline_code', 'code', 'name', 'sort', 'is_active', 'branch_codes'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'sort' => 'integer', 'branch_codes' => 'array'];
    }

    /**
     * The ids of the subjects a student of this branch is offered: every shared subject of the discipline, plus the
     * specialisations that list their branch. A student whose branch is not known is offered the shared ones only.
     * Plain PHP over a handful of rows (a discipline has a few dozen subjects at most) so it behaves identically on every database.
     *
     * @return list<int>
     */
    public static function idsVisibleTo(string $discipline, ?string $branchCode): array
    {
        return static::query()->where('discipline_code', $discipline)->where('is_active', true)->get(['id', 'branch_codes'])
            ->filter(fn (self $s) => $s->branch_codes === null || $s->branch_codes === [] || ($branchCode !== null && in_array($branchCode, $s->branch_codes, true)))
            ->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
    }

    /**
     * The subjects a TEST aimed at this audience may take questions from. A test is one fixed paper that every student it reaches sits,
     * so it can only hold what every one of them studies: the shared core always, and a specialisation subject (one that belongs to
     * specific branches) only when the test is aimed at branches alone and each of them is among the subject's own. A test aimed at a
     * whole family or department reaches every branch of it, so for those it is the shared core only.
     *
     * @param  array<string, mixed>|null  $audience
     * @return list<int>
     */
    public static function idsForAudience(string $discipline, ?array $audience): array
    {
        $audience = \App\Support\BranchAudience::normalize($audience);
        $reached = null;

        if ($audience !== null && ($audience['departments'] ?? []) === [] && $audience['disciplines'] === [] && $audience['branches'] !== []) {
            $catalog = \App\Support\BranchCatalog::instance();
            // Branches of other families never see this test (the family is checked separately), so they do not count.
            $reached = array_values(array_filter($audience['branches'], fn (string $b) => $catalog->disciplineOf($b) === $discipline));
        }

        return static::query()->where('discipline_code', $discipline)->where('is_active', true)->get(['id', 'branch_codes'])
            ->filter(function (self $s) use ($reached) {
                $codes = $s->branch_codes ?? [];

                return $codes === [] || ($reached !== null && $reached !== [] && array_diff($reached, $codes) === []);
            })
            ->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
    }

    public function topics(): HasMany
    {
        return $this->hasMany(CoreTopic::class, 'subject_id')->orderBy('sort')->orderBy('id');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(CoreQuestion::class, 'subject_id');
    }
}
