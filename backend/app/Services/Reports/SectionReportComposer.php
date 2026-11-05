<?php

namespace App\Services\Reports;

use App\Models\User;
use App\Services\CoordinatorInsightsService;
use App\Services\CoordinatorOverviewService;
use App\Services\StudentCohortService;
use Illuminate\Support\Collection;

/**
 * The Section Performance Report: one section's students on one document — headline numbers, how the section has moved, who needs a
 * conversation, who is leading, what the college scheduled for it and how much of it was done, every open follow-up, and every
 * student with their standing. Built from the same rows and the same rules as the coordinator's dashboard, so the PDF and the screen
 * agree to the digit.
 *
 * The caller decides WHICH students (a coordinator's own scoped set, or a TPO's whole section); this only describes them.
 */
class SectionReportComposer
{
    public function __construct(
        private readonly StudentCohortService $cohort,
        private readonly CoordinatorOverviewService $overview,
        private readonly CoordinatorInsightsService $insights,
    ) {}

    /**
     * @param  Collection<int, User>  $students
     * @return array<string, mixed>
     */
    public function compose(User $actor, Collection $students, string $sectionLabel, ?string $scopeLabel = null): array
    {
        $students = $students->values();
        $ids = $students->pluck('id')->map(fn ($id) => (int) $id)->all();
        $college = $actor->college;

        $followUps = $this->overview->followUpsFor($ids);
        $lockedOut = $this->overview->recentlyLockedOut($ids);
        $mappings = $this->cohort->activeMappingsFor((int) $actor->college_id);

        $rows = array_map(
            fn (array $row) => $row + ['follow_up' => $followUps[$row['id']] ?? ['open' => 0, 'next_due' => null, 'overdue' => false, 'due_today' => false, 'last_note_at' => null]],
            $this->cohort->payloads($students, $mappings)
        );

        $built = $this->overview->build($rows, $lockedOut);

        $scored = collect($rows)->sortByDesc('readiness_score')->values();
        $unblocked = $scored->reject(fn (array $r) => $r['is_blocked']);

        $branches = collect($rows)->groupBy(fn (array $r) => $r['branch'] ?: 'Not on file')
            ->map(fn ($g, $name) => [
                'branch' => (string) $name,
                'students' => $g->count(),
                'average' => (int) round($g->avg('readiness_score')),
            ])->sortByDesc('students')->values()->all();

        $practising = count(array_filter($rows, fn (array $r) => ($r['activity']['engagement'] ?? '') === 'active'));

        return [
            'generated_at' => now()->toIso8601String(),
            'college' => ['name' => $college?->name, 'city' => $college?->city, 'state' => $college?->state],
            'section' => $sectionLabel,
            'scope' => $scopeLabel,
            'prepared_by' => ['name' => $actor->name, 'role' => $actor->role],
            'summary' => $built['summary'] + ['practising' => $practising, 'practising_percent' => count($rows) > 0 ? (int) round($practising / count($rows) * 100) : 0],
            'attention' => $built['attention'],
            'leaders' => $unblocked->take(8)->map(fn (array $r) => $this->short($r))->all(),
            'needs_support' => $unblocked->reverse()->take(8)->values()->map(fn (array $r) => $this->short($r))->all(),
            'branches' => $branches,
            'trend' => $this->insights->trend($ids),
            'movers' => $this->insights->movers($students),
            'events' => $this->insights->events($actor, $students),
            'follow_ups' => $this->insights->followUps($ids),
            'college_average' => $this->insights->collegeAverage((int) $actor->college_id),
            'students' => collect($rows)->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)->map(fn (array $r) => $this->short($r) + [
                'solved' => $r['solved']['total'] ?? 0,
                'engagement' => $r['activity']['engagement'] ?? 'not_started',
                'days_since_practice' => $r['activity']['days_since_practice'] ?? null,
                'open_follow_ups' => $r['follow_up']['open'] ?? 0,
                'blocked' => (bool) $r['is_blocked'],
            ])->values()->all(),
        ];
    }

    /** @return array<string, mixed> */
    private function short(array $r): array
    {
        return [
            'id' => $r['id'],
            'name' => $r['name'],
            'roll_number' => $r['roll_number'],
            'branch' => $r['branch'],
            'readiness' => $r['readiness_score'],
            'tier' => $r['readiness_tier'],
        ];
    }

    /** The headline figures kept beside the stored PDF. */
    public static function snapshot(array $data): array
    {
        return [
            'students' => $data['summary']['size'],
            'average_readiness' => $data['summary']['avg_readiness'],
            'at_risk' => $data['summary']['at_risk'],
            'attention' => count($data['attention']),
            'practising_percent' => $data['summary']['practising_percent'],
        ];
    }
}
