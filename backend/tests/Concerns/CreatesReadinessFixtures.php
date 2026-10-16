<?php

namespace Tests\Concerns;

use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\ContestProblem;
use App\Models\ContestSubmission;
use App\Models\Hackathon;
use App\Models\HackathonParticipant;
use App\Models\HackathonSubmission;
use App\Models\HackathonTeam;
use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\ProjectEnrollment;
use App\Models\ProjectSubmission;
use App\Models\ProjectTopic;
use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillSession;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Real rows for every place a student's readiness comes from, so the readiness
 * and Vault tests exercise the actual queries instead of stubs. Each helper makes
 * exactly one piece of history and says in its name which kind it is — and the
 * `$type` arguments are how a test builds the "a hiring partner posted this"
 * case that must never count.
 */
trait CreatesReadinessFixtures
{
    use CreatesCodingActivityFixtures;

    protected function readinessStudent(array $attributes = []): User
    {
        return User::factory()->create(['role' => User::ROLE_USER] + $attributes);
    }

    protected function scoredInterview(User $student, float $score, string $type = Interview::INTERVIEW_TYPE_GENERAL, ?Carbon $at = null): InterviewSession
    {
        $at ??= now()->subDays(2);

        $interview = Interview::create([
            'title' => 'Interview '.uniqid(), 'slug' => Interview::uniqueSlug('Interview '.uniqid()),
            'status' => Interview::STATUS_PUBLISHED, 'interview_type' => $type, 'is_mock' => true,
        ]);

        return InterviewSession::create([
            'interview_id' => $interview->id, 'user_id' => $student->id, 'status' => InterviewSession::STATUS_COMPLETED,
            'started_at' => $at->copy()->subMinutes(20), 'completed_at' => $at, 'composite_score_percent' => $score, 'ai_scored_at' => $at,
        ]);
    }

    protected function softSkillResult(User $student, float $score, string $type = SoftSkillAssessment::TYPE_GENERAL, ?Carbon $at = null): SoftSkillSession
    {
        $at ??= now()->subDays(2);

        $assessment = SoftSkillAssessment::create([
            'title' => 'Test '.uniqid(), 'slug' => SoftSkillAssessment::uniqueSlug('Test '.uniqid()),
            'status' => SoftSkillAssessment::STATUS_PUBLISHED, 'assessment_type' => $type,
        ]);

        return SoftSkillSession::create([
            'soft_skill_assessment_id' => $assessment->id, 'user_id' => $student->id, 'status' => SoftSkillSession::STATUS_COMPLETED,
            'attempt_number' => 1, 'started_at' => $at->copy()->subMinutes(30), 'completed_at' => $at, 'score_percent' => $score, 'passed' => $score >= 60,
        ]);
    }

    protected function speakingScore(User $student, int $score, ?Carbon $at = null): void
    {
        $at ??= now()->subDays(2);
        $promptId = DB::table('speaking_prompts')->insertGetId([
            'title' => 'Prompt '.uniqid(), 'passage_text' => 'Read this aloud.', 'category' => 'Career Readiness', 'difficulty' => 'beginner',
            'created_at' => $at, 'updated_at' => $at,
        ]);

        DB::table('speaking_attempts')->insert([
            'user_id' => $student->id, 'speaking_prompt_id' => $promptId, 'attempt_number' => 1, 'overall_score' => $score,
            'passed' => $score >= 60, 'scored_at' => $at, 'created_at' => $at, 'updated_at' => $at,
        ]);
    }

    protected function listeningScore(User $student, int $score, ?Carbon $at = null): void
    {
        $at ??= now()->subDays(2);
        $lessonId = DB::table('listening_lessons')->insertGetId([
            'title' => 'Lesson '.uniqid(), 'passage_text' => 'Listen.', 'category' => 'Career Readiness', 'difficulty' => 'beginner',
            'questions' => json_encode([]), 'created_at' => $at, 'updated_at' => $at,
        ]);

        DB::table('listening_attempts')->insert([
            'user_id' => $student->id, 'listening_lesson_id' => $lessonId, 'attempt_number' => 1, 'answers' => json_encode([]),
            'score' => $score, 'passed' => $score >= 60, 'created_at' => $at, 'updated_at' => $at,
        ]);
    }

    protected function vocabularyScore(User $student, int $score, ?Carbon $at = null): void
    {
        $at ??= now()->subDays(2);

        DB::table('vocabulary_attempts')->insert([
            'user_id' => $student->id, 'topic' => 'Everyday words', 'difficulty' => 'beginner', 'questions' => json_encode([]),
            'score' => $score, 'passed' => $score >= 60, 'submitted_at' => $at, 'created_at' => $at, 'updated_at' => $at,
        ]);
    }

