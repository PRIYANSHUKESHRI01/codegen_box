<?php

namespace App\Services\Reports;

use App\Models\CoordinatorNote;
use App\Models\CoreSubject;
use App\Models\InterviewSession;
use App\Models\Submission;
use App\Models\User;
use App\Models\VaultInterviewQualification;
use App\Services\Core\CoreAccess;
use App\Services\Core\CoreMasteryService;
use App\Services\ReadinessHistoryService;
use App\Services\StudentCohortService;
use App\Services\StudentReportService;
use App\Services\StudentStatsService;
use App\Support\ReportFormat;
use Illuminate\Support\Facades\DB;

/**
 * Everything the full student report says, gathered in one place and shaped for the PDF (and for the "preview" JSON the
 * screens use). Nothing is computed here that the app does not already compute somewhere — readiness, rating, streaks,
 * language insights, contests and drives come from the services the live "View Report" screen uses, so the PDF and the
 * screen can never disagree. What this adds is the narrative on top (strengths, concerns, next actions, written
 * deterministically from those numbers — no AI, no invented figures) and the sections the screen does not show yet:
 * interview category averages, integrity record, Vault AI qualification, soft skills, Core/Domain Prep.
 *
 * Two audiences. `staff` (a TPO, a section coordinator, platform staff) sees the follow-up notes the college keeps about the
 * student; `student` (the student downloading their own report) never does — those notes are internal.
 */
class StudentReportComposer
{
    public const AUDIENCE_STAFF = 'staff';

    public const AUDIENCE_STUDENT = 'student';

    public function __construct(
        private readonly StudentReportService $reports,
        private readonly StudentStatsService $stats,
        private readonly StudentCohortService $cohort,
        private readonly ReadinessHistoryService $history,
    ) {}

    /** @return array<string, mixed> */
    public function compose(User $student, string $audience = self::AUDIENCE_STAFF): array
    {
        $student->loadMissing('college');

        $base = $this->reports->report($student);
        $breakdown = $student->readinessBreakdown();

        $row = $this->cohortRow($student);
        $trend = $this->history->history($student, $breakdown, 56);

        $verdicts = $this->stats->verdictBreakdown($student);
        $totalSubmissions = array_sum(array_column($verdicts, 'count'));
        $accepted = (int) (collect($verdicts)->firstWhere('status', Submission::STATUS_ACCEPTED)['count'] ?? 0);

        $interviews = $this->interviews($student);
        $softSkills = $this->reports->softSkillHistory($student)->all();
        $vaultAi = $this->vaultAi($student);
        $conduct = $this->conduct($student, $interviews['rows']);
        $core = $this->core($student);
        $topics = $this->topics($student);

        $headline = [
            'readiness' => $base['readiness']['score'],
            'tier' => $base['readiness']['tier'],
            'rating' => $base['rating']['display_rating'],
            'solved' => $base['solved']['total_solved'],
            'acceptance_rate' => $totalSubmissions > 0 ? (int) round($accepted / $totalSubmissions * 100) : null,
            'submissions' => $totalSubmissions,
            'streak' => $base['streak']['current'],
            'best_streak' => $base['streak']['max'],
            'active_days_30' => $row['activity']['active_days_30'] ?? 0,
            'interview_average' => $interviews['average'],
            'interviews_completed' => $interviews['completed'],
            'soft_skill_average' => $softSkills === [] ? null : (int) round(collect($softSkills)->avg('score_percent')),
            'contests' => count($base['contests']),
        ];

        $data = [
            'audience' => $audience,
            'generated_at' => now()->toIso8601String(),
            'college' => [
                'name' => $student->college?->name,
                'city' => $student->college?->city,
                'state' => $student->college?->state,
            ],
            'student' => $base['student'] + [
                'year_label' => $row['year_label'] ?? null,
                'graduation_year' => $row['graduation_year'] ?? null,
                'parent_phone' => $student->parent_phone,
                'joined_at' => $student->created_at?->toIso8601String(),
                'primary_language' => $row['coding']['primary_language'] ?? null,
                'department' => $row['department'] ?? null,
                'blocked' => $row['blocked'] ?? null,
            ],
            'headline' => $headline,
            'readiness' => [
                'score' => $base['readiness']['score'],
                'tier' => $base['readiness']['tier'],
                'practice_score' => $base['readiness']['practice_score'],
                'components' => $base['readiness']['components'],
                'next_steps' => $base['readiness']['next_steps'],
                'trend' => $trend['points'],
                'trend_summary' => $trend['summary'],
                'eligible_drives' => ['eligible' => $row['eligible_drive_count'] ?? 0, 'active' => $row['active_drive_count'] ?? 0],
            ],
            'coding' => [
                'solved' => $base['solved'],
                'verdicts' => $verdicts,
                'languages' => $base['languages'],
                'topics_strong' => $topics['strong'],
                'topics_weak' => $topics['weak'],
                'recent' => array_slice($base['submissions']->all(), 0, 12),
            ],
            'contests' => $base['contests']->all(),
            'interviews' => $interviews,
            'vault_ai' => $vaultAi,
            'soft_skills' => $softSkills,
            'core' => $core,
            'drives' => $base['drive_applications']->all(),
            'conduct' => $conduct,
            'notes' => $audience === self::AUDIENCE_STAFF ? $this->notes($student) : [],
        ];

        $data['narrative'] = $this->narrative($data);

        return $data;
    }

