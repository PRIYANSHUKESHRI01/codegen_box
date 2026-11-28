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
use App\Services\Vault\CuratedCatalog;
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
            ->when(! empty($filters['user_id']), fn (Builder $q) => $q->where('user_id', (int) $filters['user_id']))
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
        $assignments = CollegeAssessmentAssignment::query()
            ->with([
                'softSkillSession.proctoringSession',
                'contestParticipant.proctoringSession',
                'interviewSession.proctoringSession',
            ])
            ->whereIn('college_assessment_id', $slotIds)
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
                    'blocked_by_proctoring' => $a1 ? $this->assessments->isBlockedByProctoring($a1) : false,
                    'overall_score_percent' => $a1?->overall_score_percent,
                    'soft_skill_score_percent' => $a1?->soft_skill_score_percent,
                    'coding_score_percent' => $a1?->coding_score_percent,
                    'interview_score_percent' => $a1?->interview_score_percent,
                ],
                'assessment_2' => [
                    'set' => $enr->assessment_2_set,
                    'status' => $a2?->status ?? 'assigned',
                    'blocked_by_proctoring' => $a2 ? $this->assessments->isBlockedByProctoring($a2) : false,
                    'overall_score_percent' => $a2?->overall_score_percent,
                    'soft_skill_score_percent' => $a2?->soft_skill_score_percent,
                    'coding_score_percent' => $a2?->coding_score_percent,
                    'interview_score_percent' => $a2?->interview_score_percent,
                ],
                'assessment_3' => [
                    'set' => $enr->assessment_3_set,
                    'status' => $a3?->status ?? 'assigned',
                    'blocked_by_proctoring' => $a3 ? $this->assessments->isBlockedByProctoring($a3) : false,
                    'overall_score_percent' => $a3?->overall_score_percent,
                    'soft_skill_score_percent' => $a3?->soft_skill_score_percent,
                    'coding_score_percent' => $a3?->coding_score_percent,
                    'interview_score_percent' => $a3?->interview_score_percent,
                ],
            ];
        }

        $minReadiness = isset($filters['min_readiness']) && $filters['min_readiness'] !== '' ? (float) $filters['min_readiness'] : null;
        $maxReadiness = isset($filters['max_readiness']) && $filters['max_readiness'] !== '' ? (float) $filters['max_readiness'] : null;
        $minAvg = isset($filters['min_avg_score']) && $filters['min_avg_score'] !== '' ? (float) $filters['min_avg_score'] : null;
        $maxAvg = isset($filters['max_avg_score']) && $filters['max_avg_score'] !== '' ? (float) $filters['max_avg_score'] : null;
        $qualification = (string) ($filters['qualification'] ?? '');

        $rows = array_values(array_filter($rows, function (array $row) use ($minReadiness, $maxReadiness, $minAvg, $maxAvg, $qualification) {
            if ($minReadiness !== null && $row['readiness_score'] < $minReadiness) {
                return false;
            }
            if ($maxReadiness !== null && $row['readiness_score'] > $maxReadiness) {
                return false;
            }
            if ($minAvg !== null && ($row['program_avg_score'] === null || $row['program_avg_score'] < $minAvg)) {
                return false;
            }
            if ($maxAvg !== null && ($row['program_avg_score'] === null || $row['program_avg_score'] > $maxAvg)) {
                return false;
            }
            if ($qualification === 'fully_qualified' && ! $row['fully_qualified']) {
                return false;
            }
            if ($qualification === 'readiness_ready' && ! $row['readiness_qualified']) {
                return false;
            }
            if ($qualification === 'below_benchmark' && $row['fully_qualified']) {
                return false;
            }

            return true;
        }));

        $sort = (string) ($filters['sort'] ?? '');
        if ($sort !== '') {
            usort($rows, function (array $a, array $b) use ($sort) {
                return match ($sort) {
                    'avg_desc' => ($b['program_avg_score'] ?? -1) <=> ($a['program_avg_score'] ?? -1),
                    'avg_asc' => ($a['program_avg_score'] ?? 999) <=> ($b['program_avg_score'] ?? 999),
                    'readiness_desc' => $b['readiness_score'] <=> $a['readiness_score'],
                    'readiness_asc' => $a['readiness_score'] <=> $b['readiness_score'],
                    default => $a['enrollment_id'] <=> $b['enrollment_id'],
                };
            });
        }

        $scoredRows = array_values(array_filter($rows, fn ($r) => $r['program_avg_score'] !== null));

        return [
            'summary' => [
                'enrolled' => count($rows),
                'in_progress' => collect($rows)->where('status', LaunchpadProgramEnrollment::STATUS_IN_PROGRESS)->count(),
                'completed' => collect($rows)->where('status', LaunchpadProgramEnrollment::STATUS_COMPLETED)->count(),
                'readiness_qualified' => collect($rows)->where('readiness_qualified', true)->count(),
                'fully_qualified' => collect($rows)->where('fully_qualified', true)->count(),
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
                    'blocked_by_proctoring' => $assignment ? $this->assessments->isBlockedByProctoring($assignment) : false,
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

        // Pull HARD (falling back to medium) Vault-calibrated questions rather than oldest/easy bank entries
        $techHardCuratedSets = $isNonTech ? [] : $this->hardVaultCuratedSetIds();

        $techBankIds = $isNonTech
            ? []
            : InterviewQuestionBank::where('is_active', true)
                ->where('discipline', 'software')
                ->where('difficulty', InterviewQuestionBank::DIFFICULTY_HARD)
                ->orderByDesc('id')
                ->pluck('id')
                ->all();
        if (! $isNonTech && $techBankIds === []) {
            $techBankIds = InterviewQuestionBank::where('is_active', true)
                ->where('discipline', 'software')
                ->whereIn('category', [InterviewQuestionBank::CATEGORY_TECHNICAL, InterviewQuestionBank::CATEGORY_SITUATIONAL])
                ->orderByRaw("case when difficulty = 'hard' then 0 when difficulty = 'medium' then 1 else 2 end")
                ->pluck('id')
                ->all();
        }

        $nonTechBankIds = $isNonTech
            ? InterviewQuestionBank::where('is_active', true)
                ->where(function ($q) {
                    $q->whereIn('category', ['situational', 'behavioral', 'technical', 'aptitude'])
                        ->orWhereIn('discipline', ['bba', 'bcom', 'mba', 'mcom', 'comm_prof', 'economics', 'media_comm']);
                })
                ->where('difficulty', '!=', InterviewQuestionBank::DIFFICULTY_EASY)
                ->orderByRaw("case when difficulty = 'hard' then 0 when difficulty = 'medium' then 1 else 2 end")
                ->pluck('id')
                ->all()
            : [];

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

                // 3. Vault-grade AI Interview config (Tech uses Curated Series 2/3 + hard production scenarios; Non-Tech uses hard case studies)
                $pickedCuratedSets = [];
                $pickedBankIds = [];
                if (! $isNonTech && $techHardCuratedSets !== []) {
                    $pickedCuratedSets[] = $techHardCuratedSets[$sliceIndex % count($techHardCuratedSets)];
                } elseif ($isNonTech && $nonTechBankIds !== []) {
                    $bCount = count($nonTechBankIds);
                    for ($b = 0; $b < min(2, $bCount); $b++) {
                        $pickedBankIds[] = $nonTechBankIds[($sliceIndex * 2 + $b) % $bCount];
                    }
                } elseif (! $isNonTech && $techBankIds !== []) {
                    $bCount = count($techBankIds);
                    for ($b = 0; $b < min(2, $bCount); $b++) {
                        $pickedBankIds[] = $techBankIds[($sliceIndex * 2 + $b) % $bCount];
                    }
                }

                $customPrompts = $this->jdInterviewPrompts($isNonTech, $assessmentNum, $setNum);

                $assessmentPayload = [
                    'title' => "{$program->title} - Assessment {$assessmentNum}",
                    'description' => ($isNonTech
                        ? "Non-Tech Assessment {$assessmentNum} (Set {$setNum}) — Communication, Analytical Aptitude & Case-Based AI Interview. Fully proctored."
                        : "Tech Assessment {$assessmentNum} (Set {$setNum}) — DSA & Web Coding, Soft Skills & Vault-Grade Technical AI Interview. Fully proctored."),
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
                        'curated_set_ids' => $pickedCuratedSets,
                        'curated_question_limit' => 3,
                        'question_bank_ids' => $pickedBankIds,
                        'custom_questions' => $customPrompts,
                        'discipline' => $isNonTech ? 'comm_prof' : 'software',
                        'practice_config' => [
                            'source' => 'launchpad_program',
                            'track' => $isNonTech ? LaunchpadProgram::TRACK_NON_TECH : LaunchpadProgram::TRACK_TECH,
                            'assessment_number' => $assessmentNum,
                            'set_number' => $setNum,
                        ],
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
     * Collects Vault Series 2 & Series 3 (Scalable Implementation & Systems Design / Edge Cases) curated set IDs
     * from `CuratedCatalog` across core software stacks so Tech Launchpad interviews match Vault AI difficulty.
     *
     * @return list<string>
     */
    private function hardVaultCuratedSetIds(): array
    {
        $catalog = app(CuratedCatalog::class);
        $picked = [];
        foreach ($catalog->roles() as $role) {
            foreach ($role['stacks'] ?? [] as $stack) {
                foreach ($catalog->allSets($stack) as $setData) {
                    $seriesNum = (int) ($setData['series_number'] ?? 1);
                    $setNum = (int) ($setData['set_number'] ?? 1);
                    $count = (int) ($setData['question_count'] ?? count($setData['questions'] ?? []));
                    if ($count >= 3 && ($seriesNum >= 2 || $setNum === 3) && ! empty($setData['id'])) {
                        $picked[] = (string) $setData['id'];
                    }
                }
            }
        }

        return array_values(array_unique($picked));
    }

    /**
     * Upgrades all unstarted slot interviews in an existing Launchpad program (or all published/draft programs)
     * to the latest Vault-calibrated hard Tech / Non-Tech interview questions without touching active/completed sessions.
     */
    public function refreshUnstartedSlotInterviews(?LaunchpadProgram $program = null, ?User $actor = null): int
    {
        $actor ??= User::where('role', User::ROLE_SUPERADMIN)->first() ?? User::first();
        if (! $actor) {
            return 0;
        }

        $programs = $program ? collect([$program]) : LaunchpadProgram::with('slots.assessment.interview')->get();
        $updated = 0;

        foreach ($programs as $prog) {
            $prog->loadMissing('slots.assessment.interview');
            $isNonTech = $prog->track === LaunchpadProgram::TRACK_NON_TECH;
            $curatedPool = $isNonTech ? [] : $this->hardVaultCuratedSetIds();
            $nonTechPool = $isNonTech
                ? InterviewQuestionBank::where('is_active', true)
                    ->where(function ($q) {
                        $q->whereIn('category', ['situational', 'behavioral', 'technical', 'aptitude'])
                            ->orWhereIn('discipline', ['bba', 'bcom', 'mba', 'mcom', 'comm_prof', 'economics', 'media_comm']);
                    })
                    ->where('difficulty', '!=', InterviewQuestionBank::DIFFICULTY_EASY)
                    ->orderByRaw("case when difficulty = 'hard' then 0 when difficulty = 'medium' then 1 else 2 end")
                    ->pluck('id')
                    ->all()
                : [];

            foreach ($prog->slots as $slot) {
                $ca = $slot->assessment;
                $iv = $ca?->interview;
                if (! $ca || ! $iv || $iv->sessions()->exists()) {
                    continue;
                }

                $sliceIndex = (($slot->assessment_number - 1) * 3) + ($slot->set_number - 1);
                $pickedCurated = ! $isNonTech && $curatedPool !== []
                    ? [$curatedPool[$sliceIndex % count($curatedPool)]]
                    : [];
                $pickedBankIds = [];
                if ($isNonTech && $nonTechPool !== []) {
                    $bCount = count($nonTechPool);
                    for ($b = 0; $b < min(2, $bCount); $b++) {
                        $pickedBankIds[] = $nonTechPool[($sliceIndex * 2 + $b) % $bCount];
                    }
                }

                $cfg = $ca->interview_config ?? [];
                $cfg['curated_set_ids'] = $pickedCurated;
                $cfg['curated_question_limit'] = 3;
                $cfg['question_bank_ids'] = $pickedBankIds;
                $cfg['custom_questions'] = $this->jdInterviewPrompts($isNonTech, (int) $slot->assessment_number, (int) $slot->set_number);
                $cfg['discipline'] = $isNonTech ? 'comm_prof' : 'software';
                $cfg['practice_config'] = [
                    'source' => 'launchpad_program',
                    'track' => $isNonTech ? LaunchpadProgram::TRACK_NON_TECH : LaunchpadProgram::TRACK_TECH,
                    'assessment_number' => (int) $slot->assessment_number,
                    'set_number' => (int) $slot->set_number,
                ];

                $ca->update(['interview_config' => $cfg]);
                $this->assessments->refreshSlotInterview($actor, $ca, $cfg);
                $updated++;
            }
        }

        return $updated;
    }

    /**
     * Returns 3 hardcore Vault-calibrated production / strategy prompts (with explicit Gemini reviewer rubrics)
     * per (Assessment 1..3, Set 1..3), paired alongside 3 Vault Curated questions for Tech (6 total)
     * or tough bank scenarios for Non-Tech (5-6 total).
     *
     * @return list<array{text: string, category: string, difficulty: string, duration_seconds: int, note: string}>
     */
    private function jdInterviewPrompts(bool $isNonTech, int $assessmentNum, int $setNum): array
    {
        if (! $isNonTech) {
            $bank = [
                1 => [
                    1 => [
                        ['text' => 'Walk through how you would design and debug a distributed flash-sale inventory lock across MySQL and Redis so two concurrent checkouts can never oversell the final unit even under node crashes or lock timeouts.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must contrast pessimistic row locks (SELECT FOR UPDATE), atomic Redis Lua/DECR + DB optimistic version column, lock TTL expiry hazards, and idempotent rollback on crash.'],
                        ['text' => 'Given a dashboard query scanning 12 million submission rows that degrades p99 latency to 4 seconds, how do you inspect the execution plan, design covering composite indexes, and avoid killing INSERT throughput?', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must discuss EXPLAIN ANALYZE (seq scan vs index-only scan, cardinality/column order, composite index prefix rule, B-tree page splits/write amplification) and summary/materialized tables.'],
                        ['text' => 'Explain the memory and execution model behind JavaScript/Node async closures, microtask vs macrotask starvation, and how you track down a slow heap leak in a live React + API process.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must explain Promise/microtask queue starvation blocking event loop ticks/timers, retained DOM/closure references, Chrome DevTools heap snapshots, and Allocation Timeline diffing.'],
                    ],
                    2 => [
                        ['text' => 'Design a multi-tenant rate limiter and sliding-window burst protector across stateless API servers without split-brain inaccuracies or single-key Redis hotspots.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must cover Redis sorted-set or sliding-window counter with Lua atomicity, fail-open vs fail-closed trade-offs on Redis outage, local L1 token cache + sharded keys for hot tenants.'],
                        ['text' => 'In a Next.js + React data-heavy workspace, how do you diagnose Hydration mismatches, waterfall server/client fetches, and expensive state re-renders without breaking SEO or auth state?', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must explain SSR/CSR nondeterministic tree divergence, React Profiler commit causes, parallel RSC/Promise.all data fetching, memoization boundaries, and key stability.'],
                        ['text' => 'Compare Zero-Downtime Blue/Green migrations when renaming or splitting a live production SQL column under active read/write traffic.', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must describe expand-and-contract pattern: additive nullable column -> dual-write triggers/app code -> chunked backfill -> switch reads -> drop legacy constraint cleanly.'],
                    ],
                    3 => [
                        ['text' => 'Your S3 direct-upload pipeline and webhook consumer begin failing selectively under 500 concurrent candidates with connection pool exhaustion and duplicate jobs. Walk through root-cause isolation and architecture fixes.', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must identify pre-signed S3 URL offloading vs backend proxy blocking workers, PgBouncer/MySQL max_connections tuning, idempotent queue job keys, backoff + DLQ handling.'],
                        ['text' => 'How do you architect Refresh Token Rotation with reuse detection across Next.js SSR, API middleware, and concurrent browser tabs so a stolen token immediately invalidates the token family without falsely logging out active users?', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must cover HttpOnly Secure SameSite cookies, single-flight refresh lock across parallel tab requests (grace window vs replay detection), token family revocation on reuse detection.'],
                        ['text' => 'Compare consistency vs latency trade-offs between Write-Through, Cache-Aside with stampede locking, and Asynchronous Outbox invalidation in high-read leaderboards or assessment scoring.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must address thundering herd / singleflight mutex leases on cache miss, transactional outbox pattern for reliable async propagation, and stale-read bounds.'],
                    ],
                ],
                2 => [
                    1 => [
                        ['text' => 'Design an end-to-end async code-judging pipeline handling untrusted user code execution, queue priority lanes, sandbox memory/fork-bomb isolation, and duplicate retry safety.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must discuss cgroups/seccomp/namespaces or Firecracker container limits, non-root readonly mounts, network egress blocking, separate priority worker queues, idempotency job tokens.'],
                        ['text' => 'Walk through how B-Tree indexes fail on high-cardinality UUID primary keys vs monotonic IDs/UUIDv7, and how cursor-based keyset pagination eliminates O(N) OFFSET degradation.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must cover random UUID B-tree page splits/buffer pool cache churn, UUIDv7 timestamp ordering, and keyset (WHERE id > last_id) deterministic stability under concurrent inserts.'],
                        ['text' => 'Describe the hardest production race condition or silent data-corruption bug you diagnosed: what observability signals proved the hypothesis and what invariant guarantees prevented recurrence?', 'category' => 'behavioral', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Look for concrete distributed/state concurrency root cause, log/trace/metrics correlation, DB constraints or locking fix, and regression test coverage.'],
                    ],
                    2 => [
                        ['text' => 'Explain how Deadlock detection works in InnoDB/PostgreSQL, why consistent lock ordering prevents circular waits, and how you design idempotent retry loops on serialization failures.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must cover lock wait graphs, acquiring row locks in sorted primary-key order, catching SQLSTATE 40001/1213 with bounded jittered retries inside stateless transactions.'],
                        ['text' => 'How would you eliminate N+1 queries, memory bloat, and blocking serialization when generating a CSV + JSON analytics export for 100,000+ student records cleanly?', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must explain eager loading / SQL aggregation in DB instead of PHP/JS loops, chunkById or cursor streaming, HTTP StreamedResponse chunked output, and memory O(1) bounds.'],
                        ['text' => 'Contrast CORS preflight security, SameSite cookie CSRF defense, CSP headers against stored XSS, and parameterized AST execution for preventing multi-vector web exploits.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must clearly separate XSS vs CSRF vs SQLi trust boundaries, why CORS is browser-enforced (not server auth), strict CSP/nonce/sanitization, and why HttpOnly stops XSS cookie exfiltration.'],
                    ],
                    3 => [
                        ['text' => 'Compare WebSockets, Server-Sent Events (SSE), and HTTP long-polling at 20,000 concurrent connections: connection memory footprint, load-balancer sticky state, and backpressure recovery.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must discuss file descriptors/epolled sockets, Redis Pub/Sub cross-node fanout, SSE auto-reconnect with Last-Event-ID vs bi-directional WebSocket heartbeats and client jitter.'],
                        ['text' => 'If a client submits the same state-changing webhook or checkout request twice while a slow downstream payment call is still in flight, how do you implement database-backed idempotency keys safely?', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must explain unique idempotency key constraint + IN_PROGRESS lock state, returning cached response on duplicate retry, request payload hash validation, and expiry cleanup.'],
                        ['text' => 'What trade-offs determine whether you split a modular monolith into separate microservices versus keeping transactional boundaries in one database with async domain jobs?', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must evaluate distributed transaction cost (Saga/2PC overhead), network latency vs independent scaling/deployment isolation, schema coupling, and operational observability burden.'],
                    ],
                ],
                3 => [
                    1 => [
                        ['text' => 'Architect a real-time proctored exam telemetry system tracking sequence integrity, tamper-evident hash chains, offline/reconnection gaps, and server-side state authority even if the browser devtools are manipulated.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must explain cryptographic hash-chain event logs (prev_hash + seq), server-side monotonicity verification, server timestamps & silent-gap penalties, and gating answer endpoints on live heartbeats.'],
                        ['text' => 'Given a third-party AI scoring API experiencing sporadic 429 rate limits and 15-second tail latencies, design a fault-tolerant key-rotation pool, circuit breaker, and graceful async recovery queue.', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must address round-robin key health state (RPM vs RPD cooldown TTLs), model tier cascade, non-blocking job queues, idempotent retries, and honest degraded UI status without fake data.'],
                        ['text' => 'Tell me about a high-stakes architectural disagreement you navigated with technical benchmarks or failure-mode proofs rather than opinion.', 'category' => 'behavioral', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must demonstrate rigorous quantitative benchmarking/profiling, evaluating latency/cost/maintainability trade-offs objectively, and concrete production outcome.'],
                    ],
                    2 => [
                        ['text' => 'Explain PostgreSQL/MySQL MVCC isolation levels (Read Committed vs Repeatable Read vs Serializable), phantom reads, and how write-skew occurs even under Snapshot Isolation.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must explain snapshot timestamps/undo logs, lost update vs write skew across two disjoint rows invariant, and mitigation via SELECT FOR UPDATE or Serializable locks.'],
                        ['text' => 'Design a low-latency semantic search + RBAC-filtered catalog query across 500,000 documents ensuring users never retrieve unauthorized records in top-K vector/SQL results.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must distinguish pre-filtering vs post-filtering recall collapse, partition/index scoping by tenant/role, cache invalidation on ACL changes, and latency SLAs.'],
                        ['text' => 'How do you enforce contract safety and zero breaking deploys between a TypeScript Next.js frontend and Laravel/Node REST APIs across parallel feature teams?', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must address strict DTO/OpenAPI schemas, additive backward-compatible API versioning, contract/integration CI checks before deployment, and feature flags.'],
                    ],
                    3 => [
                        ['text' => 'Walk through designing a distributed job scheduler guaranteeing at-least-once cron execution across 4 worker containers without duplicate triggers or lost schedules after container restarts.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must cover leader election or atomic DB lease (`next_run_at` compare-and-swap / `SKIP LOCKED`), heartbeat renewal, fencing tokens, and idempotent downstream consumers.'],
                        ['text' => 'Analyze how CDN edge caching, stale-while-revalidate headers, HTTP ETags, and database read replicas work together — and which endpoints must strictly bypass caches.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must separate public cacheable assets vs personalized/authenticated state, read-your-own-writes lag on replicas, Cache-Control `private, no-store` on sensitive/exam routes.'],
                        ['text' => 'Looking at a legacy codebase with flaky tests, tight coupling, and slow deployments, how do you prioritize incremental refactoring while delivering weekly roadmap milestones?', 'category' => 'behavioral', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must articulate strangler-fig/seam refactoring, high-ROI integration tests around critical revenue/security paths first, and measurable velocity metrics.'],
                    ],
                ],
            ];

            return $bank[$assessmentNum][$setNum];
        }

        $nonTechBank = [
            1 => [
                1 => [
                    ['text' => 'Case Study: A Tier-1 college Placement Officer says "We already use an assessment vendor and have zero bandwidth to onboard another platform this semester." Deliver your exact objection-handling structure, ROI proof points, and pilot close ask.', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must address zero-migration friction, verifiable anti-cheating/employer readiness signal differentiation, low-risk scoped pilot proposal, and specific decision-maker next step.'],
                    ['text' => 'You are given 500 leads from a campus drive: 40% never answer calls, 30% drop off during video onboarding verification, and your weekly conversion target is 18%. Diagnose the funnel stages and build a daily execution playbook.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must cover multi-channel cadence (WhatsApp/SMS pre-warm + peak time windows), pre-call objection resolution, CRM SLA tagging, and measurable conversion math (target = 90 verified conversions).'],
                    ['text' => 'Tell me about a high-pressure negotiation or skeptical stakeholder conversation where your initial pitch failed, what root cause you identified, and how you flipped the outcome.', 'category' => 'behavioral', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must demonstrate structured STAR reasoning, uncovering hidden stakeholder objection, concrete pivot in framing/evidence, and quantified result.'],
                    ['text' => 'Walk through how you design Product UAT test matrices for a multi-step onboarding workflow involving camera permissions, OTP timeouts, slow 3G mobile networks, and incomplete KYC retries.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must specify boundary/negative cases, state recovery across refreshes, telemetry/error capture steps for devs, and objective release go/no-go gates.'],
                ],
                2 => [
                    ['text' => 'Case Study: You spent ₹60,000 on Meta and LinkedIn ads across 2 weeks. Meta CPL is ₹45 with 8% test-completion rate; LinkedIn CPL is ₹140 with 38% completion rate. Calculate effective cost per completed candidate and defend your exact Week 3 budget reallocation.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Math check: Meta cost/completed = 45/0.08 = ₹562.50; LinkedIn cost/completed = 140/0.38 = ₹368.42. LinkedIn is ~35% cheaper on true CAC despite higher raw CPL; candidate must identify funnel quality optimization + retargeting.'],
                    ['text' => 'A key partner college TPO calls angrily 2 hours before an assessment window because 45 eligible students report account verification delays. Outline your hour-by-hour crisis communication, engineering escalation, and SLA recovery.', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must cover immediate transparent acknowledgement, structured bug/data triage (batch CSV IDs, repro steps), contingency window buffer, proactive student comms, and post-mortem fix.'],
                    ['text' => 'Design a repeatable outbound B2B sequence (LinkedIn + cold email + cold call) targeting VP HR / Campus Recruitment leads at mid-market SaaS firms. Include hook hypothesis, follow-up cadence, and disqualification criteria.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must articulate ICP pain hook (screening noise/fake assessments), 5-7 touch multi-modal cadence, value drops, and BANT/MEDDIC qualification guardrails.'],
                    ['text' => 'Describe a time you spotted a silent operational bottleneck before management noticed it, built a tracking dashboard or SOP without being asked, and quantified the time or revenue saved.', 'category' => 'behavioral', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Look for proactive ownership, root-cause metrics, cross-team SOP adoption, and quantified impact.'],
                ],
                3 => [
                    ['text' => 'Case Study: 1,200 students registered for a Mellow Vault Launchpad campaign, 680 opened Soft Skills, only 290 started Coding, and 160 finished AI Interview. Pinpoint the highest-leverage drop-off, form hypotheses, and design A/B recovery experiments.', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Largest absolute/relative leak is Soft Skills -> Coding (57% drop) + Interview (45% drop). Must hypothesize friction (proctoring re-prompts, anxiety, reminders, timing) and propose controlled WhatsApp/UI/UX experiments with sample metrics.'],
                    ['text' => 'When building executive CRM & analytics trackers across 15 colleges, how do you enforce data hygiene across reps, define lead-aging SLAs, and audit forecast accuracy weekly?', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must define mandatory stage exit criteria, automated validation rules, weighted pipeline stages vs optimistic guesses, and cohort aging alerts.'],
                    ['text' => 'An enterprise hiring partner threatens to cancel a renewal unless given a 40% discount citing a cheaper competitor. How do you audit their utilization data and negotiate a value-preserving outcome?', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must avoid reflexive discounting: diagnose under-adoption/value perception, anchor on cost-per-verified-hire & screening hours saved, offer structured volume/multi-quarter tiers instead of flat price slash.'],
                    ['text' => 'Compare Organic Content / SEO / Campus Ambassador distribution vs Paid Acquisition for early-stage B2B2C talent platforms over a 90-day horizon.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must contrast CAC payback velocity vs compounding marginal cost, attribution lags, viral K-factor loops via college cohorts, and channel mix sequencing.'],
                ],
            ],
            2 => [
                1 => [
                    ['text' => 'Case Study: Launchpad engagement drops sharply on Day 3 of a 5-day sprint for Non-Tech students. Design an automated + high-touch lifecycle nudge architecture (WhatsApp, email, coordinator calls) tailored by behavioral segment.', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must segment users cleanly (not-started vs stuck mid-stage vs proctoring-blocked), define trigger timing, personalized copy hooks, opt-out hygiene, and uplift control measurement.'],
                    ['text' => 'Explain Attribution Modeling challenges across Instagram Reels, LinkedIn Thought Leadership, Campus WhatsApp forwards, and Direct Web traffic inside GA4 — and how you avoid double-counting conversions.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must explain UTM discipline, first-click vs data-driven attribution, dark social direct traffic distortion, and self-reported attribution validation.'],
                    ['text' => 'During an onboarding call with a hesitant candidate in a non-English speaking region, how do you diagnose genuine technical anxiety vs lack of intent within the first 3 minutes and convert them?', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Look for bilingual empathy, active diagnostic questions, clear low-friction live screen guidance, and decisive timeboxing on low-intent leads.'],
                    ['text' => 'Walk through a failed campaign, project, or partnership you owned end-to-end. What early leading indicators did you miss and what systematic check did you introduce afterward?', 'category' => 'behavioral', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Requires radical accountability (no blaming teammates), analytical breakdown of leading vs lagging metrics, and durable process change.'],
                ],
                2 => [
                    ['text' => 'Case Study: Engineering has capacity for only ONE Q3 sprint feature — either (A) Automated WhatsApp deadline reminders or (B) TPO Bulk Score CSV Export + Filtering. Use an explicit prioritization framework (RICE/ICE + revenue/retention impact) to defend your call.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must evaluate Reach, Impact, Confidence, Effort cleanly, tie each option to immediate business bottleneck (completion rate vs placement partner trust), and address trade-off mitigation for the deferred item.'],
                    ['text' => 'Paid landing page traffic surged 55% week-over-week after a viral reel, but signup-to-assessment start rate fell from 62% to 24%. Conduct a systematic funnel diagnosis across acquisition intent, UX latency, and messaging mismatch.', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must check audience quality shift (clickbait/broad targeting vs intent), mobile page-load/CORS errors, promise-to-landing copy mismatch, and cohort segmentation in GA4.'],
                    ['text' => 'You manage 4 parallel campus drives in one week alongside 60 daily outbound calls and two product bug escalations. Walk through your exact prioritization triage and escalation rules.', 'category' => 'behavioral', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must separate urgent revenue/live-drive blockers vs scheduled batch blocks, delegate/automate status updates, and avoid dropped SLAs.'],
                    ['text' => 'How do you write crisp acceptance criteria and reproduction bug tickets for backend/frontend engineers so sprint velocity never stalls on back-and-forth clarification?', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must specify environment/device/user role, exact API status/network console logs, Given-When-Then acceptance criteria, and edge cases.'],
                ],
                3 => [
                    ['text' => 'Case Study: Competitor X offers free mock tests to colleges while Mellow Vault focuses on verified employer-ready Talent Vault placement outcomes. Build a competitive battlecard and objection rebuttal script for partner meetings.', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must position verified signal vs unproctored noise, direct recruiter hiring access (Vault outcomes), cost-of-cheating brand damage, and measurable college placement KPIs.'],
                    ['text' => 'Walk through Unit Economics of a campus acquisition program: given ₹18,000 rep salary + ₹12,000 ad spend yielding 240 qualified assessments and 14 paid recruiter hires at ₹8,000 revenue each, compute payback and identify sensitivity levers.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Math: Total cost = ₹30,000; Revenue = 14 * ₹8,000 = ₹1,12,000 (3.73x gross ROAS, ₹125/qualified candidate, ₹2,143 CAC/hire). Must identify completion-to-hire conversion as strongest sensitivity lever.'],
                    ['text' => 'A hiring client wants custom assessment weights and urgent manual overrides outside standard policy 4 hours before campus rollout. How do you balance client delight against platform fairness and operational SLA?', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must distinguish flexible config vs non-negotiable integrity/fairness guardrails, negotiate scoped alternatives transparently, and document sign-off cleanly.'],
                    ['text' => 'Describe a time you had to influence a technical or senior stakeholder without formal authority using structured data and customer insights.', 'category' => 'behavioral', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Look for clear evidence synthesis, speaking the stakeholder language (engineering cost/risk or revenue impact), and measurable result.'],
                ],
            ],
            3 => [
                1 => [
                    ['text' => 'Case Study: You must onboard and verify 400 final-year students across 4 geographically spread colleges within a strict 5-day launch window. Present your day-by-day critical path, bottleneck mitigation, and real-time KPI command sheet.', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must sequence bulk data import/TPO alignment (Day 1), tiered high-touch onboarding waves (Day 2-3), escalation sprints for blocked/laggard segments (Day 4), cutoff lock & verification audit (Day 5).'],
                    ['text' => 'How do you audit whether an onboarding team is hitting activity targets (100 calls/day) while harming conversion quality vs executing high-converting consultative discovery?', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must link input activity metrics with stage conversion rates (talk-to-complete, 7-day retention/drop-off, call QA rubrics) to spot gaming/spam outreach.'],
                    ['text' => 'Imagine launching Launchpad 2026 into an unfamiliar city with zero prior TPO relationships. Design your first 14-day zero-to-one market entry and anchor-partner win strategy.', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must cover ICP college tiering, warm/alumni/recruiter demand leverage (reverse-pitching real jobs), anchor case study design, and rapid follow-up cadence.'],
                    ['text' => 'Tell us about an ambiguous, under-resourced initiative you took from zero structure to predictable execution.', 'category' => 'behavioral', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Look for structured decomposition of ambiguity, fast scrappy MVP validation, repeatable SOPs, and quantified output.'],
                ],
                2 => [
                    ['text' => 'Case Study: Two weeks post-launch, 30% of Non-Tech students fail the proctoring check or exit mid-interview due to mic/environment confusion, risking college partner dissatisfaction. Lead the cross-functional fix across Ops, Support, and Product.', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must separate preventable UX friction vs genuine violations, quantify drop-off error codes, deploy instant Ops pre-flight guides + propose high-impact product telemetry/UI fixes cleanly.'],
                    ['text' => 'How would you design a 30-day multi-channel B2B & student marketing calendar pairing employer case studies, webinar funnels, and retargeting loops with strict weekly ROI checkpoints?', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must align TOFU/MOFU/BOFU assets cleanly, track conversion checkpoints per week, enforce kill-criteria on underperforming creatives, and repurpose top-performing angles.'],
                    ['text' => 'Describe a conflict between Sales/Growth promising an aggressive timeline and Product/Ops flagging quality risks. How did you broker an honest, metrics-backed resolution?', 'category' => 'behavioral', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Look for balanced commercial + operational judgment, scope phasing (MVP now vs Phase 2), and preserving partner trust without burning engineering/ops.'],
                    ['text' => 'What frameworks do you use to turn qualitative call recordings and rejection transcripts into high-impact landing-page and script improvements?', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must outline systematic objection tagging, frequency weighting, verbatim customer language reuse in copy, and measured before/after conversion testing.'],
                ],
                3 => [
                    ['text' => 'Case Study: You notice 60% of high-scoring Non-Tech finalists have strong English fluency yet struggle with quantitative business cases (CPL/conversion math) during recruiter interviews. Design a 5-day intervention before final placements.', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must propose targeted diagnostic benchmarks, micro-drills on real business case math, calibrated rubric feedback, and cohort readiness uplift validation.'],
                    ['text' => 'Design a partner Health Score combining activation speed, student completion rate, proctoring integrity ratio, and hiring outcomes — and define exact trigger playbooks when a college turns Amber or Red.', 'category' => 'technical', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must specify weighted leading indicators, clear numeric thresholds for Green/Amber/Red, automated alerts, and executive business review playbooks.'],
                    ['text' => 'If a senior decision-maker pushes back mid-meeting claiming "AI interviews feel impersonal for business roles," deliver your crisp evidence-backed counter-argument.', 'category' => 'situational', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must address structured rubric consistency, eliminating recruiter scheduling bias/fatigue, verifiable spoken transcripts + human auditability, and time-to-shortlist compression.'],
                    ['text' => 'Walk through how you decide when to double down on a failing growth/outreach experiment versus killing it quickly — cite a concrete threshold example.', 'category' => 'behavioral', 'difficulty' => 'hard', 'duration_seconds' => 180, 'note' => 'Must distinguish statistically meaningful sample size vs premature panic, isolate execution error vs channel-market mismatch, and state clear pre-committed stop-loss bounds.'],
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
