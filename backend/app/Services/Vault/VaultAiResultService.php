<?php

namespace App\Services\Vault;

use App\Models\User;
use App\Models\VaultAiResult;
use App\Models\VaultInterviewQualification;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * The Vault AI Interview results ledger (table vault_ai_results): for each student and stack, the FINAL AVERAGE of the three sets of every
 * series they completed, and the BEST of those.
 *
 * It is fed from the qualification, but it is a ledger and not a copy of it. A qualification forgets: an admin's "fresh start" wipes the
 * scores of the series that qualified the student, and only FAILED series ever reach `attempt_history`. The ledger keeps every completed
 * series, so a student who sits again — after a cooldown, or after a reset — keeps the best result they ever earned, and the report says
 * which one it was.
 *
 * `reconcile()` is the one write path. It is idempotent and rebuilds nothing it has already recorded: an entry is matched by its key
 * (a failed series by its position in the qualification's history, a qualifying series by when it qualified), updated if the marks
 * behind it were corrected, and never dropped. A qualifying series the qualification no longer holds (a reset) stays, flagged `reset`.
 */
class VaultAiResultService
{
    public const PASS = VaultInterviewQualification::PASSING_THRESHOLD;

    public function __construct(private readonly CuratedCatalog $catalog) {}

    /**
     * Brings a student's ledger row for this qualification up to date.
     *
     * @return array{0: ?VaultAiResult, 1: bool} the row (null when nothing has been completed yet) and whether anything changed
     */
    public function reconcile(VaultInterviewQualification $qual): array
    {
        $current = $this->entriesOf($qual);
        $row = VaultAiResult::where('user_id', $qual->user_id)->where('stack_key', $qual->stack_key)->first();

        if ($row === null && $current === []) {
            return [null, false];
        }

        $before = $row ? $this->fingerprint($row) : null;

        $row ??= new VaultAiResult(['user_id' => $qual->user_id, 'stack_key' => $qual->stack_key]);
        $merged = $this->merge($row->history ?? [], $current);

        $best = $this->best($merged);
        $last = $merged === [] ? null : $merged[array_key_last($merged)];

        $user = User::query()->select('id', 'college_id')->find($qual->user_id);

        $row->fill([
            'college_id' => $user?->college_id,
            'role_key' => $qual->role_key,
            'stack_name' => $this->catalog->stack($qual->stack_key)['stack']['name'] ?? ucwords(str_replace('_', ' ', $qual->stack_key)),
            'best_average' => $best['average'] ?? null,
            'best_scores' => $best['scores'] ?? null,
            'best_series' => $best['series'] ?? null,
            'best_at' => isset($best['at']) ? Carbon::parse($best['at']) : null,
            'last_average' => $last['average'] ?? null,
            'last_scores' => $last['scores'] ?? null,
            'last_at' => isset($last['at']) ? Carbon::parse($last['at']) : null,
            'attempts' => count($merged),
            'status' => $qual->status,
            'ever_qualified' => collect($merged)->contains(fn (array $e) => (float) $e['average'] >= self::PASS) || $qual->isQualified(),
            'first_completed_at' => $merged === [] ? null : Carbon::parse($merged[0]['at']),
            'history' => $merged,
        ]);

        $row->save();

        return [$row, $before !== $this->fingerprint($row)];
    }

    /** Reconciles every stack a student has touched (the lazy backfill for results that predate the ledger). */
    public function sync(User $user): Collection
    {
        return VaultInterviewQualification::where('user_id', $user->id)->get()
            ->map(fn (VaultInterviewQualification $q) => $this->reconcile($q)[0])
            ->filter()
            ->values();
    }

    /**
     * The completed series the qualification holds right now.
     *
     * @return list<array<string, mixed>>
     */
    private function entriesOf(VaultInterviewQualification $qual): array
    {
        $out = [];

        foreach (array_values($qual->attempt_history ?? []) as $i => $a) {
            if (! isset($a['average'])) {
                continue;
            }

            $out[] = [
                'key' => 'f'.$i,
                'series' => (int) ($a['series_number'] ?? $a['attempt'] ?? ($i + 1)),
                'scores' => $this->scores($a['scores'] ?? []),
                'average' => round((float) $a['average'], 2),
                'passed' => (float) $a['average'] >= self::PASS,
                'at' => $a['evaluated_at'] ?? ($qual->updated_at?->toIso8601String() ?? now()->toIso8601String()),
                'source' => 'interview',
            ];
        }

        if ($qual->isQualified() && $qual->series_average !== null) {
            $at = $qual->qualified_at ?? $qual->updated_at ?? now();

            $out[] = [
                'key' => 'q'.$at->timestamp,
                'series' => (int) $qual->current_attempt,
                // A qualification an admin granted outright has no sets behind it (its three "scores" are just the average repeated).
                'scores' => $qual->qualified_by_admin_id !== null ? [] : $this->scores($qual->series_scores ?? []),
                'average' => round((float) $qual->series_average, 2),
                'passed' => true,
                'source' => $qual->qualified_by_admin_id !== null ? 'admin' : 'interview',
                'at' => $at->toIso8601String(),
            ];
        }

        return $out;
    }

    /**
     * Folds what the qualification holds now into what the ledger already recorded. Never drops an entry; an entry the qualification no
     * longer holds (a reset wiped its series) is kept and flagged.
     *
     * @param  list<array<string, mixed>>  $ledger
     * @param  list<array<string, mixed>>  $current
     * @return list<array<string, mixed>> oldest first
     */
    private function merge(array $ledger, array $current): array
    {
        $byKey = [];
        foreach ($ledger as $entry) {
            $byKey[$entry['key']] = $entry;
        }

        $held = [];
        foreach ($current as $entry) {
            $held[$entry['key']] = true;
            $previous = $byKey[$entry['key']] ?? [];
            // Marks corrected since: take the new ones. A flag set earlier does not come back off.
            $byKey[$entry['key']] = array_merge($previous, $entry, ['reset' => (bool) ($previous['reset'] ?? false)]);
        }

        foreach ($byKey as $key => $entry) {
            if (! isset($held[$key]) && str_starts_with($key, 'q')) {
                $byKey[$key]['reset'] = true;
            }
        }

        $entries = array_values($byKey);
        usort($entries, fn (array $a, array $b) => strcmp((string) $a['at'], (string) $b['at']) ?: strcmp((string) $a['key'], (string) $b['key']));

        return $entries;
    }

    /**
     * The best series: the highest average; on a tie the one achieved first (the later one added nothing).
     *
     * @param  list<array<string, mixed>>  $entries  oldest first
     * @return array<string, mixed>|null
     */
    private function best(array $entries): ?array
    {
        $best = null;

        foreach ($entries as $e) {
            if ($best === null || (float) $e['average'] > (float) $best['average']) {
                $best = $e;
            }
        }

        return $best;
    }

    /** @return array<string, int> */
    private function scores(array $scores): array
    {
        $out = [];

        foreach (['1', '2', '3'] as $set) {
            if (isset($scores[$set]) || isset($scores[(int) $set])) {
                $out[$set] = (int) round((float) ($scores[$set] ?? $scores[(int) $set]));
            }
        }

        return $out;
    }

    private function fingerprint(VaultAiResult $row): string
    {
        return md5(json_encode([$row->history, $row->best_average, $row->status, $row->attempts]));
    }

    // ------------------------------------------------------------------ screens

    /**
     * A result as the screens draw it.
     *
     * @return array<string, mixed>
     */
    public function present(VaultAiResult $r): array
    {
        $history = collect($r->history ?? []);
        // The best series is the first one that reached the highest average (the same rule best() applies).
        $bestIndex = $history->isEmpty() ? null : $history->keys()->first(fn ($i) => (float) $history[$i]['average'] === (float) $history->max('average'));

        return [
            'id' => $r->id,
            'stack_key' => $r->stack_key,
            'stack_name' => $r->stack_name,
            'role_key' => $r->role_key,
            'status' => $r->status,
            'qualified' => $r->status === VaultInterviewQualification::STATUS_QUALIFIED,
            'ever_qualified' => $r->ever_qualified,
            'pass_mark' => self::PASS,
            'best_average' => $r->best_average,
            'best_scores' => $r->best_scores ?? [],
            'best_series' => $r->best_series,
            'best_at' => $r->best_at?->toIso8601String(),
            'last_average' => $r->last_average,
            'last_at' => $r->last_at?->toIso8601String(),
            'attempts' => $r->attempts,
            'history' => $history->map(fn (array $e, int $i) => [
                'series' => $e['series'], 'scores' => $e['scores'], 'average' => $e['average'], 'passed' => (bool) $e['passed'],
                'at' => $e['at'], 'source' => $e['source'] ?? 'interview', 'reset' => (bool) ($e['reset'] ?? false),
                'is_best' => $i === $bestIndex,
            ])->values()->all(),
            'report_id' => $r->report_id,
            'report_generated_at' => $r->report_generated_at?->toIso8601String(),
        ];
    }

    // ------------------------------------------------------------------ lists

    /**
     * Makes sure every completed Vault AI series that predates the ledger has its row: the qualifications that hold a finished series and
     * have no result yet are reconciled (a bounded batch per call, so opening a screen never turns into a long job). Running
     * `php artisan vault-ai:rebuild-results` does the whole platform at once.
     */
    public function backfillMissing(?int $collegeId = null, int $limit = 300): int
    {
        $query = VaultInterviewQualification::query()
            ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('vault_ai_results')
                ->whereColumn('vault_ai_results.user_id', 'vault_interview_qualifications.user_id')
                ->whereColumn('vault_ai_results.stack_key', 'vault_interview_qualifications.stack_key'))
            ->where(fn ($q) => $q->whereNotNull('series_average')->orWhere(fn ($h) => $h->whereNotNull('attempt_history')->where('attempt_history', '!=', '[]')))
            ->when($collegeId !== null, fn ($q) => $q->whereIn('user_id', User::query()->select('id')->where('college_id', $collegeId)));

        $done = 0;

        foreach ($query->limit($limit)->get() as $qual) {
            if ($this->reconcile($qual)[0] !== null) {
                $done++;
            }
        }

        return $done;
    }

    /**
     * Results for a list screen — a college's (TPO) or the platform's (superadmin) — filtered and paged, with totals.
     *
     * @param  array{q?: ?string, stack?: ?string, status?: ?string, college_id?: ?int, sort?: ?string}  $filters
     * @return array<string, mixed>
     */
    public function listing(?int $collegeId, array $filters, int $page = 1, int $perPage = 25): array
    {
        $base = VaultAiResult::query()
            ->join('users as u', 'u.id', '=', 'vault_ai_results.user_id')
            ->leftJoin('colleges as c', 'c.id', '=', 'vault_ai_results.college_id')
            ->when($collegeId !== null, fn ($q) => $q->where('vault_ai_results.college_id', $collegeId))
            ->when(! empty($filters['college_id']) && $collegeId === null, fn ($q) => $q->where('vault_ai_results.college_id', (int) $filters['college_id']))
            ->when(! empty($filters['stack']), fn ($q) => $q->where('vault_ai_results.stack_key', $filters['stack']))
            ->when(trim((string) ($filters['q'] ?? '')) !== '', function ($q) use ($filters) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], trim((string) $filters['q'])).'%';
                $q->where(fn ($w) => $w->where('u.name', 'like', $like)->orWhere('u.email', 'like', $like)->orWhere('u.roll_number', 'like', $like));
            });

        $status = $filters['status'] ?? null;
        $filtered = (clone $base)
            ->when($status === 'qualified', fn ($q) => $q->where('vault_ai_results.ever_qualified', true))
            ->when($status === 'not_qualified', fn ($q) => $q->where('vault_ai_results.ever_qualified', false));

        $totals = (clone $base)->selectRaw('COUNT(*) as results, COUNT(DISTINCT vault_ai_results.user_id) as students, SUM(CASE WHEN vault_ai_results.ever_qualified = 1 THEN 1 ELSE 0 END) as qualified, AVG(vault_ai_results.best_average) as average')->first();

        $order = match ($filters['sort'] ?? 'best') {
            'recent' => ['vault_ai_results.last_at', 'desc'],
            'name' => ['u.name', 'asc'],
            'attempts' => ['vault_ai_results.attempts', 'desc'],
            default => ['vault_ai_results.best_average', 'desc'],
        };

        $total = (clone $filtered)->count();
        $perPage = max(10, min($perPage, 100));

        $rows = $filtered->orderBy($order[0], $order[1])->orderBy('vault_ai_results.id')
            ->forPage(max(1, $page), $perPage)
            ->get(['vault_ai_results.*', 'u.name as student_name', 'u.email as student_email', 'u.roll_number', 'u.branch', 'u.section', 'c.name as college_name'])
            ->map(fn ($r) => $this->present($r) + [
                'student' => ['id' => $r->user_id, 'name' => $r->student_name, 'email' => $r->student_email, 'roll_number' => $r->roll_number, 'branch' => $r->branch, 'section' => $r->section],
                'college' => $r->college_name,
                'college_id' => $r->college_id,
            ])->all();

        $stacks = (clone $base)->selectRaw('vault_ai_results.stack_key, vault_ai_results.stack_name, COUNT(*) as n')->groupBy('vault_ai_results.stack_key', 'vault_ai_results.stack_name')->orderBy('vault_ai_results.stack_name')->get()
            ->map(fn ($r) => ['key' => $r->stack_key, 'name' => $r->stack_name, 'count' => (int) $r->n])->all();

        return [
            'total' => $total,
            'page' => max(1, $page),
            'per_page' => $perPage,
            'pass_mark' => self::PASS,
            'totals' => [
                'results' => (int) ($totals->results ?? 0),
                'students' => (int) ($totals->students ?? 0),
                'qualified' => (int) ($totals->qualified ?? 0),
                'average' => $totals?->average !== null ? round((float) $totals->average, 1) : null,
            ],
            'stacks' => $stacks,
            'rows' => $rows,
        ];
    }
}
