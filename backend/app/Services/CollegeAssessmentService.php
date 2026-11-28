<?php

namespace App\Services;

use App\Models\College;
use App\Models\CollegeAssessment;
use App\Models\CollegeAssessmentAssignment;
use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\ContestProblem;
use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewQuestionBank;
use App\Models\InterviewSession;
use App\Models\Problem;
use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillAssessmentQuestion;
use App\Models\SoftSkillQuestion;
use App\Models\SoftSkillSession;
use App\Models\User;
use App\Services\Mock\MockInterviewCatalog;
use App\Services\Vault\CuratedCatalog;
use App\Support\BranchCatalog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Unified SuperAdmin College Assessment orchestrator:
 * composes Soft Skills + Coding Contest + AI Interview into one targeted
 * assessment (college-wise, branch/department-wise, and student-wise),
 * syncs live module scores into `college_assessment_assignments`, and
 * streams CSV reports.
 */
class CollegeAssessmentService
{
    public function __construct(
        private readonly CuratedCatalog $curatedCatalog,
        private readonly MockInterviewCatalog $mockCatalog,
    ) {}

    /**
     * Lightweight builder catalog for SuperAdmin UI:
     * colleges, departments/branches, soft skill sets & bank, coding problems,
     * and curated/mock AI interview sets + question bank.
     *
     * @return array<string, mixed>
     */
    public function builderOptions(): array
    {
        $colleges = College::query()
            ->withCount(['users as students_count' => fn ($q) => $q->where('role', User::ROLE_USER)])
            ->orderBy('name')
            ->get(['id', 'name', 'short_code', 'city'])
            ->map(fn (College $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'short_code' => $c->short_code,
                'city' => $c->city,
                'students_count' => (int) $c->students_count,
                'departments' => $c->departmentCodes(),
            ])
            ->values()
            ->all();

        $catalog = BranchCatalog::instance();
        $departments = array_values(array_map(fn (array $d) => [
            'code' => $d['code'],
            'name' => $d['name'],
            'short' => $d['short'],
        ], $catalog->departments()));

        $branches = array_values(array_map(fn (array $b) => [
            'code' => $b['code'],
            'name' => $b['name'],
            'short' => $b['short'] ?? $b['name'],
            'discipline_code' => $b['discipline_code'],
            'department_code' => $catalog->departmentOfDiscipline($b['discipline_code']) ?? 'engineering',
        ], $catalog->branches()));

        $softSkillSets = SoftSkillAssessment::questionSets()
            ->where('status', SoftSkillAssessment::STATUS_PUBLISHED)
            ->withCount('assessmentQuestions')
            ->orderByRaw('question_set_number is null')
            ->orderBy('question_set_number')
            ->orderBy('id')
            ->get(['id', 'title', 'slug', 'description', 'question_set_number'])
            ->map(fn (SoftSkillAssessment $s) => [
                'id' => $s->id,
                'title' => $s->title,
                'slug' => $s->slug,
                'set_number' => $s->question_set_number,
                'description' => $s->description,
                'questions_count' => (int) $s->assessment_questions_count,
            ])
            ->values()
            ->all();

        $softSkillQuestions = collect(['aptitude', 'reasoning', 'english', 'situational', 'logical', 'quantitative', 'verbal'])
            ->flatMap(fn (string $cat) => SoftSkillQuestion::query()
                ->where('is_active', true)
                ->where('category', $cat)
                ->orderByDesc('id')
                ->limit(80)
                ->get(['id', 'category', 'difficulty', 'question_text']))
            ->unique('id')
            ->map(fn (SoftSkillQuestion $q) => [
                'id' => $q->id,
                'category' => $q->category,
                'difficulty' => $q->difficulty,
                'question_text' => $q->question_text,
            ])
            ->values()
            ->all();

        $problems = Problem::indexCatalog();

        $curatedSets = [];
        foreach ($this->curatedCatalog->summaryRoles() as $roleKey => $role) {
            foreach ($role['stacks'] ?? [] as $stackKey => $stack) {
                foreach ($stack['series'] ?? [] as $series) {
                    foreach ($series['sets'] ?? [] as $set) {
                        $count = (int) ($set['question_count'] ?? 0);
                        if ($count <= 0) {
                            continue;
                        }
                        $curatedSets[] = [
                            'id' => $set['id'],
                            'title' => "{$stack['name']} · Series {$series['series_number']} · {$set['title']}",
                            'role_title' => $role['title'],
                            'stack_key' => (string) $stackKey,
                            'stack_name' => $stack['name'],
                            'series_number' => (int) $series['series_number'],
                            'set_number' => (int) $set['set_number'],
                            'question_count' => $count,
                            'preview_questions' => $set['preview_questions'] ?? [],
                        ];
                    }
                }
            }
        }

        $mockRounds = [];
        foreach ($this->mockCatalog->summaryRoles() as $roleKey => $role) {
            foreach ($role['stacks'] ?? [] as $stackKey => $stack) {
                $parentSets = $stack['parent_sets'] ?? null;
                if (! empty($parentSets)) {
                    foreach ($parentSets as $pset) {
                        foreach ($pset['rounds'] ?? [] as $round) {
                            $count = $this->mockCatalog->roundQuestionCount($round);
                            if ($count <= 0) {
                                continue;
                            }
                            $mockRounds[] = [
                                'id' => $round['id'],
                                'title' => "{$stack['name']} · {$pset['title']} · {$round['title']}",
                                'role_title' => $role['title'],
                                'stack_name' => $stack['name'],
                                'question_count' => $count,
                            ];
                        }
                    }
                } else {
                    foreach ($stack['rounds'] ?? [] as $round) {
                        $count = $this->mockCatalog->roundQuestionCount($round);
                        if ($count <= 0) {
                            continue;
                        }
                        $mockRounds[] = [
                            'id' => $round['id'],
                            'title' => "{$stack['name']} · {$round['title']}",
                            'role_title' => $role['title'],
                            'stack_name' => $stack['name'],
                            'question_count' => $count,
                        ];
                    }
                }
            }
        }

        $interviewBank = InterviewQuestionBank::query()
            ->where('is_active', true)
            ->orderByRaw("case when category in ('hr','behavioral','situational') then 0 else 1 end")
            ->orderBy('discipline')
            ->orderBy('id')
            ->limit(1000)
            ->get(['id', 'question_text', 'category', 'difficulty', 'discipline', 'expected_duration_seconds'])
            ->map(fn (InterviewQuestionBank $q) => [
                'id' => $q->id,
                'question_text' => $q->question_text,
                'category' => $q->category,
                'difficulty' => $q->difficulty,
                'discipline' => $q->discipline,
                'expected_duration_seconds' => $q->expected_duration_seconds,
            ])
            ->values()
            ->all();

        return [
            'colleges' => $colleges,
            'departments' => $departments,
            'branches' => $branches,
            'soft_skill_sets' => $softSkillSets,
            'soft_skill_questions' => $softSkillQuestions,
            'problems' => $problems,
            'curated_interview_sets' => $curatedSets,
            'mock_interview_rounds' => $mockRounds,
            'interview_question_bank' => $interviewBank,
        ];
    }

