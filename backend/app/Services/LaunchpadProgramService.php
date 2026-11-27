<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Models\CollegeAssessment;
use App\Models\CollegeAssessmentAssignment;
use App\Models\Contest;
use App\Models\Interview;
use App\Models\InterviewQuestionBank;
use App\Models\LaunchpadProgram;
use App\Models\LaunchpadProgramEnrollment;
use App\Models\LaunchpadProgramSlot;
use App\Models\Problem;
use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillQuestion;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Orchestrates Mellow Vault Multi-Disciplinary Internship & Launchpad Program 2026 campaigns:
 *   - Supports Tech (21 days, 3 assessments x [Soft Skills + Coding + Technical AI Interview])
 *     and Non-Tech (5 days, 3 assessments x [Soft Skills & Aptitude + Role/HR AI Interview]).
 *   - Provisions 9 rotated assessment variants (Assessments 1-3 x Sets 1-3) per program so
 *     questions are jumbled/disjoint across sets AND rotated per student inside every college
 *     (Student A -> Set 1 first, Student B -> Set 2 first, Student C -> Set 3 first).
 *   - Enforces proctoring, syncs readiness scores + assessment scores, triggers deadline
 *     notifications/reminders, and powers SuperAdmin CSV exports.
 */
class LaunchpadProgramService
{
    public function __construct(
        private readonly CollegeAssessmentService $assessments,
        private readonly ReadinessScoreService $readiness,
        private readonly NotificationService $notifications,
    ) {}

    /** @return array<string, mixed> */
    public function defaultsForTrack(string $track): array
    {
        $isNonTech = $track === LaunchpadProgram::TRACK_NON_TECH;

        return [
            'title' => LaunchpadProgram::DEFAULT_CAMPAIGN_TITLE,
            'subtitle' => $isNonTech
                ? 'Non-Tech Track · Onboarding & BD, Digital Marketing, Product Operations (5-Day Sprint)'
                : 'Tech Track · Software Development & Web Engineering Intern-to-PPO (21-Day Sprint)',
            'description' => $isNonTech
                ? '3 proctored assessments testing communication, analytical aptitude, case thinking & domain/HR AI interview. Reach 60%+ Readiness Score and pass all 3 assessments within 5 days to qualify.'
                : '3 proctored assessments combining DSA/Web coding skills, soft skills & technical AI interviews. Reach 60%+ Readiness Score and pass all 3 assessments within 21 days to qualify.',
            'duration_days' => $isNonTech ? 5 : 21,
            'min_readiness_percent' => 60.0,
            'passing_score_percent' => 60.0,
            'enforce_proctoring' => true,
        ];
    }

    /** @param array<string, mixed> $data */
    public function createProgram(User $actor, array $data): LaunchpadProgram
    {
        $track = ($data['track'] ?? LaunchpadProgram::TRACK_TECH) === LaunchpadProgram::TRACK_NON_TECH
            ? LaunchpadProgram::TRACK_NON_TECH
            : LaunchpadProgram::TRACK_TECH;

        $defaults = $this->defaultsForTrack($track);
        $title = trim((string) ($data['title'] ?? $defaults['title'])) ?: $defaults['title'];
        $durationDays = max(1, min(90, (int) ($data['duration_days'] ?? $defaults['duration_days'])));
        $targetScope = $this->normalizeScope($data['target_scope'] ?? []);

        return DB::transaction(function () use ($actor, $data, $track, $defaults, $title, $durationDays, $targetScope) {
            $program = LaunchpadProgram::create([
                'slug' => LaunchpadProgram::uniqueSlug("{$title}-{$track}"),
                'title' => $title,
                'subtitle' => $data['subtitle'] ?? $defaults['subtitle'],
                'description' => $data['description'] ?? $defaults['description'],
                'track' => $track,
                'status' => LaunchpadProgram::STATUS_DRAFT,
                'duration_days' => $durationDays,
                'min_readiness_percent' => (float) ($data['min_readiness_percent'] ?? $defaults['min_readiness_percent']),
                'passing_score_percent' => (float) ($data['passing_score_percent'] ?? $defaults['passing_score_percent']),
                'enforce_proctoring' => (bool) ($data['enforce_proctoring'] ?? true),
                'target_scope' => $targetScope,
                'created_by' => $actor->id,
            ]);

            $this->provisionAllSlots($actor, $program);

            if (! empty($data['publish_now'])) {
                $this->publish($program, $actor, $track, $targetScope);
            } else {
                $this->syncEnrollments($program, $targetScope, pruneUnstarted: true, notifyNew: false);
            }

            return $program->fresh(['slots.assessment']);
        });
    }

    /**
     * Publishes (or republishes with updated track/targeting) a Launchpad Program,
     * starts the live 21-day / 5-day countdown window, rotates Set 1/2/3 across
     * every targeted college cohort, and notifies all enrolled students.
     *
     * @param  array<string, mixed>|null  $targetScope
     */
    public function publish(
        LaunchpadProgram $program,
        User $actor,
        ?string $trackOverride = null,
        ?array $targetScope = null,
        ?int $durationDaysOverride = null
    ): LaunchpadProgram {
        return DB::transaction(function () use ($program, $actor, $trackOverride, $targetScope, $durationDaysOverride) {
            $oldTrack = $program->track;
            $newTrack = $trackOverride !== null && in_array($trackOverride, LaunchpadProgram::TRACKS, true)
                ? $trackOverride
                : $oldTrack;

            $hasProgress = $program->enrollments()
                ->where('status', '!=', LaunchpadProgramEnrollment::STATUS_ENROLLED)
                ->exists();

            if ($newTrack !== $oldTrack && $hasProgress) {
                throw ValidationException::withMessages([
                    'track' => ['Students have already started this program. Create or use a separate program for the other track.'],
                ]);
            }

            $defaults = $this->defaultsForTrack($newTrack);
            $duration = $durationDaysOverride !== null
                ? max(1, min(90, $durationDaysOverride))
                : ($newTrack !== $oldTrack ? (int) $defaults['duration_days'] : (int) $program->duration_days);

            $scope = $targetScope !== null ? $this->normalizeScope($targetScope) : ($program->target_scope ?? $this->normalizeScope([]));
            // Starting from draft or closed (including after Unpublish) always starts a fresh 21d / 5d timer.
            $isFreshStart = $program->status !== LaunchpadProgram::STATUS_PUBLISHED;
            $startsAt = $isFreshStart ? now() : ($program->starts_at ?? now());
            $endsAt = $startsAt->copy()->addDays($duration);

            $program->update([
                'track' => $newTrack,
                'subtitle' => $newTrack !== $oldTrack ? $defaults['subtitle'] : $program->subtitle,
                'description' => $newTrack !== $oldTrack ? $defaults['description'] : $program->description,
                'duration_days' => $duration,
                'target_scope' => $scope,
                'status' => LaunchpadProgram::STATUS_PUBLISHED,
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
                'published_at' => $isFreshStart ? now() : ($program->published_at ?? now()),
            ]);

            if ($newTrack !== $oldTrack || ! $program->slots()->exists()) {
                $this->reprovisionSlots($actor, $program);
            } else {
                $this->syncSlotWindows($program);
            }

            $this->syncEnrollments($program, $scope, pruneUnstarted: true, notifyNew: true);

            return $program->fresh(['slots.assessment']);
        });
    }