    /**
     * A contest that has ended and been finalised. `$results` maps student id =>
     * points scored; whoever is listed submitted something and is ranked. The
     * contest is worth `$totalPoints` in all.
     *
     * @param  array<int, int>  $results
     */
    protected function finishedContest(array $results, string $type = Contest::CONTEST_TYPE_DAILY, int $totalPoints = 300, ?Carbon $startedAt = null): Contest
    {
        $startedAt ??= now()->subDays(3);

        $contest = Contest::create([
            'title' => 'Contest '.uniqid(), 'slug' => 'contest-'.uniqid(), 'start_at' => $startedAt, 'end_at' => $startedAt->copy()->addHours(2),
            'is_rated' => false, 'status' => Contest::STATUS_PUBLISHED, 'contest_type' => $type, 'finalized_at' => $startedAt->copy()->addHours(3),
        ]);

        $problem = $this->makeProblem();
        $contestProblem = ContestProblem::create(['contest_id' => $contest->id, 'problem_id' => $problem->id, 'points' => $totalPoints, 'display_order' => 1]);

        $rank = 0;
        foreach ($results as $userId => $points) {
            ContestParticipant::create([
                'contest_id' => $contest->id, 'user_id' => $userId, 'registered_at' => $startedAt, 'score' => $points, 'rank' => ++$rank,
            ]);
            ContestSubmission::create([
                'contest_id' => $contest->id, 'contest_problem_id' => $contestProblem->id, 'user_id' => $userId, 'language' => 'python', 'code' => '// code',
                'status' => $points > 0 ? 'accepted' : 'wrong_answer', 'submitted_at' => $startedAt->copy()->addHour(), 'points_awarded' => $points,
            ]);
        }

        return $contest;
    }

    protected function hackathonEntry(User $student, string $host = Hackathon::HOST_PLATFORM, bool $submitted = false, string $status = Hackathon::STATUS_PUBLISHED): Hackathon
    {
        $hackathon = Hackathon::create([
            'slug' => 'hack-'.uniqid(), 'title' => 'Hackathon', 'tagline' => 'A hackathon.', 'description' => str_repeat('A real description. ', 4),
            'accent' => 'indigo', 'mode' => Hackathon::MODE_ONLINE, 'host_type' => $host, 'status' => $status, 'published_at' => now()->subDays(10),
            'registration_opens_at' => now()->subDays(12), 'registration_closes_at' => now()->subDays(8),
            'starts_at' => now()->subDays(7), 'ends_at' => now()->subDays(4), 'min_team_size' => 1, 'max_team_size' => 4,
        ]);

        $team = HackathonTeam::create([
            'hackathon_id' => $hackathon->id, 'name' => 'Team '.uniqid(), 'invite_code' => HackathonTeam::generateInviteCode($hackathon->id), 'leader_id' => $student->id,
        ]);

        HackathonParticipant::create([
            'hackathon_id' => $hackathon->id, 'user_id' => $student->id, 'hackathon_team_id' => $team->id,
            'role' => HackathonParticipant::ROLE_LEADER, 'registered_at' => now()->subDays(9),
        ]);

        if ($submitted) {
            HackathonSubmission::create([
                'hackathon_id' => $hackathon->id, 'hackathon_team_id' => $team->id, 'submitted_by' => $student->id, 'title' => 'Project',
                'status' => 'submitted', 'submitted_at' => now()->subDays(5),
            ]);
        }

        return $hackathon;
    }

    protected function submittedProject(User $student): ProjectSubmission
    {
        $topic = ProjectTopic::create([
            'slug' => 'topic-'.uniqid(), 'title' => 'Course platform', 'category' => 'Web Apps', 'summary' => 'Build a course platform.',
            'difficulty' => ProjectTopic::DIFFICULTY_INTERMEDIATE, 'estimated_hours' => 40, 'status' => ProjectTopic::STATUS_PUBLISHED, 'published_at' => now(),
        ]);

        $enrollment = ProjectEnrollment::create([
            'user_id' => $student->id, 'project_topic_id' => $topic->id, 'sow_version' => 1, 'status' => ProjectEnrollment::STATUS_SUBMITTED, 'started_at' => now()->subDays(20),
        ]);

        return ProjectSubmission::create([
            'project_enrollment_id' => $enrollment->id, 'user_id' => $student->id, 'attempt' => 1, 'status' => ProjectSubmission::STATUS_PENDING, 'submitted_at' => now()->subDays(3),
        ]);
    }

    /** Practice activity on `$days` different recent days, one accepted problem each. */
    protected function activeOnDays(User $student, int $days): void
    {
        for ($i = 0; $i < $days; $i++) {
            $this->practiceSubmission($student, 'python', 'accepted', null, now()->subDays($i + 1));
        }
    }

    /**
     * A student with a strong, even record across the whole platform — comfortably
     * over the Vault line. The point is not the exact number but that it takes
     * breadth to get here: every component below is earned by something real.
     */
    protected function strongStudent(array $attributes = []): User
    {
        $student = $this->readinessStudent($attributes);

        foreach ([95, 90, 92] as $i => $score) {
            $this->scoredInterview($student, $score, at: now()->subDays($i + 1));
        }
        foreach ([88, 92] as $i => $score) {
            $this->softSkillResult($student, $score, at: now()->subDays($i + 1));
        }
        foreach ([90, 85, 95] as $i => $score) {
            $this->speakingScore($student, $score, now()->subDays($i + 1));
            $this->listeningScore($student, $score, now()->subDays($i + 1));
            $this->vocabularyScore($student, $score, now()->subDays($i + 1));
        }
        foreach ([0, 1, 2] as $i) {
            $this->finishedContest([$student->id => 270], Contest::CONTEST_TYPE_DAILY, 300, now()->subDays($i + 2));
        }
        $this->activeOnDays($student, 14);

        return $student->fresh();
    }
}
