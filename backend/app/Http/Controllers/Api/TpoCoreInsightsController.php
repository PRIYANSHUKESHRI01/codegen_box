<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CoreSubject;
use App\Models\User;
use App\Services\Core\CoreAccess;
use App\Services\Core\CoreMasteryService;
use App\Services\ReadinessScoreService;
use App\Support\BranchCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * What a college's TPO sees of Core Prep across its ECE / EEE / Mechanical / Civil students: where each branch is
 * strong or weak by subject (the heatmap, and the plain-language "run a remedial class" lines drawn from it), and
 * one row per student for the Core Subject Proficiency report.
 *
 * Always one college: every query is scoped to the TPO's own students, and the heatmap is one grouped query however
 * many students there are. A branch family appears only once Mellow has switched its Core Prep live.
 */
class TpoCoreInsightsController extends Controller
{
    public function __construct(private readonly CoreMasteryService $mastery) {}

    /** Branch × subject accuracy for the college, plus the subjects most worth a remedial session. */
    public function heatmap(Request $request): JsonResponse
    {
        $collegeId = $this->collegeId($request);
        $catalog = BranchCatalog::instance();
        $live = $this->liveFamilies($collegeId);

        if ($live === []) {
            return response()->json(['disciplines' => [], 'insights' => []]);
        }

        $since = now()->subDays($this->mastery->windowDays());
        $users = DB::table('users')->where('college_id', $collegeId)->where('role', User::ROLE_USER)->whereIn('discipline', array_keys($live));

        $practice = DB::table('core_practice_answers as a')->join('users as u', 'u.id', '=', 'a.user_id')
            ->where('u.college_id', $collegeId)->where('u.role', User::ROLE_USER)->whereIn('u.discipline', array_keys($live))->where('a.created_at', '>=', $since)
            ->select('u.discipline', 'u.branch_code', 'a.user_id', 'a.subject_id', 'a.is_correct');

        $tests = DB::table('core_test_responses as r')
            ->join('core_test_sessions as s', 's.id', '=', 'r.core_test_session_id')
            ->join('core_questions as q', 'q.id', '=', 'r.core_question_id')
            ->join('users as u', 'u.id', '=', 's.user_id')
            ->where('u.college_id', $collegeId)->where('u.role', User::ROLE_USER)->whereIn('u.discipline', array_keys($live))
            ->where('s.status', 'completed')->where('s.completed_at', '>=', $since)->whereNotNull('r.is_correct')
            ->select('u.discipline', 'u.branch_code', 's.user_id', 'q.subject_id', 'r.is_correct');

        // A union mutates the builder it is called on, so each use starts from its own copy.
        $answers = fn () => (clone $practice)->unionAll(clone $tests);

        $cells = DB::query()->fromSub($answers(), 'x')
            ->select('discipline', 'branch_code', 'subject_id')
            ->selectRaw('count(*) as attempts, sum(case when is_correct then 1 else 0 end) as correct, count(distinct user_id) as students')
            ->groupBy('discipline', 'branch_code', 'subject_id')->get();

        $perSubject = DB::query()->fromSub($answers(), 'y')
            ->select('discipline', 'subject_id')
            ->selectRaw('count(*) as attempts, sum(case when is_correct then 1 else 0 end) as correct, count(distinct user_id) as students')
            ->groupBy('discipline', 'subject_id')->get();

        $roster = (clone $users)->select('discipline', 'branch_code')->selectRaw('count(*) as n')->groupBy('discipline', 'branch_code')->get();
        $subjects = CoreSubject::query()->whereIn('discipline_code', array_keys($live))->where('is_active', true)->orderBy('sort')->get(['id', 'discipline_code', 'name'])->groupBy('discipline_code');

        $accuracy = fn ($row) => $row->attempts > 0 ? (int) round($row->correct / $row->attempts * 100) : null;
        $disciplines = [];
        $insights = [];

        foreach ($live as $code => $info) {
            $withData = $perSubject->where('discipline', $code)->keyBy('subject_id');
            $shown = ($subjects[$code] ?? collect())->filter(fn (CoreSubject $s) => $withData->has($s->id))->values();

            $branches = $roster->where('discipline', $code)->map(function ($r) use ($cells, $code, $catalog, $accuracy) {
                $mine = $cells->where('discipline', $code)->where('branch_code', $r->branch_code);

                return [
                    'code' => $r->branch_code,
                    'name' => $r->branch_code ? ($catalog->branch($r->branch_code)['name'] ?? $r->branch_code) : 'Not mapped yet',
                    'students' => (int) $r->n,
                    'cells' => $mine->mapWithKeys(fn ($c) => [(string) $c->subject_id => ['accuracy' => $accuracy($c), 'attempts' => (int) $c->attempts, 'students' => (int) $c->students]])->all(),
                ];
            })->sortByDesc('students')->values()->all();

            $subjectRows = $shown->map(fn (CoreSubject $s) => [
                'id' => $s->id, 'name' => $s->name,
                'accuracy' => $accuracy($withData[$s->id]), 'attempts' => (int) $withData[$s->id]->attempts, 'students' => (int) $withData[$s->id]->students,
            ])->values()->all();

            $disciplines[] = [
                'code' => $code, 'name' => $info['name'], 'short' => $info['short'],
                'students' => (int) $roster->where('discipline', $code)->sum('n'),
                'subjects' => $subjectRows,
                'branches' => $branches,
            ];

            // The subjects this college's students are weakest in — enough answers from enough students to mean something.
            foreach ($subjectRows as $row) {
                if ($row['accuracy'] !== null
                    && $row['accuracy'] < (int) config('core_prep.insights.weak_below_percent', 50)
                    && $row['attempts'] >= (int) config('core_prep.insights.min_attempts', 30)
                    && $row['students'] >= (int) config('core_prep.insights.min_students', 3)) {
                    $insights[] = [
                        'discipline' => $code, 'discipline_name' => $info['short'], 'subject' => $row['name'],
                        'accuracy' => $row['accuracy'], 'students' => $row['students'],
                        'message' => "{$info['short']}: {$row['name']} is at {$row['accuracy']}% across {$row['students']} students — a remedial session would help.",
                    ];
                }
            }
        }

        usort($insights, fn (array $a, array $b) => $a['accuracy'] <=> $b['accuracy']);

        return response()->json(['disciplines' => $disciplines, 'insights' => array_slice($insights, 0, 6)]);
    }