    public function close(LaunchpadProgram $program): LaunchpadProgram
    {
        return DB::transaction(function () use ($program) {
            $program->update([
                'status' => LaunchpadProgram::STATUS_CLOSED,
                'ends_at' => $program->ends_at && $program->ends_at->isPast() ? $program->ends_at : now(),
            ]);

            foreach ($program->slots()->with('assessment')->get() as $slot) {
                if ($slot->assessment) {
                    $this->assessments->close($slot->assessment);
                }
            }

            return $program->fresh();
        });
    }

    /**
     * Returns the campaign to draft status and clears starts_at / ends_at
     * so students no longer see it and re-publishing restarts the full timer.
     */
    public function unpublish(LaunchpadProgram $program): LaunchpadProgram
    {
        return DB::transaction(function () use ($program) {
            $program->update([
                'status' => LaunchpadProgram::STATUS_DRAFT,
                'starts_at' => null,
                'ends_at' => null,
                'published_at' => null,
            ]);

            $program->enrollments()->update([
                'starts_at' => null,
                'ends_at' => null,
                'last_reminded_at' => null,
            ]);

            foreach ($program->slots()->with('assessment')->get() as $slot) {
                if ($slot->assessment) {
                    $this->assessments->unpublish($slot->assessment);
                }
            }

            return $program->fresh(['slots.assessment']);
        });
    }

    /**
     * Synchronizes enrolled students for the given target scope using per-college
     * circular Latin-square rotation across Set 1, Set 2, and Set 3:
     *   - College student #1 (offset 0) => [A1: Set 1, A2: Set 2, A3: Set 3]
     *   - College student #2 (offset 1) => [A1: Set 2, A2: Set 3, A3: Set 1]
     *   - College student #3 (offset 2) => [A1: Set 3, A2: Set 1, A3: Set 2]
     *
     * @param  array<string, mixed>  $scope
     */
    public function syncEnrollments(
        LaunchpadProgram $program,
        array $scope,
        bool $pruneUnstarted = false,
        bool $notifyNew = true
    ): int {
        $students = $this->matchingStudentsQuery($scope)
            ->orderBy('college_id')
            ->orderBy('id')
            ->get(['id', 'college_id', 'name', 'email']);

        $slots = $program->slots()->with('assessment')->get()
            ->groupBy('assessment_number')
            ->map(fn (Collection $group) => $group->keyBy('set_number'));

        if ($slots->count() < 3) {
            $this->provisionAllSlots($program->creator ?? User::where('role', User::ROLE_SUPERADMIN)->firstOrFail(), $program);
            $slots = $program->slots()->with('assessment')->get()
                ->groupBy('assessment_number')
                ->map(fn (Collection $group) => $group->keyBy('set_number'));
        }

        $targetIds = $students->pluck('id')->all();

        if ($pruneUnstarted) {
            $stale = $program->enrollments()
                ->where('status', LaunchpadProgramEnrollment::STATUS_ENROLLED)
                ->when($targetIds !== [], fn (Builder $q) => $q->whereNotIn('user_id', $targetIds))
                ->get();

            foreach ($stale as $oldEnrollment) {
                CollegeAssessmentAssignment::whereIn('college_assessment_id', array_filter([
                    $oldEnrollment->assessment_1_id,
                    $oldEnrollment->assessment_2_id,
                    $oldEnrollment->assessment_3_id,
                ]))
                    ->where('user_id', $oldEnrollment->user_id)
                    ->where('status', CollegeAssessmentAssignment::STATUS_ASSIGNED)
                    ->delete();
                $oldEnrollment->delete();
            }
        }

        $existingByUser = $program->enrollments()->get()->keyBy('user_id');

        // Track existing enrollment count per college so newly enrolled students continue rotating evenly
        $collegeCounters = $program->enrollments()
            ->selectRaw('COALESCE(college_id, 0) as cid, COUNT(*) as c')
            ->groupBy('cid')
            ->pluck('c', 'cid')
            ->map(fn ($v) => (int) $v)
            ->all();

        $startsAt = $program->starts_at ?? now();
        $endsAt = $program->ends_at ?? $startsAt->copy()->addDays($program->duration_days);

        $newlyEnrolledUserIds = [];

        foreach ($students as $student) {
            $existing = $existingByUser->get($student->id);
            if ($existing) {
                // Keep window aligned with program schedule
                $existing->update([
                    'starts_at' => $startsAt,
                    'ends_at' => $endsAt,
                ]);
                continue;
            }

            $cid = (int) ($student->college_id ?? 0);
            $seq = $collegeCounters[$cid] ?? 0;
            $collegeCounters[$cid] = $seq + 1;
            $offset = $seq % 3;

            $s1 = (($offset + 0) % 3) + 1;
            $s2 = (($offset + 1) % 3) + 1;
            $s3 = (($offset + 2) % 3) + 1;

            $a1 = $slots->get(1)?->get($s1)?->college_assessment_id;
            $a2 = $slots->get(2)?->get($s2)?->college_assessment_id;
            $a3 = $slots->get(3)?->get($s3)?->college_assessment_id;

            LaunchpadProgramEnrollment::create([
                'launchpad_program_id' => $program->id,
                'user_id' => $student->id,
                'college_id' => $student->college_id,
                'rotation_offset' => $offset,
                'assessment_1_set' => $s1,
                'assessment_2_set' => $s2,
                'assessment_3_set' => $s3,
                'assessment_1_id' => $a1,
                'assessment_2_id' => $a2,
                'assessment_3_id' => $a3,
                'status' => LaunchpadProgramEnrollment::STATUS_ENROLLED,
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
            ]);

            foreach (array_filter([$a1, $a2, $a3]) as $caId) {
                CollegeAssessmentAssignment::firstOrCreate(
                    ['college_assessment_id' => $caId, 'user_id' => $student->id],
                    ['status' => CollegeAssessmentAssignment::STATUS_ASSIGNED]
                );
            }

            $newlyEnrolledUserIds[] = $student->id;
        }

        // Sync target_scope & published state onto each of the 9 slot CollegeAssessments
        foreach ($program->slots()->with('assessment')->get() as $slot) {
            $ca = $slot->assessment;
            if (! $ca) {
                continue;
            }
            $slotUserIds = $program->enrollments()
                ->where("assessment_{$slot->assessment_number}_id", $ca->id)
                ->pluck('user_id')
                ->all();

            $ca->update([
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
                'target_scope' => ['student_mode' => 'selected', 'user_ids' => $slotUserIds],
            ]);

            if ($program->isPublished()) {
                $this->assessments->publish($ca);
            }
        }

        if ($notifyNew && $program->isPublished() && $newlyEnrolledUserIds !== []) {
            $trackLabel = $program->track === LaunchpadProgram::TRACK_NON_TECH ? 'Non-Tech Track (5 Days)' : 'Tech Track (21 Days)';
            $minReadiness = (int) round($program->min_readiness_percent);
            $this->notifications->notifyMany(
                $newlyEnrolledUserIds,
                NotificationType::AssessmentScheduled,
                "Campaign Live: {$program->title}",
                "{$trackLabel} — You have {$program->duration_days} days to complete Assessment 1, 2 & 3 (proctored) and achieve {$minReadiness}%+ Readiness Score to qualify.",
                [
                    'url' => '/dashboard/assessments',
                    'group_key' => "launchpad.enrolled:{$program->id}",
                    'data' => ['program_id' => $program->id, 'track' => $program->track],
                ]
            );
        }

        return $students->count();
    }