    /**
     * Students matching college/department/branch/search filters for SuperAdmin picker.
     *
     * @param  array<string, mixed>  $filters
     * @return array{students: list<array<string, mixed>>, total: int}
     */
    public function studentsForTarget(array $filters): array
    {
        $query = $this->matchingStudentsQuery($filters)
            ->with('college:id,name,short_code')
            ->orderBy('name')
            ->orderBy('id');

        $total = (clone $query)->count();
        $limit = max(1, min(1000, (int) ($filters['limit'] ?? 500)));

        $students = $query->limit($limit)
            ->get(['id', 'name', 'email', 'roll_number', 'college_id', 'department', 'branch', 'branch_code', 'graduation_year'])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'roll_number' => $u->roll_number,
                'college_id' => $u->college_id,
                'college_name' => $u->college?->name,
                'college_code' => $u->college?->short_code,
                'department' => $u->department,
                'branch' => $u->branch,
                'branch_code' => $u->branch_code,
                'graduation_year' => $u->graduation_year,
            ])
            ->values()
            ->all();

        return [
            'students' => $students,
            'total' => $total,
        ];
    }

    /**
     * Create or update a CollegeAssessment, provisioning its child SoftSkillAssessment,
     * Contest, and Interview records and syncing target student assignments.
     *
     * @param  array<string, mixed>  $data
     */
    public function save(User $actor, array $data, ?CollegeAssessment $existing = null): CollegeAssessment
    {
        $includeSoft = (bool) ($data['include_soft_skills'] ?? false);
        $includeCoding = (bool) ($data['include_coding'] ?? false);
        $includeInterview = (bool) ($data['include_interview'] ?? false);

        if (! $includeSoft && ! $includeCoding && ! $includeInterview) {
            throw ValidationException::withMessages([
                'modules' => ['Select at least one assessment module (Soft Skills, Coding Test, or AI Interview).'],
            ]);
        }

        [$wSoft, $wCoding, $wInterview] = $this->normalizeWeights(
            $includeSoft,
            (int) ($data['soft_skill_weight'] ?? 0),
            $includeCoding,
            (int) ($data['coding_weight'] ?? 0),
            $includeInterview,
            (int) ($data['interview_weight'] ?? 0)
        );

        $targetScope = $this->normalizeTargetScope($data['target_scope'] ?? []);

        return DB::transaction(function () use (
            $actor,
            $data,
            $existing,
            $includeSoft,
            $includeCoding,
            $includeInterview,
            $wSoft,
            $wCoding,
            $wInterview,
            $targetScope
        ) {
            $assessment = $existing ?? new CollegeAssessment();

            if ($existing === null) {
                $assessment->slug = CollegeAssessment::uniqueSlug($data['title']);
                $assessment->created_by = $actor->id;
                $assessment->status = CollegeAssessment::STATUS_DRAFT;
            }

            $assessment->fill([
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'starts_at' => $data['starts_at'] ?? null,
                'ends_at' => $data['ends_at'] ?? null,
                'enforce_sequence' => (bool) ($data['enforce_sequence'] ?? false),
                'passing_score_percent' => (float) ($data['passing_score_percent'] ?? 60),
                'target_scope' => $targetScope,
                'include_soft_skills' => $includeSoft,
                'soft_skill_weight' => $wSoft,
                'soft_skill_config' => $includeSoft ? ($data['soft_skill_config'] ?? []) : null,
                'include_coding' => $includeCoding,
                'coding_weight' => $wCoding,
                'coding_config' => $includeCoding ? ($data['coding_config'] ?? []) : null,
                'include_interview' => $includeInterview,
                'interview_weight' => $wInterview,
                'interview_config' => $includeInterview ? ($data['interview_config'] ?? []) : null,
            ]);
            $assessment->save();

            if ($includeSoft) {
                $softSkill = $this->provisionSoftSkill($actor, $assessment, $data['soft_skill_config'] ?? []);
                $assessment->soft_skill_assessment_id = $softSkill->id;
            } else {
                $assessment->soft_skill_assessment_id = null;
            }

            if ($includeCoding) {
                $contest = $this->provisionContest($actor, $assessment, $data['coding_config'] ?? []);
                $assessment->contest_id = $contest->id;
            } else {
                $assessment->contest_id = null;
            }

            if ($includeInterview) {
                $interview = $this->provisionInterview($actor, $assessment, $data['interview_config'] ?? []);
                $assessment->interview_id = $interview->id;
            } else {
                $assessment->interview_id = null;
            }

            $assessment->save();

            $this->syncTargetAssignments($assessment, $targetScope);

            if (! empty($data['publish_now']) && $assessment->status === CollegeAssessment::STATUS_DRAFT) {
                $this->publish($assessment);
            }

            return $assessment->fresh([
                'softSkillAssessment:id,slug,title,status,duration_minutes,pass_percentage',
                'contest:id,slug,title,status,start_at,end_at',
                'interview:id,slug,title,status',
            ]);
        });
    }

    public function publish(CollegeAssessment $assessment): CollegeAssessment
    {
        return DB::transaction(function () use ($assessment) {
            if ($assessment->include_soft_skills && $assessment->softSkillAssessment) {
                if (! $assessment->softSkillAssessment->assessmentQuestions()->exists()) {
                    throw ValidationException::withMessages(['soft_skill_config' => ['Add at least one Soft Skill question or question set before publishing.']]);
                }
                $assessment->softSkillAssessment->update(['status' => SoftSkillAssessment::STATUS_PUBLISHED]);
            }

            if ($assessment->include_coding && $assessment->contest) {
                if (! $assessment->contest->contestProblems()->exists()) {
                    throw ValidationException::withMessages(['coding_config' => ['Select at least one coding problem before publishing.']]);
                }
                $assessment->contest->update([
                    'status' => Contest::STATUS_PUBLISHED,
                    'start_at' => $assessment->starts_at ?? $assessment->contest->start_at ?? now()->subMinute(),
                    'end_at' => $assessment->ends_at ?? $assessment->contest->end_at ?? now()->addYear(),
                ]);
            }

            if ($assessment->include_interview && $assessment->interview) {
                if (! $assessment->interview->interviewQuestions()->exists()) {
                    throw ValidationException::withMessages(['interview_config' => ['Select an AI interview set or questions before publishing.']]);
                }
                $assessment->interview->update(['status' => Interview::STATUS_PUBLISHED]);
            }

            $assessment->update([
                'status' => CollegeAssessment::STATUS_PUBLISHED,
                'published_at' => $assessment->published_at ?? now(),
            ]);

            return $assessment->fresh();
        });
    }

    public function close(CollegeAssessment $assessment): CollegeAssessment
    {
        return DB::transaction(function () use ($assessment) {
            $assessment->update(['status' => CollegeAssessment::STATUS_CLOSED]);

            if ($assessment->contest && $assessment->contest->end_at && $assessment->contest->end_at->isFuture()) {
                $assessment->contest->update(['end_at' => now()]);
            }

            return $assessment->fresh();
        });
    }

    public function unpublish(CollegeAssessment $assessment): CollegeAssessment
    {
        return DB::transaction(function () use ($assessment) {
            if ($assessment->softSkillAssessment) {
                $assessment->softSkillAssessment->update(['status' => SoftSkillAssessment::STATUS_DRAFT]);
            }
            if ($assessment->contest) {
                $assessment->contest->update([
                    'status' => Contest::STATUS_DRAFT,
                ]);
            }
            if ($assessment->interview) {
                $assessment->interview->update(['status' => Interview::STATUS_DRAFT]);
            }

            $assessment->update([
                'status' => CollegeAssessment::STATUS_DRAFT,
                'starts_at' => null,
                'ends_at' => null,
                'published_at' => null,
            ]);

            return $assessment->fresh();
        });
    }

    /**
     * Syncs target student rows into `college_assessment_assignments`.
     * Existing rows with progress are preserved; unassigned rows outside the new target
     * are pruned only when `$pruneUnstarted` is true.
     *
     * @param  array<string, mixed>  $targetScope
     */
    public function syncTargetAssignments(CollegeAssessment $assessment, array $targetScope, bool $pruneUnstarted = false): int
    {
        $userIds = $this->resolveTargetUserIds($targetScope);

        foreach ($userIds as $userId) {
            CollegeAssessmentAssignment::firstOrCreate([
                'college_assessment_id' => $assessment->id,
                'user_id' => $userId,
            ]);
        }

        if ($pruneUnstarted) {
            CollegeAssessmentAssignment::query()
                ->where('college_assessment_id', $assessment->id)
                ->where('status', CollegeAssessmentAssignment::STATUS_ASSIGNED)
                ->when($userIds !== [], fn (Builder $q) => $q->whereNotIn('user_id', $userIds))
                ->delete();
        }

        return count($userIds);
    }

    /**
     * Refreshes cached module scores & completion status for every assigned student.
     */
    public function syncProgressForAssessment(CollegeAssessment $assessment): void
    {
        $maxPoints = $assessment->include_coding && $assessment->contest_id
            ? (int) ContestProblem::where('contest_id', $assessment->contest_id)->sum('points')
            : 0;

        $assignments = $assessment->assignments()->get();
        if ($assignments->isEmpty()) {
            return;
        }

        $userIds = $assignments->pluck('user_id')->all();

        $softSessions = $assessment->include_soft_skills && $assessment->soft_skill_assessment_id
            ? SoftSkillSession::with('proctoringSession')
                ->where('soft_skill_assessment_id', $assessment->soft_skill_assessment_id)
                ->whereIn('user_id', $userIds)
                ->orderByDesc('id')
                ->get()
                ->unique('user_id')
                ->keyBy('user_id')
            : collect();

        $contestParticipants = $assessment->include_coding && $assessment->contest_id
            ? ContestParticipant::with('proctoringSession')
                ->where('contest_id', $assessment->contest_id)
                ->whereIn('user_id', $userIds)
                ->get()
                ->keyBy('user_id')
            : collect();

        $contestSubmitterIds = $assessment->include_coding && $assessment->contest_id
            ? DB::table('contest_submissions')
                ->where('contest_id', $assessment->contest_id)
                ->whereIn('user_id', $userIds)
                ->distinct()
                ->pluck('user_id')
                ->flip()
                ->all()
            : [];

        $interviewSessions = $assessment->include_interview && $assessment->interview_id
            ? InterviewSession::with('proctoringSession')
                ->where('interview_id', $assessment->interview_id)
                ->whereIn('user_id', $userIds)
                ->get()
                ->keyBy('user_id')
            : collect();

        foreach ($assignments as $assignment) {
            $uid = $assignment->user_id;
            $soft = $softSessions->get($uid);
            $part = $contestParticipants->get($uid);
            $int = $interviewSessions->get($uid);
            $hasCodingSub = isset($contestSubmitterIds[$uid]);

            $this->applySyncedState($assessment, $assignment, $soft, $part, $maxPoints, $hasCodingSub, $int);
        }
    }

    public function syncAssignment(CollegeAssessmentAssignment $assignment): CollegeAssessmentAssignment
    {
        $assessment = $assignment->assessment;
        $uid = $assignment->user_id;

        $soft = $assessment->include_soft_skills && $assessment->soft_skill_assessment_id
            ? SoftSkillSession::with('proctoringSession')
                ->where('soft_skill_assessment_id', $assessment->soft_skill_assessment_id)
                ->where('user_id', $uid)
                ->orderByDesc('id')
                ->first()
            : null;

        $part = $assessment->include_coding && $assessment->contest_id
            ? ContestParticipant::with('proctoringSession')
                ->where('contest_id', $assessment->contest_id)
                ->where('user_id', $uid)
                ->first()
            : null;

        $maxPoints = $assessment->include_coding && $assessment->contest_id
            ? (int) ContestProblem::where('contest_id', $assessment->contest_id)->sum('points')
            : 0;

        $hasCodingSub = $assessment->include_coding && $assessment->contest_id
            ? DB::table('contest_submissions')
                ->where('contest_id', $assessment->contest_id)
                ->where('user_id', $uid)
                ->exists()
            : false;

        $int = $assessment->include_interview && $assessment->interview_id
            ? InterviewSession::with('proctoringSession')
                ->where('interview_id', $assessment->interview_id)
                ->where('user_id', $uid)
                ->first()
            : null;

        $this->applySyncedState($assessment, $assignment, $soft, $part, $maxPoints, $hasCodingSub, $int);

        return $assignment->fresh();
    }

    /**
     * Returns true if ANY round in this assessment was locked out due to proctoring violations.
     */
    public function isBlockedByProctoring(CollegeAssessmentAssignment $assignment): bool
    {
        $assessment = $assignment->assessment;
        $uid = $assignment->user_id;

        if ($assessment->include_soft_skills && $assessment->soft_skill_assessment_id) {
            $softLocked = SoftSkillSession::where('soft_skill_assessment_id', $assessment->soft_skill_assessment_id)
                ->where('user_id', $uid)
                ->whereHas('proctoringSession', fn ($q) => $q->where('status', 'locked'))
                ->exists();
            if ($softLocked) {
                return true;
            }
        }

        if ($assessment->include_coding && $assessment->contest_id) {
            $partLocked = ContestParticipant::where('contest_id', $assessment->contest_id)
                ->where('user_id', $uid)
                ->whereHas('proctoringSession', fn ($q) => $q->where('status', 'locked'))
                ->exists();
            if ($partLocked) {
                return true;
            }
        }

        if ($assessment->include_interview && $assessment->interview_id) {
            $intLocked = InterviewSession::where('interview_id', $assessment->interview_id)
                ->where('user_id', $uid)
                ->whereHas('proctoringSession', fn ($q) => $q->where('status', 'locked'))
                ->exists();
            if ($intLocked) {
                return true;
            }
        }

        return false;
    }

    /**
     * Module lock state when `enforce_sequence` is enabled or a round was proctoring-blocked.
     *
     * @return array{soft_skills: bool, coding: bool, interview: bool}
     */
    public function moduleLocks(CollegeAssessment $assessment, CollegeAssessmentAssignment $assignment): array
    {
        if ($this->isBlockedByProctoring($assignment)) {
            return ['soft_skills' => true, 'coding' => true, 'interview' => true];
        }

        if (! $assessment->enforce_sequence) {
            return ['soft_skills' => false, 'coding' => false, 'interview' => false];
        }

        $softDone = ! $assessment->include_soft_skills || $assignment->soft_skill_score_percent !== null;
        $codingDone = ! $assessment->include_coding || $assignment->coding_score_percent !== null;

        return [
            'soft_skills' => false,
            'coding' => $assessment->include_soft_skills && ! $softDone,
            'interview' => ($assessment->include_soft_skills && ! $softDone) || ($assessment->include_coding && ! $codingDone),
        ];
    }

    /**
     * Builds filtered assignment rows for SuperAdmin results table & CSV export.
     *
     * @param  array<string, mixed>  $filters
     * @return \Illuminate\Support\Collection<int, CollegeAssessmentAssignment>
     */
    public function filteredAssignments(CollegeAssessment $assessment, array $filters = [])
    {
        $this->syncProgressForAssessment($assessment);

        $passing = (float) $assessment->passing_score_percent;
        $sort = (string) ($filters['sort'] ?? 'overall_desc');

        $query = CollegeAssessmentAssignment::query()
            ->where('college_assessment_id', $assessment->id)
            ->with(['user:id,name,email,roll_number,college_id,department,branch,branch_code,graduation_year', 'user.college:id,name,short_code'])
            ->when(! empty($filters['status']), fn (Builder $q) => $q->where('status', $filters['status']))
            ->when(! empty($filters['college_id']), fn (Builder $q) => $q->whereHas('user', fn (Builder $u) => $u->where('college_id', (int) $filters['college_id'])))
            ->when(! empty($filters['department']), fn (Builder $q) => $q->whereHas('user', fn (Builder $u) => $u->where('department', $filters['department'])))
            ->when(! empty($filters['branch_code']), fn (Builder $q) => $q->whereHas('user', fn (Builder $u) => $u->where('branch_code', $filters['branch_code'])))
            ->when(isset($filters['min_score']) && $filters['min_score'] !== '', fn (Builder $q) => $q->whereNotNull('overall_score_percent')->where('overall_score_percent', '>=', (float) $filters['min_score']))
            ->when(isset($filters['max_score']) && $filters['max_score'] !== '', fn (Builder $q) => $q->whereNotNull('overall_score_percent')->where('overall_score_percent', '<=', (float) $filters['max_score']))
            ->when(($filters['result'] ?? '') === 'pass', fn (Builder $q) => $q->whereNotNull('overall_score_percent')->where('overall_score_percent', '>=', $passing))
            ->when(($filters['result'] ?? '') === 'below_benchmark', fn (Builder $q) => $q->whereNotNull('overall_score_percent')->where('overall_score_percent', '<', $passing))
            ->when(($filters['result'] ?? '') === 'pending', fn (Builder $q) => $q->whereNull('overall_score_percent'))
            ->when(! empty($filters['q']), function (Builder $q) use ($filters) {
                $term = '%'.trim((string) $filters['q']).'%';
                $q->whereHas('user', fn (Builder $u) => $u->where(function (Builder $sub) use ($term) {
                    $sub->where('name', 'like', $term)
                        ->orWhere('email', 'like', $term)
                        ->orWhere('roll_number', 'like', $term);
                }));
            });

        match ($sort) {
            'overall_asc' => $query->orderByRaw('overall_score_percent is null')->orderBy('overall_score_percent'),
            'soft_desc' => $query->orderByDesc('soft_skill_score_percent'),
            'coding_desc' => $query->orderByDesc('coding_score_percent'),
            'interview_desc' => $query->orderByDesc('interview_score_percent'),
            default => $query->orderByDesc('overall_score_percent'),
        };

        return $query->orderBy('id')->get();
    }

    private function applySyncedState(
        CollegeAssessment $assessment,
        CollegeAssessmentAssignment $assignment,
        ?SoftSkillSession $soft,
        ?ContestParticipant $part,
        int $maxPoints,
        bool $hasCodingSub,
        ?InterviewSession $int
    ): void {
        $softDone = ! $assessment->include_soft_skills;
        $softStarted = false;
        $softScore = null;
        if ($assessment->include_soft_skills && $soft) {
            $softStarted = true;
            if ($soft->status === SoftSkillSession::STATUS_COMPLETED) {
                $softDone = true;
                $softScore = (float) ($soft->score_percent ?? 0);
            }
        }

        $codingDone = ! $assessment->include_coding;
        $codingStarted = false;
        $codingPoints = null;
        $codingScore = null;
        if ($assessment->include_coding && $part) {
            $codingStarted = $hasCodingSub || $part->score > 0;
            if ($hasCodingSub || $part->score > 0 || $assessment->isClosed()) {
                $codingPoints = (int) $part->score;
                $codingScore = $maxPoints > 0 ? round(min(100, ($codingPoints / $maxPoints) * 100), 2) : 0.0;
                $codingDone = $hasCodingSub || $part->score > 0;
            }
        }

        $intDone = ! $assessment->include_interview;
        $intStarted = false;
        $intScore = null;
        if ($assessment->include_interview && $int) {
            $intStarted = in_array($int->status, [InterviewSession::STATUS_IN_PROGRESS, InterviewSession::STATUS_COMPLETED], true);
            if ($int->status === InterviewSession::STATUS_COMPLETED) {
                $intDone = true;
                if ($int->composite_score_percent !== null) {
                    $intScore = round((float) $int->composite_score_percent, 2);
                }
            }
        }

        $proctoringBlocked = ($soft?->proctoringSession?->isLocked() ?? false)
            || ($part?->proctoringSession?->isLocked() ?? false)
            || ($int?->proctoringSession?->isLocked() ?? false);

        if ($proctoringBlocked) {
            $startedAt = $assignment->started_at ?? min(array_filter([$soft?->started_at, $part?->registered_at, $int?->started_at, now()]));
            $assignment->update([
                'status' => CollegeAssessmentAssignment::STATUS_COMPLETED,
                'soft_skill_session_id' => $soft?->id,
                'soft_skill_score_percent' => $assessment->include_soft_skills ? 0.0 : null,
                'contest_participant_id' => $part?->id,
                'coding_points' => $assessment->include_coding ? 0 : null,
                'coding_max_points' => $assessment->include_coding ? $maxPoints : null,
                'coding_score_percent' => $assessment->include_coding ? 0.0 : null,
                'interview_session_id' => $int?->id,
                'interview_score_percent' => $assessment->include_interview ? 0.0 : null,
                'overall_score_percent' => 0.0,
                'started_at' => $startedAt,
                'completed_at' => $assignment->completed_at ?? now(),
            ]);

            return;
        }

        $anyStarted = $softStarted || $codingStarted || $intStarted || $assignment->started_at !== null;
        $allCompleted = $softDone && $codingDone && $intDone;

        // Weighted overall score across completed/scored modules when any scored module exists;
        // once all enabled modules are scored, this equals the full weighted sum.
        $weightedSum = 0.0;
        $scoredWeight = 0;
        if ($assessment->include_soft_skills && $softScore !== null) {
            $weightedSum += $softScore * $assessment->soft_skill_weight;
            $scoredWeight += $assessment->soft_skill_weight;
        }
        if ($assessment->include_coding && $codingScore !== null) {
            $weightedSum += $codingScore * $assessment->coding_weight;
            $scoredWeight += $assessment->coding_weight;
        }
        if ($assessment->include_interview && $intScore !== null) {
            $weightedSum += $intScore * $assessment->interview_weight;
            $scoredWeight += $assessment->interview_weight;
        }

        $totalEnabledWeight = ($assessment->include_soft_skills ? $assessment->soft_skill_weight : 0)
            + ($assessment->include_coding ? $assessment->coding_weight : 0)
            + ($assessment->include_interview ? $assessment->interview_weight : 0);

        $overallScore = null;
        if ($scoredWeight > 0) {
            $denom = $allCompleted ? max(1, $totalEnabledWeight) : $scoredWeight;
            $overallScore = round($weightedSum / $denom, 2);
        }

        $status = $allCompleted
            ? CollegeAssessmentAssignment::STATUS_COMPLETED
            : ($anyStarted ? CollegeAssessmentAssignment::STATUS_IN_PROGRESS : CollegeAssessmentAssignment::STATUS_ASSIGNED);

        $startedAt = $assignment->started_at;
        if ($anyStarted && $startedAt === null) {
            $dates = array_filter([$soft?->started_at, $part?->registered_at, $int?->started_at, now()]);
            $startedAt = min($dates);
        }

        $completedAt = $allCompleted ? ($assignment->completed_at ?? now()) : null;

        $assignment->update([
            'status' => $status,
            'soft_skill_session_id' => $soft?->id,
            'soft_skill_score_percent' => $softScore,
            'contest_participant_id' => $part?->id,
            'coding_points' => $codingPoints,
            'coding_max_points' => $assessment->include_coding ? $maxPoints : null,
            'coding_score_percent' => $codingScore,
            'interview_session_id' => $int?->id,
            'interview_score_percent' => $intScore,
            'overall_score_percent' => $overallScore,
            'started_at' => $startedAt,
            'completed_at' => $completedAt,
        ]);
    }

    private function provisionSoftSkill(User $actor, CollegeAssessment $assessment, array $cfg): SoftSkillAssessment
    {
        $test = $assessment->softSkillAssessment;
        $duration = max(5, min(240, (int) ($cfg['duration_minutes'] ?? 30)));
        $passPercent = max(1, min(100, (int) ($cfg['pass_percentage'] ?? 60)));

        if ($test === null) {
            $test = SoftSkillAssessment::create([
                'title' => "{$assessment->title} — Soft Skills",
                'slug' => SoftSkillAssessment::uniqueSlug("{$assessment->title}-soft-skills"),
                'description' => $assessment->description,
                'status' => $assessment->isPublished() ? SoftSkillAssessment::STATUS_PUBLISHED : SoftSkillAssessment::STATUS_DRAFT,
                'assessment_type' => SoftSkillAssessment::TYPE_COLLEGE_ASSESSMENT,
                'duration_minutes' => $duration,
                'pass_percentage' => $passPercent,
                'max_attempts' => 1,
                'created_by' => $actor->id,
            ]);
        } else {
            $test->update([
                'title' => "{$assessment->title} — Soft Skills",
                'description' => $assessment->description,
                'duration_minutes' => $duration,
                'pass_percentage' => $passPercent,
            ]);
        }

        if (! $test->sessions()->exists()) {
            $questionIds = collect((array) ($cfg['question_ids'] ?? []))->map(fn ($id) => (int) $id)->filter()->values()->all();
            $setIds = collect((array) ($cfg['question_set_ids'] ?? []))->map(fn ($id) => (int) $id)->filter()->values()->all();

            if ($setIds !== []) {
                $fromSets = SoftSkillAssessmentQuestion::whereIn('soft_skill_assessment_id', $setIds)
                    ->orderBy('soft_skill_assessment_id')
                    ->orderBy('display_order')
                    ->pluck('soft_skill_question_id')
                    ->all();
                $questionIds = array_values(array_unique(array_merge($fromSets, $questionIds)));
            }

            if ($questionIds === []) {
                throw ValidationException::withMessages(['soft_skill_config' => ['Pick at least one Soft Skill question set or question.']]);
            }

            $validIds = SoftSkillQuestion::whereIn('id', $questionIds)->pluck('id')->all();
            $validSet = array_flip($validIds);
            $ordered = array_values(array_filter($questionIds, fn ($id) => isset($validSet[$id])));

            SoftSkillAssessmentQuestion::where('soft_skill_assessment_id', $test->id)->delete();
            foreach ($ordered as $order => $qid) {
                SoftSkillAssessmentQuestion::create([
                    'soft_skill_assessment_id' => $test->id,
                    'soft_skill_question_id' => $qid,
                    'display_order' => $order,
                ]);
            }
        }

        return $test;
    }

    private function provisionContest(User $actor, CollegeAssessment $assessment, array $cfg): Contest
    {
        $contest = $assessment->contest;
        $startAt = $assessment->starts_at ?? now()->subMinute();
        $endAt = $assessment->ends_at ?? now()->addYear();

        if ($contest === null) {
            $contest = Contest::create([
                'title' => "{$assessment->title} — Coding Test",
                'slug' => Contest::uniqueSlug("{$assessment->title}-coding"),
                'description' => $assessment->description,
                'start_at' => $startAt,
                'end_at' => $endAt,
                'is_rated' => false,
                'status' => $assessment->isPublished() ? Contest::STATUS_PUBLISHED : Contest::STATUS_DRAFT,
                'contest_type' => Contest::CONTEST_TYPE_COLLEGE_ASSESSMENT,
                'created_by' => $actor->id,
            ]);
        } else {
            $contest->update([
                'title' => "{$assessment->title} — Coding Test",
                'description' => $assessment->description,
                'start_at' => $startAt,
                'end_at' => $endAt,
            ]);
        }

        if (! $contest->contestSubmissions()->exists()) {
            $rawProblems = (array) ($cfg['problems'] ?? []);
            if ($rawProblems === [] && ! empty($cfg['problem_ids'])) {
                $rawProblems = array_map(fn ($id) => ['problem_id' => (int) $id, 'points' => 100], (array) $cfg['problem_ids']);
            }

            if ($rawProblems === []) {
                throw ValidationException::withMessages(['coding_config' => ['Pick at least one Coding problem.']]);
            }

            $validProblemIds = Problem::whereIn('id', array_column($rawProblems, 'problem_id'))->pluck('id')->flip()->all();
            ContestProblem::where('contest_id', $contest->id)->delete();

            $order = 0;
            $seen = [];
            foreach ($rawProblems as $item) {
                $pid = (int) ($item['problem_id'] ?? 0);
                if ($pid <= 0 || ! isset($validProblemIds[$pid]) || isset($seen[$pid])) {
                    continue;
                }
                $seen[$pid] = true;
                ContestProblem::create([
                    'contest_id' => $contest->id,
                    'problem_id' => $pid,
                    'points' => max(10, min(1000, (int) ($item['points'] ?? 100))),
                    'display_order' => $order++,
                ]);
            }

            if ($order === 0) {
                throw ValidationException::withMessages(['coding_config' => ['No valid Coding problems were selected.']]);
            }
        }

        return $contest;
    }

    /**
     * Public entry point used by LaunchpadProgramService to upgrade unstarted slot interviews
     * with Vault-calibrated hard questions and reviewer rubrics without altering active attempts.
     *
     * @param  array<string, mixed>  $cfg
     */
    public function refreshSlotInterview(User $actor, CollegeAssessment $assessment, array $cfg): Interview
    {
        return $this->provisionInterview($actor, $assessment, $cfg);
    }

    private function provisionInterview(User $actor, CollegeAssessment $assessment, array $cfg): Interview
    {
        $interview = $assessment->interview;
        $practiceConfig = is_array($cfg['practice_config'] ?? null) ? $cfg['practice_config'] : null;

        if ($interview === null) {
            $interview = Interview::create([
                'title' => "{$assessment->title} — AI Interview",
                'slug' => Interview::uniqueSlug("{$assessment->title}-interview"),
                'description' => $assessment->description,
                'status' => $assessment->isPublished() ? Interview::STATUS_PUBLISHED : Interview::STATUS_DRAFT,
                'interview_type' => Interview::INTERVIEW_TYPE_COLLEGE_ASSESSMENT,
                'is_mock' => false,
                'practice_config' => $practiceConfig,
                'created_by' => $actor->id,
            ]);
        } else {
            $interview->update([
                'title' => "{$assessment->title} — AI Interview",
                'description' => $assessment->description,
                ...($practiceConfig !== null ? ['practice_config' => $practiceConfig] : []),
            ]);
        }

        if (! $interview->sessions()->exists()) {
            $bankIds = [];
            $discipline = (string) ($cfg['discipline'] ?? 'software');

            // 1. From Curated (Vault) AI Interview Sets
            $curatedSetIds = array_values(array_filter(array_map('strval', (array) ($cfg['curated_set_ids'] ?? []))));
            $curatedLimit = isset($cfg['curated_question_limit']) ? max(1, (int) $cfg['curated_question_limit']) : null;
            if ($curatedSetIds !== []) {
                $wanted = array_flip($curatedSetIds);
                $curatedPicked = [];
                foreach ($this->curatedCatalog->roles() as $roleKey => $role) {
                    foreach ($role['stacks'] ?? [] as $stackKey => $stack) {
                        foreach ($this->curatedCatalog->allSets($stack) as $setData) {
                            if (isset($wanted[$setData['id']])) {
                                $setDifficulty = ((int) ($setData['series_number'] ?? 1)) >= 2 || ((int) ($setData['set_number'] ?? 1)) >= 2
                                    ? InterviewQuestionBank::DIFFICULTY_HARD
                                    : InterviewQuestionBank::DIFFICULTY_MEDIUM;
                                foreach ($setData['questions'] ?? [] as $q) {
                                    $curatedPicked[] = $this->resolveBankQuestion(
                                        $actor,
                                        $q + ['difficulty' => $q['difficulty'] ?? $setDifficulty],
                                        [$stackKey, $roleKey],
                                        $discipline
                                    );
                                }
                            }
                        }
                    }
                }
                if ($curatedLimit !== null && count($curatedPicked) > $curatedLimit) {
                    $curatedPicked = array_slice($curatedPicked, 0, $curatedLimit);
                }
                $bankIds = array_merge($bankIds, $curatedPicked);
            }

            // 2. From Mock AI Interview Rounds
            $mockRoundIds = array_values(array_filter(array_map('strval', (array) ($cfg['mock_round_ids'] ?? []))));
            foreach ($mockRoundIds as $roundId) {
                $found = $this->mockCatalog->round($roundId);
                if ($found !== null) {
                    foreach ($found['round']['questions'] ?? [] as $q) {
                        $bankIds[] = $this->resolveBankQuestion($actor, $q, [$found['stack']['key'], $found['role']['key']], $discipline);
                    }
                }
            }

            // 3. Direct InterviewQuestionBank picks
            $pickedBankIds = collect((array) ($cfg['question_bank_ids'] ?? []))->map(fn ($id) => (int) $id)->filter()->values()->all();
            if ($pickedBankIds !== []) {
                $validPicked = InterviewQuestionBank::whereIn('id', $pickedBankIds)->pluck('id')->all();
                $bankIds = array_merge($bankIds, $validPicked);
            }

            // 4. Custom written questions
            foreach ((array) ($cfg['custom_questions'] ?? []) as $cq) {
                $text = trim((string) ($cq['text'] ?? ''));
                if ($text === '') {
                    continue;
                }
                $bankIds[] = $this->resolveBankQuestion($actor, [
                    'text' => $text,
                    'category' => $cq['category'] ?? InterviewQuestionBank::CATEGORY_TECHNICAL,
                    'difficulty' => $cq['difficulty'] ?? InterviewQuestionBank::DIFFICULTY_HARD,
                    'duration_seconds' => (int) ($cq['duration_seconds'] ?? 150),
                    'note' => $cq['note'] ?? null,
                ], ['college-assessment', $discipline], $discipline);
            }

            $bankIds = array_values(array_unique(array_filter($bankIds)));

            if ($bankIds === []) {
                throw ValidationException::withMessages(['interview_config' => ['Pick at least one AI Interview set, round, or question.']]);
            }

            InterviewQuestion::where('interview_id', $interview->id)->delete();
            foreach ($bankIds as $order => $bankId) {
                InterviewQuestion::create([
                    'interview_id' => $interview->id,
                    'interview_question_bank_id' => $bankId,
                    'display_order' => $order,
                ]);
            }
        }

        return $interview;
    }

    /** @param  array<string, mixed>  $q */
    private function resolveBankQuestion(User $actor, array $q, array $tags, string $discipline = 'software'): int
    {
        $text = trim((string) ($q['text'] ?? $q['question_text'] ?? ''));
        $difficulty = in_array($q['difficulty'] ?? '', InterviewQuestionBank::DIFFICULTIES, true)
            ? $q['difficulty']
            : InterviewQuestionBank::DIFFICULTY_MEDIUM;
        $note = $q['note'] ?? $q['notes_for_reviewer'] ?? null;
        $duration = max(30, min(600, (int) ($q['duration_seconds'] ?? $q['expected_duration_seconds'] ?? 150)));

        $bank = InterviewQuestionBank::firstOrCreate(
            ['question_text' => $text, 'discipline' => $discipline],
            [
                'category' => in_array($q['category'] ?? '', InterviewQuestionBank::CATEGORIES, true)
                    ? $q['category']
                    : InterviewQuestionBank::CATEGORY_TECHNICAL,
                'difficulty' => $difficulty,
                'expected_duration_seconds' => $duration,
                'tags' => array_values(array_unique($tags)),
                'notes_for_reviewer' => $note,
                'is_active' => true,
                'created_by' => $actor->id,
            ]
        );

        // Upgrade rubric/difficulty cleanly when curated or Launchpad sets add stronger criteria
        $patch = [];
        if ($note && ! $bank->notes_for_reviewer) {
            $patch['notes_for_reviewer'] = $note;
        }
        if ($difficulty === InterviewQuestionBank::DIFFICULTY_HARD && $bank->difficulty !== InterviewQuestionBank::DIFFICULTY_HARD) {
            $patch['difficulty'] = $difficulty;
        }
        if ($patch !== []) {
            $bank->update($patch);
        }

        return $bank->id;
    }

    /**
     * @param  array<string, mixed>  $raw
     * @return array<string, mixed>
     */
    private function normalizeTargetScope(array $raw): array
    {
        $collegeIds = array_values(array_unique(array_filter(array_map('intval', (array) ($raw['college_ids'] ?? [])))));
        $departmentCodes = array_values(array_unique(array_filter(array_map('strval', (array) ($raw['department_codes'] ?? [])))));
        $branchCodes = array_values(array_unique(array_filter(array_map('strval', (array) ($raw['branch_codes'] ?? [])))));
        $userIds = array_values(array_unique(array_filter(array_map('intval', (array) ($raw['user_ids'] ?? [])))));
        $studentMode = ($raw['student_mode'] ?? 'all_matching') === 'selected' ? 'selected' : 'all_matching';

        return [
            'college_ids' => $collegeIds,
            'department_codes' => $departmentCodes,
            'branch_codes' => $branchCodes,
            'student_mode' => $studentMode,
            'user_ids' => $userIds,
            ...(! empty($raw['allow_empty']) ? ['allow_empty' => true] : []),
        ];
    }

    /**
     * @param  array<string, mixed>  $scope
     * @return list<int>
     */
    private function resolveTargetUserIds(array $scope): array
    {
        if (($scope['student_mode'] ?? 'all_matching') === 'selected') {
            $ids = (array) ($scope['user_ids'] ?? []);
            if ($ids === []) {
                if (! empty($scope['allow_empty'])) {
                    return [];
                }
                throw ValidationException::withMessages(['target_scope' => ['Select at least one student, or switch to "All matching students".']]);
            }

            return User::where('role', User::ROLE_USER)
                ->whereIn('id', $ids)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
        }

        if (empty($scope['college_ids'])) {
            throw ValidationException::withMessages(['target_scope' => ['Select at least one college to assign this assessment.']]);
        }

        $ids = $this->matchingStudentsQuery($scope)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if ($ids === []) {
            throw ValidationException::withMessages(['target_scope' => ['No students matched the selected college / branch filters.']]);
        }

        return $ids;
    }

    /** @param  array<string, mixed>  $filters */
    private function matchingStudentsQuery(array $filters): Builder
    {
        $collegeIds = array_values(array_unique(array_filter(array_map('intval', (array) ($filters['college_ids'] ?? [])))));
        $departmentCodes = array_values(array_unique(array_filter(array_map('strval', (array) ($filters['department_codes'] ?? [])))));
        $branchCodes = array_values(array_unique(array_filter(array_map('strval', (array) ($filters['branch_codes'] ?? [])))));
        $search = trim((string) ($filters['q'] ?? ''));

        return User::query()
            ->where('role', User::ROLE_USER)
            ->when($collegeIds !== [], fn (Builder $q) => $q->whereIn('college_id', $collegeIds))
            ->when($departmentCodes !== [], fn (Builder $q) => $q->whereIn('department', $departmentCodes))
            ->when($branchCodes !== [], fn (Builder $q) => $q->whereIn('branch_code', $branchCodes))
            ->when($search !== '', function (Builder $q) use ($search) {
                $term = "%{$search}%";
                $q->where(function (Builder $sub) use ($term) {
                    $sub->where('name', 'like', $term)
                        ->orWhere('email', 'like', $term)
                        ->orWhere('roll_number', 'like', $term)
                        ->orWhere('branch', 'like', $term);
                });
            });
    }

    /** @return array{0: int, 1: int, 2: int} */
    private function normalizeWeights(
        bool $incSoft,
        int $wSoft,
        bool $incCoding,
        int $wCoding,
        bool $incInterview,
        int $wInterview
    ): array {
        $enabled = [];
        if ($incSoft) {
            $enabled['soft'] = max(0, $wSoft);
        }
        if ($incCoding) {
            $enabled['coding'] = max(0, $wCoding);
        }
        if ($incInterview) {
            $enabled['interview'] = max(0, $wInterview);
        }

        $sum = array_sum($enabled);
        if ($sum <= 0) {
            $count = count($enabled);
            $base = intdiv(100, $count);
            $rem = 100 - ($base * $count);
            foreach (array_keys($enabled) as $idx => $key) {
                $enabled[$key] = $base + ($idx === 0 ? $rem : 0);
            }
        } elseif ($sum !== 100) {
            $keys = array_keys($enabled);
            $scaled = [];
            $running = 0;
            foreach ($keys as $i => $key) {
                if ($i === count($keys) - 1) {
                    $scaled[$key] = max(0, 100 - $running);
                } else {
                    $val = (int) round(($enabled[$key] / $sum) * 100);
                    $scaled[$key] = $val;
                    $running += $val;
                }
            }
            $enabled = $scaled;
        }

        return [
            $enabled['soft'] ?? 0,
            $enabled['coding'] ?? 0,
            $enabled['interview'] ?? 0,
        ];
    }
}