    /** The compact figures stored beside the PDF so a history list can show them without opening the file. */
    public static function snapshot(array $data): array
    {
        $h = $data['headline'];

        return [
            'readiness' => $h['readiness'],
            'tier' => $h['tier'],
            'solved' => $h['solved'],
            'acceptance_rate' => $h['acceptance_rate'],
            'interview_average' => $h['interview_average'],
            'interviews_completed' => $h['interviews_completed'],
            'contests' => $h['contests'],
            'streak' => $h['streak'],
        ];
    }

    /** @return array<string, mixed> */
    private function cohortRow(User $student): array
    {
        try {
            $mappings = $student->college_id ? $this->cohort->activeMappingsFor($student->college_id) : collect();

            return $this->cohort->payload($student, $mappings);
        } catch (\Throwable $e) {
            report($e);

            return [];
        }
    }

    /**
     * Every interview sitting with its score and integrity record, plus the student's average by question category
     * (what the interviewers' rubric calls communication, technical depth …) over every answer that has a score.
     *
     * @return array{rows: list<array<string, mixed>>, average: ?int, completed: int, categories: list<array{category: string, average: int, answers: int}>}
     */
    private function interviews(User $student): array
    {
        $sessions = InterviewSession::query()
            ->where('user_id', $student->id)
            ->with(['interview:id,title,slug,interview_type,is_mock,practice_config,discipline,company_id', 'interview.company:id,name', 'proctoringSession:id,interview_session_id,violation_count,status'])
            ->withCount('responses')
            ->orderByDesc('invited_at')
            ->orderByDesc('id')
            ->limit(40)
            ->get();

        $rows = [];

        foreach ($sessions as $s) {
            $interview = $s->interview;

            if ($interview === null) {
                continue;
            }

            $config = (array) $interview->practice_config;
            $rows[] = [
                'session_id' => $s->id,
                'title' => $interview->title,
                'kind' => ReportFormat::interviewKind($interview->interview_type, (bool) $interview->is_mock, $config),
                'company' => $interview->company?->name,
                'status' => $s->status,
                'score' => $s->hasScoreAvailable() ? (float) $s->composite_score_percent : null,
                'answered' => (int) $s->responses_count,
                'date' => ($s->completed_at ?? $s->started_at ?? $s->invited_at)?->toIso8601String(),
                'violations' => (int) ($s->proctoringSession?->violation_count ?? 0),
                'locked' => $s->proctoringSession?->status === 'locked',
            ];
        }

        $scored = array_values(array_filter($rows, fn (array $r) => $r['score'] !== null));

        $categories = DB::table('interview_responses as r')
            ->join('interview_sessions as s', 's.id', '=', 'r.interview_session_id')
            ->join('interview_questions as q', 'q.id', '=', 'r.interview_question_id')
            ->join('interview_question_banks as b', 'b.id', '=', 'q.interview_question_bank_id')
            ->where('s.user_id', $student->id)
            ->whereNotNull('r.score')
            ->groupBy('b.category')
            ->selectRaw('b.category as category, avg(r.score) as average, count(*) as answers')
            ->orderByDesc('answers')
            ->limit(8)
            ->get()
            ->map(fn ($c) => ['category' => (string) $c->category, 'average' => (int) round((float) $c->average), 'answers' => (int) $c->answers])
            ->all();

        return [
            'rows' => $rows,
            'average' => $scored === [] ? null : (int) round(collect($scored)->avg('score')),
            'completed' => count(array_filter($rows, fn (array $r) => $r['status'] === InterviewSession::STATUS_COMPLETED)),
            'categories' => $categories,
        ];
    }