    /**
     * Sends deadline & readiness reminders for incomplete enrollments.
     * When `$force = false` (hourly scheduler), notifies once every 24h max and focuses on
     * <= 48h urgent deadlines or unstarted cohorts > 24h after start.
     */
    public function sendDeadlineReminders(?LaunchpadProgram $onlyProgram = null, bool $force = false): int
    {
        $programs = $onlyProgram
            ? collect([$onlyProgram])
            : LaunchpadProgram::where('status', LaunchpadProgram::STATUS_PUBLISHED)->get();

        $totalNotified = 0;

        foreach ($programs as $program) {
            if (! $program->isOpenForTaking()) {
                continue;
            }

            $this->syncProgramProgress($program);

            $enrollments = $program->enrollments()
                ->where('status', '!=', LaunchpadProgramEnrollment::STATUS_COMPLETED)
                ->get();

            if ($enrollments->isEmpty()) {
                continue;
            }

            $endsAt = $program->ends_at ?? now()->addDays($program->duration_days);
            $hoursLeft = max(1, (int) now()->diffInHours($endsAt, false));
            $daysLeft = intdiv($hoursLeft, 24);
            $remHours = $hoursLeft % 24;
            $leftPhrase = $daysLeft > 0 ? "{$daysLeft}d {$remHours}h remaining" : "{$hoursLeft}h remaining";
            $minReadiness = (int) round($program->min_readiness_percent);

            $dueIds = [];
            foreach ($enrollments as $enr) {
                if (! $force) {
                    if ($enr->last_reminded_at !== null && $enr->last_reminded_at->gt(now()->subHours(24))) {
                        continue;
                    }
                    // Automatic reminders fire when <= 72h remain (Tech) / <= 48h remain (Non-Tech), or every 5 days in a 21-day sprint
                    $urgentHours = $program->track === LaunchpadProgram::TRACK_NON_TECH ? 48 : 72;
                    $sinceStartHours = $program->starts_at ? $program->starts_at->diffInHours(now()) : 0;
                    if ($hoursLeft > $urgentHours && $sinceStartHours < 120) {
                        continue;
                    }
                }
                $dueIds[] = $enr->user_id;
            }

            if ($dueIds === []) {
                continue;
            }

            $written = $this->notifications->notifyMany(
                $dueIds,
                NotificationType::AssessmentScheduled,
                "Deadline Reminder ({$leftPhrase}): {$program->title}",
                "Complete Assessment 1, 2 & 3 (proctored) and keep your Readiness Score at {$minReadiness}%+ before {$endsAt->format('d M Y, H:i')} UTC to qualify.",
                [
                    'url' => '/dashboard/assessments',
                    'data' => ['program_id' => $program->id, 'reminder' => true],
                ]
            );

            LaunchpadProgramEnrollment::where('launchpad_program_id', $program->id)
                ->whereIn('user_id', $dueIds)
                ->update(['last_reminded_at' => now()]);

            $totalNotified += $written > 0 ? $written : count($dueIds);
        }

        return $totalNotified;
    }

    /**
     * Syncs all 3 assessment assignment states into `launchpad_program_enrollments.status`.
     */
    public function syncProgramProgress(LaunchpadProgram $program): void
    {
        $slotIds = $program->slots()->pluck('college_assessment_id')->all();
        if ($slotIds === []) {
            return;
        }

        foreach (CollegeAssessment::whereIn('id', $slotIds)->get() as $ca) {
            $this->assessments->syncProgressForAssessment($ca);
        }

        $assignmentsByUserAndAssessment = CollegeAssessmentAssignment::whereIn('college_assessment_id', $slotIds)
            ->get()
            ->groupBy('user_id')
            ->map(fn (Collection $rows) => $rows->keyBy('college_assessment_id'));

        foreach ($program->enrollments()->get() as $enr) {
            $mine = $assignmentsByUserAndAssessment->get($enr->user_id, collect());
            $items = array_filter([
                $mine->get($enr->assessment_1_id),
                $mine->get($enr->assessment_2_id),
                $mine->get($enr->assessment_3_id),
            ]);

            if ($items === []) {
                continue;
            }

            $allDone = count($items) === 3 && collect($items)->every(fn (CollegeAssessmentAssignment $a) => $a->status === CollegeAssessmentAssignment::STATUS_COMPLETED);
            $anyStarted = collect($items)->contains(fn (CollegeAssessmentAssignment $a) => $a->status !== CollegeAssessmentAssignment::STATUS_ASSIGNED);

            $status = $allDone
                ? LaunchpadProgramEnrollment::STATUS_COMPLETED
                : ($anyStarted ? LaunchpadProgramEnrollment::STATUS_IN_PROGRESS : LaunchpadProgramEnrollment::STATUS_ENROLLED);

            if ($enr->status !== $status) {
                $enr->update(['status' => $status]);
            }
        }
    }