    /**
     * One row per student of a live core branch, with their accuracy in every subject they have answered — what the
     * Core Subject Proficiency report is made of.
     */
    public function proficiency(Request $request): JsonResponse
    {
        $collegeId = $this->collegeId($request);
        $live = $this->liveFamilies($collegeId);

        if ($live === []) {
            return response()->json(['disciplines' => []]);
        }

        // Whole rows: the readiness score reads more of a student than the columns this report prints.
        $students = User::query()->where('college_id', $collegeId)->where('role', User::ROLE_USER)->whereIn('discipline', array_keys($live))->orderBy('name')->get();

        $ids = $students->pluck('id')->all();
        $stats = $this->mastery->subjectStatsFor($ids);
        $mastered = $this->mastery->masteredTopicCounts($ids);
        $tests = $ids === [] ? collect() : DB::table('core_test_sessions')->whereIn('user_id', $ids)->where('status', 'completed')
            ->select('user_id')->selectRaw('count(*) as taken, avg(score_percent) as average')->groupBy('user_id')->get()->keyBy('user_id');

        // The readiness each was scored with, in bulk — the same call the roster makes.
        $readiness = app(ReadinessScoreService::class)->compute($students);

        $subjectsBy = CoreSubject::query()->whereIn('discipline_code', array_keys($live))->where('is_active', true)->orderBy('sort')->get(['id', 'discipline_code', 'name'])->groupBy('discipline_code');

        $out = [];
        foreach ($live as $code => $info) {
            $mine = $students->where('discipline', $code);
            $used = $mine->flatMap(fn (User $s) => array_keys($stats[$s->id] ?? []))->unique();
            $columns = ($subjectsBy[$code] ?? collect())->filter(fn (CoreSubject $s) => $used->contains($s->id))->values();

            $out[] = [
                'code' => $code, 'name' => $info['name'],
                'subjects' => $columns->map(fn (CoreSubject $s) => ['id' => $s->id, 'name' => $s->name])->all(),
                'students' => $mine->map(function (User $s) use ($stats, $mastered, $tests, $readiness) {
                    $breakdown = $readiness[$s->id]['breakdown'];
                    $bySubject = collect($stats[$s->id] ?? [])->map(fn (array $c) => ['accuracy' => $c['attempts'] > 0 ? (int) round($c['correct'] / $c['attempts'] * 100) : null, 'attempts' => $c['attempts']]);

                    return [
                        'id' => $s->id, 'name' => $s->name, 'roll_number' => $s->roll_number, 'branch' => $s->branch, 'section' => $s->section, 'track_focus' => $s->track_focus,
                        'readiness_score' => $breakdown['score'], 'profile' => $breakdown['profile'] ?? 'software',
                        'core_readiness' => collect($breakdown['components'])->firstWhere('key', 'core_technical')['score'] ?? null,
                        'answered' => $bySubject->sum('attempts'), 'topics_mastered' => $mastered[$s->id] ?? 0,
                        'tests_taken' => (int) ($tests[$s->id]->taken ?? 0), 'avg_test_percent' => isset($tests[$s->id]) ? (int) round((float) $tests[$s->id]->average) : null,
                        'subjects' => $bySubject->mapWithKeys(fn ($v, $id) => [(string) $id => $v])->all(),
                    ];
                })->values()->all(),
            ];
        }

        return response()->json(['disciplines' => $out]);
    }

    private function collegeId(Request $request): int
    {
        $collegeId = $request->user()->college_id;
        abort_unless($collegeId, 422, 'Your account is not linked to a college.');

        return (int) $collegeId;
    }

    /**
     * The core branch families this college has students in AND whose Core Prep is live.
     *
     * @return array<string, array{name: string, short: string}> family code => labels
     */
    private function liveFamilies(int $collegeId): array
    {
        $present = DB::table('users')->where('college_id', $collegeId)->where('role', User::ROLE_USER)->whereIn('discipline', CoreAccess::families())
            ->distinct()->pluck('discipline')->all();

        $catalog = BranchCatalog::instance();
        $live = [];

        foreach (CoreAccess::families() as $code) {
            $discipline = $catalog->discipline($code);

            if (in_array($code, $present, true) && ($discipline['is_live'] ?? false)) {
                $live[$code] = ['name' => $discipline['name'], 'short' => $discipline['short']];
            }
        }

        return $live;
    }
}