    /** @return list<array<string, mixed>> */
    private function vaultAi(User $student): array
    {
        return VaultInterviewQualification::query()
            ->where('user_id', $student->id)
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (VaultInterviewQualification $q) => [
                'stack' => ReportFormat::humanise($q->stack_key),
                'status' => $q->status,
                'average' => $q->series_average !== null ? (int) round($q->series_average) : null,
                'attempt' => $q->current_attempt,
                'max_attempts' => $q->max_attempts,
                'qualified_at' => $q->qualified_at?->toIso8601String(),
            ])
            ->all();
    }

    /**
     * Contest and interview integrity: strikes, lock-outs. Counts only — the evidence itself stays on the integrity screens
     * that already guard it.
     *
     * @param  list<array<string, mixed>>  $interviewRows
     * @return array<string, mixed>
     */
    private function conduct(User $student, array $interviewRows): array
    {
        $contest = DB::table('proctoring_sessions as p')
            ->join('contest_participants as cp', 'cp.id', '=', 'p.contest_participant_id')
            ->where('cp.user_id', $student->id)
            ->selectRaw('count(*) as sittings, coalesce(sum(p.violation_count), 0) as violations, coalesce(sum(case when p.status = ? then 1 else 0 end), 0) as locked', ['locked'])
            ->first();

        $interviewViolations = array_sum(array_column($interviewRows, 'violations'));
        $interviewLocks = count(array_filter($interviewRows, fn (array $r) => $r['locked']));

        $total = (int) ($contest->violations ?? 0) + $interviewViolations;
        $locks = (int) ($contest->locked ?? 0) + $interviewLocks;

        return [
            'contest_sittings' => (int) ($contest->sittings ?? 0),
            'contest_violations' => (int) ($contest->violations ?? 0),
            'contest_lockouts' => (int) ($contest->locked ?? 0),
            'interview_violations' => $interviewViolations,
            'interview_lockouts' => $interviewLocks,
            'total_violations' => $total,
            'total_lockouts' => $locks,
            'clean' => $total === 0 && $locks === 0,
        ];
    }

    /**
     * Domain/Core Prep standing — null unless the student's programme has it live.
     *
     * @return array<string, mixed>|null
     */
    private function core(User $student): ?array
    {
        try {
            if (! app(CoreAccess::class)->liveFamily($student->getAttributes()['discipline'] ?? null)) {
                return null;
            }

            $stats = app(CoreMasteryService::class)->subjectStatsFor([$student->id])[$student->id] ?? [];
            $names = CoreSubject::query()->whereIn('id', array_keys($stats))->pluck('name', 'id');

            $subjects = [];
            foreach ($stats as $subjectId => $s) {
                if (($s['attempts'] ?? 0) === 0) {
                    continue;
                }
                $subjects[] = [
                    'name' => $names[$subjectId] ?? 'Subject',
                    'attempts' => (int) $s['attempts'],
                    'accuracy' => (int) round($s['correct'] / max(1, $s['attempts']) * 100),
                ];
            }

            usort($subjects, fn (array $a, array $b) => $b['accuracy'] <=> $a['accuracy']);

            return ['subjects' => $subjects, 'answered' => array_sum(array_column($subjects, 'attempts'))];
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }

    /** @return array{strong: list<array<string, mixed>>, weak: list<array<string, mixed>>} */
    private function topics(User $student): array
    {
        try {
            $topics = collect($this->stats->topicMastery($student))->filter(fn (array $t) => ($t['solved'] ?? 0) > 0 || ($t['accuracy'] ?? 0) > 0);

            $strong = $topics->filter(fn (array $t) => $t['solved'] >= 2)->sortByDesc(fn (array $t) => [$t['accuracy'], $t['solved']])->take(5)->values()->all();
            $weak = $topics->filter(fn (array $t) => $t['accuracy'] < 50 && $t['total'] > 0)->sortBy(fn (array $t) => $t['accuracy'])->take(5)->values()->all();

            return ['strong' => $strong, 'weak' => $weak];
        } catch (\Throwable $e) {
            report($e);

            return ['strong' => [], 'weak' => []];
        }
    }

    /** @return list<array<string, mixed>> */
    private function notes(User $student): array
    {
        return CoordinatorNote::query()
            ->where('student_id', $student->id)
            ->with('author:id,name')
            ->latest('id')
            ->limit(15)
            ->get()
            ->map(fn (CoordinatorNote $n) => [
                'kind' => $n->kind,
                'body' => $n->body,
                'author' => $n->author?->name,
                'at' => $n->created_at?->toIso8601String(),
                'follow_up_on' => $n->follow_up_on?->toDateString(),
                'resolved' => $n->resolved_at !== null,
            ])
            ->all();
    }

    /**
     * The "in one minute" paragraph: what is going well, what needs attention, what to do next. Every line is a rule over the
     * numbers above — nothing is estimated, and a section with nothing to say contributes nothing.
     *
     * @return array{strengths: list<string>, concerns: list<string>, actions: list<string>, verdict: string}
     */
    private function narrative(array $d): array
    {
        $h = $d['headline'];
        $s = $d['student'];
        $strengths = [];
        $concerns = [];
        $actions = [];

        if ($h['tier'] === 'Placement Ready') {
            $strengths[] = "Placement ready: readiness {$h['readiness']}/100, above the Vault line of {$d['readiness']['trend_summary']['threshold']}.";
        }
        if (($d['readiness']['trend_summary']['change_7d'] ?? 0) >= 3) {
            $strengths[] = 'Readiness is climbing: +'.$d['readiness']['trend_summary']['change_7d'].' points in the last 7 days.';
        }
        if ($h['streak'] >= 7) {
            $strengths[] = "On a {$h['streak']}-day practice streak (best {$h['best_streak']}).";
        }
        if (($h['acceptance_rate'] ?? 0) >= 60 && $h['submissions'] >= 10) {
            $strengths[] = "{$h['acceptance_rate']}% of {$h['submissions']} code submissions are accepted.";
        }
        if (($d['coding']['solved']['hard']['solved'] ?? 0) >= 3) {
            $strengths[] = $d['coding']['solved']['hard']['solved'].' hard problems solved.';
        }
        if (($h['interview_average'] ?? 0) >= 70) {
            $strengths[] = "AI interview average {$h['interview_average']}% across {$h['interviews_completed']} completed sitting(s).";
        }
        if (($h['soft_skill_average'] ?? 0) >= 70) {
            $strengths[] = "Soft skills average {$h['soft_skill_average']}%.";
        }
        if ($d['conduct']['clean'] && ($d['conduct']['contest_sittings'] > 0 || $h['interviews_completed'] > 0)) {
            $strengths[] = 'Clean exam record: no proctoring strikes or lock-outs.';
        }

        if (! ($s['activated'] ?? true)) {
            $concerns[] = 'Has never signed in: the account is still on its emailed one-time password.';
            $actions[] = 'Ask the student to sign in and set a password (or resend their login from the roster).';
        }
        if ($h['tier'] === 'Needs Training') {
            $concerns[] = "Readiness is {$h['readiness']}/100 — in the Needs Training band.";
        }
        if (($d['readiness']['trend_summary']['change_7d'] ?? 0) <= -3) {
            $concerns[] = 'Readiness fell '.abs($d['readiness']['trend_summary']['change_7d']).' points in the last 7 days.';
            $actions[] = 'Check in: a falling score usually means practice stopped.';
        }
        if (($s['activated'] ?? true) && $h['active_days_30'] === 0) {
            $concerns[] = 'No practice activity in the last 30 days.';
            $actions[] = 'Set a small daily target (one problem a day) and follow up in a week.';
        }
        if (($s['backlogs'] ?? 0) > 0) {
            $concerns[] = "{$s['backlogs']} active backlog(s) on record; many drives cap backlogs.";
        }
        if (($h['acceptance_rate'] ?? 100) < 35 && $h['submissions'] >= 10) {
            $concerns[] = "Only {$h['acceptance_rate']}% of submissions are accepted.";
            $actions[] = 'Review the weakest topics below before attempting harder problems.';
        }
        if ($h['interviews_completed'] === 0) {
            $actions[] = 'Take a first Mock AI Interview — it is the strongest signal recruiters ask about.';
        } elseif (($h['interview_average'] ?? 100) < 50) {
            $concerns[] = "AI interview average is {$h['interview_average']}%.";
            $actions[] = 'Practise answering aloud: structure answers as claim, reason, example.';
        }
        if ($d['conduct']['total_violations'] > 0) {
            $concerns[] = $d['conduct']['total_violations'].' proctoring strike(s)'.($d['conduct']['total_lockouts'] > 0 ? ' and '.$d['conduct']['total_lockouts'].' lock-out(s)' : '').' recorded.';
        }

        foreach (array_slice($d['readiness']['next_steps'], 0, 3) as $step) {
            $actions[] = $step;
        }
        foreach (array_slice($d['coding']['topics_weak'], 0, 2) as $t) {
            $actions[] = "Revise {$t['topic']} (accuracy {$t['accuracy']}%).";
        }

        $verdict = match (true) {
            $h['tier'] === 'Placement Ready' => 'Ready to be put forward for drives.',
            $h['tier'] === 'In Progress' => 'Making progress; a few focused weeks from placement-ready.',
            default => 'Needs structured support before drives.',
        };

        return [
            'strengths' => array_values(array_unique($strengths)),
            'concerns' => array_values(array_unique($concerns)),
            'actions' => array_slice(array_values(array_unique($actions)), 0, 6),
            'verdict' => $verdict,
        ];
    }
}