    /**
     * Returns lock message if `$assessment` belongs to a Launchpad campaign and the
     * student has not yet completed the preceding assessment in sequence (1 -> 2 -> 3).
     */
    public function campaignLockReasonForAssessment(CollegeAssessment $assessment, User $user): ?string
    {
        $enr = LaunchpadProgramEnrollment::query()
            ->where('user_id', $user->id)
            ->where(function (Builder $q) use ($assessment) {
                $q->where('assessment_1_id', $assessment->id)
                    ->orWhere('assessment_2_id', $assessment->id)
                    ->orWhere('assessment_3_id', $assessment->id);
            })
            ->first();

        if (! $enr) {
            return null;
        }

        if ($assessment->id === $enr->assessment_2_id && $enr->assessment_1_id !== null) {
            $prev = CollegeAssessmentAssignment::where('college_assessment_id', $enr->assessment_1_id)
                ->where('user_id', $user->id)
                ->first();
            if (! $prev || $this->assessments->syncAssignment($prev)->status !== CollegeAssessmentAssignment::STATUS_COMPLETED) {
                return 'Complete Assessment 1 first to unlock Assessment 2.';
            }
        }

        if ($assessment->id === $enr->assessment_3_id && $enr->assessment_2_id !== null) {
            $prev = CollegeAssessmentAssignment::where('college_assessment_id', $enr->assessment_2_id)
                ->where('user_id', $user->id)
                ->first();
            if (! $prev || $this->assessments->syncAssignment($prev)->status !== CollegeAssessmentAssignment::STATUS_COMPLETED) {
                return 'Complete Assessment 2 first to unlock Assessment 3.';
            }
        }

        return null;
    }

    /**
     * SuperAdmin leaderboard / export dataset for a Launchpad Program.
     *
     * @param  array<string, mixed>  $filters
     * @return array{summary: array<string, mixed>, rows: list<array<string, mixed>>}
     */
    public function resultsDataset(LaunchpadProgram $program, array $filters = []): array
    {
        $this->syncProgramProgress($program);

        $enrollments = $program->enrollments()
            ->with(['user:id,name,email,roll_number,college_id,department,branch,branch_code,graduation_year,discipline,track_focus,coding_opt_in', 'college:id,name,short_code'])
            ->when(! empty($filters['college_id']), fn (Builder $q) => $q->where('college_id', (int) $filters['college_id']))
            ->when(! empty($filters['branch_code']), fn (Builder $q) => $q->whereHas('user', fn (Builder $u) => $u->where('branch_code', $filters['branch_code'])))
            ->when(! empty($filters['status']), fn (Builder $q) => $q->where('status', $filters['status']))
            ->when(! empty($filters['q']), function (Builder $q) use ($filters) {
                $term = '%'.trim((string) $filters['q']).'%';
                $q->whereHas('user', fn (Builder $u) => $u->where(function (Builder $sub) use ($term) {
                    $sub->where('name', 'like', $term)
                        ->orWhere('email', 'like', $term)
                        ->orWhere('roll_number', 'like', $term);
                }));
            })
            ->orderBy('id')
            ->get();

        $students = $enrollments->pluck('user')->filter()->values();
        $readinessMap = [];
        if ($students->isNotEmpty()) {
            $computed = $this->readiness->compute($students);
            foreach ($computed as $uid => $res) {
                $readinessMap[$uid] = (float) ($res['breakdown']['score'] ?? 0);
            }
        }

        $slotIds = $program->slots()->pluck('college_assessment_id')->all();
        $assignments = CollegeAssessmentAssignment::whereIn('college_assessment_id', $slotIds)
            ->whereIn('user_id', $students->pluck('id')->all())
            ->get()
            ->groupBy('user_id')
            ->map(fn (Collection $g) => $g->keyBy('college_assessment_id'));

        $rows = [];
        $qualifiedCount = 0;
        $readinessReadyCount = 0;

        foreach ($enrollments as $enr) {
            $u = $enr->user;
            if (! $u) {
                continue;
            }
            $mine = $assignments->get($u->id, collect());
            $a1 = $mine->get($enr->assessment_1_id);
            $a2 = $mine->get($enr->assessment_2_id);
            $a3 = $mine->get($enr->assessment_3_id);

            $scores = array_values(array_filter([
                $a1?->overall_score_percent,
                $a2?->overall_score_percent,
                $a3?->overall_score_percent,
            ], fn ($v) => $v !== null));

            $avgAssessmentScore = $scores !== [] ? round(array_sum($scores) / count($scores), 2) : null;
            $completedCount = collect([$a1, $a2, $a3])->filter(fn ($a) => $a && $a->status === CollegeAssessmentAssignment::STATUS_COMPLETED)->count();
            $readinessPct = $readinessMap[$u->id] ?? 0.0;
            $readinessQualified = $readinessPct >= $program->min_readiness_percent;
            $assessmentsQualified = $completedCount === 3 && $avgAssessmentScore !== null && $avgAssessmentScore >= $program->passing_score_percent;
            $fullyQualified = $readinessQualified && $assessmentsQualified;

            if ($readinessQualified) {
                $readinessReadyCount++;
            }
            if ($fullyQualified) {
                $qualifiedCount++;
            }

            $rows[] = [
                'enrollment_id' => $enr->id,
                'status' => $enr->status,
                'rotation_offset' => $enr->rotation_offset,
                'assessments_completed' => $completedCount,
                'program_avg_score' => $avgAssessmentScore,
                'readiness_score' => $readinessPct,
                'readiness_qualified' => $readinessQualified,
                'fully_qualified' => $fullyQualified,
                'student' => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'roll_number' => $u->roll_number,
                    'department' => $u->department,
                    'branch' => $u->branch,
                    'branch_code' => $u->branch_code,
                    'graduation_year' => $u->graduation_year,
                    'college' => $enr->college ? [
                        'id' => $enr->college->id,
                        'name' => $enr->college->name,
                        'short_code' => $enr->college->short_code,
                    ] : null,
                ],
                'assessment_1' => [
                    'set' => $enr->assessment_1_set,
                    'status' => $a1?->status ?? 'assigned',
                    'overall_score_percent' => $a1?->overall_score_percent,
                    'soft_skill_score_percent' => $a1?->soft_skill_score_percent,
                    'coding_score_percent' => $a1?->coding_score_percent,
                    'interview_score_percent' => $a1?->interview_score_percent,
                ],
                'assessment_2' => [
                    'set' => $enr->assessment_2_set,
                    'status' => $a2?->status ?? 'assigned',
                    'overall_score_percent' => $a2?->overall_score_percent,
                    'soft_skill_score_percent' => $a2?->soft_skill_score_percent,
                    'coding_score_percent' => $a2?->coding_score_percent,
                    'interview_score_percent' => $a2?->interview_score_percent,
                ],
                'assessment_3' => [
                    'set' => $enr->assessment_3_set,
                    'status' => $a3?->status ?? 'assigned',
                    'overall_score_percent' => $a3?->overall_score_percent,
                    'soft_skill_score_percent' => $a3?->soft_skill_score_percent,
                    'coding_score_percent' => $a3?->coding_score_percent,
                    'interview_score_percent' => $a3?->interview_score_percent,
                ],
            ];
        }

        $scoredRows = array_values(array_filter($rows, fn ($r) => $r['program_avg_score'] !== null));

        return [
            'summary' => [
                'enrolled' => count($rows),
                'in_progress' => collect($rows)->where('status', LaunchpadProgramEnrollment::STATUS_IN_PROGRESS)->count(),
                'completed' => collect($rows)->where('status', LaunchpadProgramEnrollment::STATUS_COMPLETED)->count(),
                'readiness_qualified' => $readinessReadyCount,
                'fully_qualified' => $qualifiedCount,
                'avg_program_score' => $scoredRows !== [] ? round(collect($scoredRows)->avg('program_avg_score'), 2) : null,
            ],
            'rows' => $rows,
        ];
    }

    /**
     * Student dashboard view of their active/completed Launchpad Programs + live countdown + readiness.
     *
     * @return list<array<string, mixed>>
     */
    public function studentCampaigns(User $user): array
    {
        $enrollments = LaunchpadProgramEnrollment::query()
            ->where('user_id', $user->id)
            ->whereHas('program', fn (Builder $q) => $q->where('status', '!=', LaunchpadProgram::STATUS_DRAFT))
            ->with([
                'program',
                'assessment1.softSkillAssessment:id,slug,title',
                'assessment1.contest:id,slug,title',
                'assessment1.interview:id,slug,title',
                'assessment2.softSkillAssessment:id,slug,title',
                'assessment2.contest:id,slug,title',
                'assessment2.interview:id,slug,title',
                'assessment3.softSkillAssessment:id,slug,title',
                'assessment3.contest:id,slug,title',
                'assessment3.interview:id,slug,title',
            ])
            ->latest('id')
            ->get();

        if ($enrollments->isEmpty()) {
            return [];
        }

        $readinessScore = (int) ($this->readiness->breakdown($user)['score'] ?? 0);

        return $enrollments->map(function (LaunchpadProgramEnrollment $enr) use ($readinessScore) {
            $p = $enr->program;
            $endsAt = $enr->ends_at ?? $p->ends_at;
            $startsAt = $enr->starts_at ?? $p->starts_at;

            $cards = [];
            $completed = 0;
            $scores = [];
            $prevDone = true;

            foreach ([1, 2, 3] as $num) {
                $ca = $enr->{"assessment{$num}"};
                $setNum = (int) $enr->{"assessment_{$num}_set"};
                if (! $ca) {
                    continue;
                }
                $assignment = CollegeAssessmentAssignment::where('college_assessment_id', $ca->id)
                    ->where('user_id', $enr->user_id)
                    ->first();

                if ($assignment) {
                    $assignment = $this->assessments->syncAssignment($assignment);
                }

                $st = $assignment?->status ?? CollegeAssessmentAssignment::STATUS_ASSIGNED;
                $isDone = $st === CollegeAssessmentAssignment::STATUS_COMPLETED;
                if ($isDone) {
                    $completed++;
                }
                if ($assignment?->overall_score_percent !== null) {
                    $scores[] = (float) $assignment->overall_score_percent;
                }

                $locked = ! $prevDone;
                $lockReason = $locked ? ('Complete Assessment '.($num - 1).' first to unlock Assessment '.$num.'.') : null;
                $prevDone = $isDone;

                $cards[] = [
                    'number' => $num,
                    'set_number' => $setNum,
                    'slug' => $ca->slug,
                    'title' => $ca->title,
                    'status' => $st,
                    'locked' => $locked,
                    'lock_reason' => $lockReason,
                    'overall_score_percent' => $assignment?->overall_score_percent,
                    'soft_skill_score_percent' => $assignment?->soft_skill_score_percent,
                    'coding_score_percent' => $assignment?->coding_score_percent,
                    'interview_score_percent' => $assignment?->interview_score_percent,
                    'include_soft_skills' => (bool) $ca->include_soft_skills,
                    'include_coding' => (bool) $ca->include_coding,
                    'include_interview' => (bool) $ca->include_interview,
                ];
            }

            $avgScore = $scores !== [] ? round(array_sum($scores) / count($scores), 2) : null;
            $readinessMet = $readinessScore >= $p->min_readiness_percent;
            $qualified = $readinessMet && $completed === 3 && $avgScore !== null && $avgScore >= $p->passing_score_percent;

            // Keep enrollment status fresh
            $newStatus = $completed === 3
                ? LaunchpadProgramEnrollment::STATUS_COMPLETED
                : (collect($cards)->contains(fn ($c) => $c['status'] !== CollegeAssessmentAssignment::STATUS_ASSIGNED)
                    ? LaunchpadProgramEnrollment::STATUS_IN_PROGRESS
                    : LaunchpadProgramEnrollment::STATUS_ENROLLED);
            if ($enr->status !== $newStatus) {
                $enr->update(['status' => $newStatus]);
            }

            return [
                'id' => $p->id,
                'slug' => $p->slug,
                'title' => $p->title,
                'subtitle' => $p->subtitle,
                'description' => $p->description,
                'track' => $p->track,
                'status' => $p->status,
                'is_open' => $p->isOpenForTaking(),
                'duration_days' => $p->duration_days,
                'starts_at' => $startsAt?->toIso8601String(),
                'ends_at' => $endsAt?->toIso8601String(),
                'enforce_proctoring' => $p->enforce_proctoring,
                'min_readiness_percent' => $p->min_readiness_percent,
                'passing_score_percent' => $p->passing_score_percent,
                'readiness_score_percent' => $readinessScore,
                'readiness_met' => $readinessMet,
                'assessments_completed' => $completed,
                'assessments_total' => 3,
                'program_avg_score' => $avgScore,
                'qualified' => $qualified,
                'enrollment_status' => $newStatus,
                'assessments' => $cards,
            ];
        })->values()->all();
    }

    private function reprovisionSlots(User $actor, LaunchpadProgram $program): void
    {
        $oldSlots = $program->slots()->with('assessment')->get();
        foreach ($oldSlots as $slot) {
            $slot->delete();
            $slot->assessment?->delete();
        }
        $program->enrollments()->delete();
        $this->provisionAllSlots($actor, $program);
    }

    private function syncSlotWindows(LaunchpadProgram $program): void
    {
        foreach ($program->slots()->with('assessment.contest')->get() as $slot) {
            if ($slot->assessment) {
                $slot->assessment->update([
                    'starts_at' => $program->starts_at,
                    'ends_at' => $program->ends_at,
                ]);
                if ($slot->assessment->contest) {
                    $slot->assessment->contest->update([
                        'start_at' => $program->starts_at ?? now()->subMinute(),
                        'end_at' => $program->ends_at ?? now()->addDays($program->duration_days),
                    ]);
                }
            }
        }
    }

    /**
     * Provisions 3 Assessments x 3 Rotated Question Sets = 9 distinct `CollegeAssessment` records.
     */
    private function provisionAllSlots(User $actor, LaunchpadProgram $program): void
    {
        $isNonTech = $program->track === LaunchpadProgram::TRACK_NON_TECH;

        // Gather pools once so Sets 1, 2, 3 get jumbled / disjoint questions across all 3 slots
        $softSkillSetIds = SoftSkillAssessment::questionSets()
            ->where('status', SoftSkillAssessment::STATUS_PUBLISHED)
            ->orderBy('question_set_number')
            ->orderBy('id')
            ->pluck('id')
            ->all();

        $softBankByCat = [];
        foreach (['aptitude', 'reasoning', 'english', 'situational', 'quantitative', 'logical', 'verbal'] as $cat) {
            $softBankByCat[$cat] = SoftSkillQuestion::where('is_active', true)
                ->where('category', $cat)
                ->orderBy('id')
                ->pluck('id')
                ->all();
        }

        $easyProblems = $isNonTech ? [] : Problem::where('difficulty', 'easy')->orderBy('id')->pluck('id')->all();
        $medProblems = $isNonTech ? [] : Problem::where('difficulty', 'medium')->orderBy('id')->pluck('id')->all();
        $hardProblems = $isNonTech ? [] : Problem::where('difficulty', 'hard')->orderBy('id')->pluck('id')->all();
        if (! $isNonTech && ($easyProblems === [] || $medProblems === [])) {
            $anyProblems = Problem::orderBy('id')->pluck('id')->all();
            if ($easyProblems === []) {
                $easyProblems = $anyProblems;
            }
            if ($medProblems === []) {
                $medProblems = $anyProblems;
            }
        }

        $techBankIds = InterviewQuestionBank::where('is_active', true)
            ->where(function ($q) {
                $q->where('discipline', 'software')->orWhereIn('category', ['hr', 'behavioral', 'situational']);
            })
            ->orderBy('id')
            ->pluck('id')
            ->all();

        $nonTechBankIds = InterviewQuestionBank::where('is_active', true)
            ->where(function ($q) {
                $q->whereIn('category', ['hr', 'behavioral', 'situational', 'aptitude'])
                    ->orWhereIn('discipline', ['bba', 'bcom', 'mba', 'mcom', 'comm_prof', 'economics', 'media_comm']);
            })
            ->orderBy('id')
            ->pluck('id')
            ->all();

        $startsAt = $program->starts_at ?? now();
        $endsAt = $program->ends_at ?? $startsAt->copy()->addDays($program->duration_days);

        for ($assessmentNum = 1; $assessmentNum <= 3; $assessmentNum++) {
            for ($setNum = 1; $setNum <= 3; $setNum++) {
                // Global slice index 0..8 so each of the 9 slots draws a rotated/jumbled question subset
                $sliceIndex = (($assessmentNum - 1) * 3) + ($setNum - 1);

                // 1. Soft Skills config (universal for Tech & Non-Tech)
                $pickedSoftQuestions = [];
                foreach ($softBankByCat as $ids) {
                    if ($ids === []) {
                        continue;
                    }
                    $count = count($ids);
                    for ($k = 0; $k < 3; $k++) {
                        $pickedSoftQuestions[] = $ids[($sliceIndex * 3 + $k) % $count];
                    }
                }
                $pickedSoftQuestions = array_values(array_unique($pickedSoftQuestions));

                $pickedSoftSets = [];
                if ($softSkillSetIds !== []) {
                    $pickedSoftSets[] = $softSkillSetIds[$sliceIndex % count($softSkillSetIds)];
                }

                // Fallback guarantee: if soft bank had fewer questions, ensure non-empty
                if ($pickedSoftQuestions === [] && $pickedSoftSets === []) {
                    $fallbackQ = SoftSkillQuestion::orderBy('id')->limit(5)->pluck('id')->all();
                    $pickedSoftQuestions = $fallbackQ;
                }

                // 2. Coding config (Tech only: 3 problems per assessment)
                $codingProblems = [];
                if (! $isNonTech) {
                    $chosenPids = [];
                    if ($easyProblems !== []) {
                        $chosenPids[] = $easyProblems[$sliceIndex % count($easyProblems)];
                    }
                    if ($medProblems !== []) {
                        $chosenPids[] = $medProblems[($sliceIndex * 2) % count($medProblems)];
                    }
                    $pool3 = $hardProblems !== [] ? $hardProblems : $medProblems;
                    if ($pool3 !== []) {
                        $chosenPids[] = $pool3[($sliceIndex * 2 + 1) % count($pool3)];
                    }
                    $chosenPids = array_values(array_unique($chosenPids));
                    foreach ($chosenPids as $pIdx => $pid) {
                        $codingProblems[] = [
                            'problem_id' => $pid,
                            'points' => $pIdx === 0 ? 50 : ($pIdx === 1 ? 100 : 150),
                        ];
                    }
                }

                // 3. JD-aligned AI Interview config
                $bankPool = $isNonTech ? $nonTechBankIds : $techBankIds;
                $pickedBankIds = [];
                if ($bankPool !== []) {
                    $bCount = count($bankPool);
                    for ($b = 0; $b < min(2, $bCount); $b++) {
                        $pickedBankIds[] = $bankPool[($sliceIndex * 2 + $b) % $bCount];
                    }
                }

                $customPrompts = $this->jdInterviewPrompts($isNonTech, $assessmentNum, $setNum);

                $assessmentPayload = [
                    'title' => "{$program->title} - Assessment {$assessmentNum}",
                    'description' => ($isNonTech
                        ? "Non-Tech Assessment {$assessmentNum} (Set {$setNum}) — Communication, Analytical Aptitude & Role/HR AI Interview. Fully proctored."
                        : "Tech Assessment {$assessmentNum} (Set {$setNum}) — DSA & Web Coding, Soft Skills & Technical AI Interview. Fully proctored."),
                    'starts_at' => $startsAt->toIso8601String(),
                    'ends_at' => $endsAt->toIso8601String(),
                    'enforce_sequence' => false,
                    'passing_score_percent' => $program->passing_score_percent,
                    'publish_now' => false,
                    'include_soft_skills' => true,
                    'soft_skill_weight' => $isNonTech ? 50 : 30,
                    'soft_skill_config' => [
                        'question_set_ids' => $pickedSoftSets,
                        'question_ids' => $pickedSoftQuestions,
                        'duration_minutes' => $isNonTech ? 25 : 20,
                        'pass_percentage' => (int) round($program->passing_score_percent),
                    ],
                    'include_coding' => ! $isNonTech && $codingProblems !== [],
                    'coding_weight' => ! $isNonTech && $codingProblems !== [] ? 40 : 0,
                    'coding_config' => ! $isNonTech && $codingProblems !== [] ? ['problems' => $codingProblems] : null,
                    'include_interview' => true,
                    'interview_weight' => $isNonTech ? 50 : 30,
                    'interview_config' => [
                        'question_bank_ids' => $pickedBankIds,
                        'custom_questions' => $customPrompts,
                    ],
                    'target_scope' => [
                        'student_mode' => 'selected',
                        'user_ids' => [],
                        'allow_empty' => true,
                    ],
                ];

                $collegeAssessment = $this->assessments->save($actor, $assessmentPayload);

                LaunchpadProgramSlot::create([
                    'launchpad_program_id' => $program->id,
                    'assessment_number' => $assessmentNum,
                    'set_number' => $setNum,
                    'college_assessment_id' => $collegeAssessment->id,
                ]);
            }
        }
    }

    /**
     * Returns 3 distinct, non-overlapping industry-standard JD prompts per (Assessment 1..3, Set 1..3).
     *
     * @return list<array{text: string, category: string, difficulty: string, duration_seconds: int}>
     */
    private function jdInterviewPrompts(bool $isNonTech, int $assessmentNum, int $setNum): array
    {
        if (! $isNonTech) {
            $bank = [
                1 => [
                    1 => [
                        ['text' => 'Walk through how you choose between an Array, Hash Map, or Binary Search Tree to optimize time and space complexity.', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                        ['text' => 'Explain OOP encapsulation, polymorphism, and how REST APIs structure status codes and validation cleanly.', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                        ['text' => 'Describe a full-stack or backend bug you debugged end-to-end and what automated test would prevent it.', 'category' => 'behavioral', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ],
                    2 => [
                        ['text' => 'How do database indexes in MySQL/PostgreSQL speed up queries, and what write trade-offs do they introduce?', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                        ['text' => 'Explain recursion vs dynamic programming with a concrete example of overlapping subproblems.', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                        ['text' => 'Tell us about an application performance bottleneck you improved in React, Next.js, Node, or Laravel.', 'category' => 'behavioral', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ],
                    3 => [
                        ['text' => 'How would you use Redis caching and pagination to protect a high-traffic API endpoint from slowing down?', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                        ['text' => 'Compare BFS vs DFS and explain when graph cycle detection or topological sort applies in production systems.', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                        ['text' => 'Why are you excited for a 6-month on-site Software Development / Web Engineering Internship at Mellow Vault?', 'category' => 'hr', 'difficulty' => 'easy', 'duration_seconds' => 90],
                    ],
                ],
                2 => [
                    1 => [
                        ['text' => 'Design a relational schema for an assessment platform tracking users, tests, submissions, and scores with foreign keys.', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                        ['text' => 'How does JWT or Sanctum token authentication work securely across Next.js frontends and REST backends?', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                        ['text' => 'How do you handle a merge conflict or tight sprint deadline when collaborating on Git with teammates?', 'category' => 'behavioral', 'difficulty' => 'easy', 'duration_seconds' => 90],
                    ],
                    2 => [
                        ['text' => 'Explain ACID transactions and race-condition prevention when two users update the same database counter.', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                        ['text' => 'How do you make a responsive Next.js/React dashboard fast, accessible, and cross-browser reliable?', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                        ['text' => 'Share a project you built independently and the key engineering trade-off you had to make.', 'category' => 'behavioral', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ],
                    3 => [
                        ['text' => 'Explain WebSockets / WebRTC vs standard polling and when to offload work into async background queues.', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                        ['text' => 'What is the N+1 query problem in ORMs like Eloquent or Prisma, and how do you eliminate it?', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                        ['text' => 'What feedback from a code review taught you the biggest lesson as a developer?', 'category' => 'hr', 'difficulty' => 'easy', 'duration_seconds' => 90],
                    ],
                ],
                3 => [
                    1 => [
                        ['text' => 'If an API backed by S3 uploads and MySQL starts failing under 500 concurrent requests, how do you diagnose and stabilize it?', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 150],
                        ['text' => 'Explain idempotency in payment webhooks and third-party API integrations so retries never double-charge.', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                        ['text' => 'What monthly engineering habits and KPIs will help you convert this 6-month internship into a PPO?', 'category' => 'hr', 'difficulty' => 'easy', 'duration_seconds' => 90],
                    ],
                    2 => [
                        ['text' => 'Compare SQL joins vs denormalized caching when building an analytics leaderboard for thousands of students.', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                        ['text' => 'How do you structure unit and integration tests before shipping a new REST endpoint?', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                        ['text' => 'Describe a time you took ownership beyond your assigned task to unblock your team.', 'category' => 'behavioral', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ],
                    3 => [
                        ['text' => 'How would you implement rate limiting and sliding-window throttling to prevent API abuse cleanly?', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                        ['text' => 'Explain CORS, CSRF, and SQL injection protections in modern web architecture.', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                        ['text' => 'Where do you want to grow technically over the next 12 months if selected for Mellow Vault?', 'category' => 'hr', 'difficulty' => 'easy', 'duration_seconds' => 90],
                    ],
                ],
            ];

            return $bank[$assessmentNum][$setNum];
        }

        $nonTechBank = [
            1 => [
                1 => [
                    ['text' => 'Pitch Mellow Vault & AptRun in 60 seconds to a college Placement Officer (TPO) who says they already have a portal.', 'category' => 'situational', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ['text' => 'A prospective candidate is hesitant to complete online onboarding over Google Meet. How do you build trust and convert them?', 'category' => 'situational', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ['text' => 'Why are you interested in Onboarding, Business Development, Growth, or Product Operations at Mellow Vault?', 'category' => 'hr', 'difficulty' => 'easy', 'duration_seconds' => 90],
                ],
                2 => [
                    ['text' => 'Imagine launching a Meta & Google Ads campaign with a ₹25,000 budget. How do you evaluate CPL and ROAS after week 1?', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ['text' => 'How would you handle an angry college partner calling about delayed onboarding verification before a drive?', 'category' => 'situational', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ['text' => 'Describe a time you persuaded someone to say yes when their first answer was no.', 'category' => 'behavioral', 'difficulty' => 'medium', 'duration_seconds' => 120],
                ],
                3 => [
                    ['text' => 'Walk through how you maintain daily CRM logs for 60 outbound calls and ensure zero leads slip through the funnel.', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ['text' => 'What checks would you run during User Acceptance Testing (UAT) before launching a new student onboarding page?', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ['text' => 'How do you stay disciplined and motivated in a target-driven KPI environment?', 'category' => 'hr', 'difficulty' => 'easy', 'duration_seconds' => 90],
                ],
            ],
            2 => [
                1 => [
                    ['text' => 'Compare On-Page SEO vs Off-Page SEO and how organic content helps lower Customer Acquisition Cost.', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ['text' => 'You host a 1-on-1 Google Meet onboarding session and the candidate speaks only Hindi while unsure of next steps. How do you lead the call?', 'category' => 'situational', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ['text' => 'Tell us about an event, club, or sales target you organized end-to-end with measurable outcomes.', 'category' => 'behavioral', 'difficulty' => 'medium', 'duration_seconds' => 120],
                ],
                2 => [
                    ['text' => 'If 500 students registered for a campaign but only 180 completed Round 1 in 48 hours, what funnel fixes would you execute?', 'category' => 'situational', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ['text' => 'How would you structure a LinkedIn + cold-call outreach sequence to book demos with HR leaders?', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ['text' => 'Describe a time you managed multiple urgent follow-ups at the same time without missing a deadline.', 'category' => 'behavioral', 'difficulty' => 'medium', 'duration_seconds' => 120],
                ],
                3 => [
                    ['text' => 'How do Google Analytics (GA4) and Google Sheets help compare social campaigns across Instagram, LinkedIn, and YouTube?', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ['text' => 'A sales prospect asks for a heavy discount right after the demo. How do you handle objection and protect value?', 'category' => 'situational', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ['text' => 'What strengths make you a strong fit for client-facing operations and partnership coordination?', 'category' => 'hr', 'difficulty' => 'easy', 'duration_seconds' => 90],
                ],
            ],
            3 => [
                1 => [
                    ['text' => 'Case Study: You must onboard 300 final-year students across 3 branches within 5 days. Outline your day-by-day execution plan.', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 150],
                    ['text' => 'How do you measure quality vs quantity when tracking daily outreach calls and conversion ratios in CRM?', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ['text' => 'Which track appeals to you most — BD/Onboarding, Digital Marketing, or Product Operations — and why?', 'category' => 'hr', 'difficulty' => 'easy', 'duration_seconds' => 90],
                ],
                2 => [
                    ['text' => 'Case Study: A B2B hiring partner wants to compare Competitor A vs Mellow Vault before signing an MOU. How do you present competitive advantages?', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 150],
                    ['text' => 'Explain how clear documentation and cross-team communication between tech and growth prevent launch delays.', 'category' => 'behavioral', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ['text' => 'How do you handle rejection after 15 unsuccessful cold calls in a row?', 'category' => 'hr', 'difficulty' => 'easy', 'duration_seconds' => 90],
                ],
                3 => [
                    ['text' => 'Case Study: Paid ad clicks increased 40% this week, but sign-ups stayed flat. Diagnose the possible landing-page and audience causes.', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 150],
                    ['text' => 'Share a time you took feedback and turned a weak metric into a strong result.', 'category' => 'behavioral', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ['text' => 'How do you see yourself contributing in an on-site, fast-paced Noida team over the next 6 months?', 'category' => 'hr', 'difficulty' => 'easy', 'duration_seconds' => 90],
                ],
            ],
        ];

        return $nonTechBank[$assessmentNum][$setNum];
    }

    /** @param array<string, mixed> $scope */
    private function matchingStudentsQuery(array $scope): Builder
    {
        $collegeIds = array_values(array_filter(array_map('intval', (array) ($scope['college_ids'] ?? []))));
        $deptCodes = array_values(array_filter(array_map('strval', (array) ($scope['department_codes'] ?? []))));
        $branchCodes = array_values(array_filter(array_map('strval', (array) ($scope['branch_codes'] ?? []))));
        $studentMode = ($scope['student_mode'] ?? 'all_matching') === 'selected' ? 'selected' : 'all_matching';
        $userIds = array_values(array_filter(array_map('intval', (array) ($scope['user_ids'] ?? []))));

        $query = User::query()
            ->where('role', User::ROLE_USER);

        if ($studentMode === 'selected') {
            return $userIds !== [] ? $query->whereIn('id', $userIds) : $query->whereRaw('1 = 0');
        }

        if ($collegeIds !== []) {
            $query->whereIn('college_id', $collegeIds);
        }
        if ($deptCodes !== []) {
            $query->whereIn('department', $deptCodes);
        }
        if ($branchCodes !== []) {
            $query->whereIn('branch_code', $branchCodes);
        }

        return $query;
    }

    /** @return array<string, mixed> */
    private function normalizeScope(array $raw): array
    {
        return [
            'college_ids' => array_values(array_unique(array_filter(array_map('intval', (array) ($raw['college_ids'] ?? []))))),
            'department_codes' => array_values(array_unique(array_filter(array_map('strval', (array) ($raw['department_codes'] ?? []))))),
            'branch_codes' => array_values(array_unique(array_filter(array_map('strval', (array) ($raw['branch_codes'] ?? []))))),
            'student_mode' => ($raw['student_mode'] ?? 'all_matching') === 'selected' ? 'selected' : 'all_matching',
            'user_ids' => array_values(array_unique(array_filter(array_map('intval', (array) ($raw['user_ids'] ?? []))))),
        ];
    }
}
