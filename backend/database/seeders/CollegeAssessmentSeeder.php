<?php

namespace Database\Seeders;

use App\Models\College;
use App\Models\CollegeAssessment;
use App\Models\Problem;
use App\Models\SoftSkillAssessment;
use App\Models\User;
use App\Services\CollegeAssessmentService;
use Illuminate\Database\Seeder;

/**
 * Idempotent starter template seeder for Unified College Assessments.
 * Creates a sample DRAFT template (so real students on AWS do not see a mock
 * test until SuperAdmin explicitly customizes targets and publishes it).
 */
class CollegeAssessmentSeeder extends Seeder
{
    public function run(): void
    {
        if (CollegeAssessment::where('slug', 'campus-tech-placement-starter')->exists()) {
            return;
        }

        $actor = User::where('role', User::ROLE_SUPERADMIN)->first()
            ?? User::where('role', User::ROLE_ADMIN_INTERNAL)->first();
        $college = College::first();

        if (! $actor || ! $college) {
            return;
        }

        $softSkillSetIds = SoftSkillAssessment::questionSets()
            ->where('status', SoftSkillAssessment::STATUS_PUBLISHED)
            ->orderBy('id')
            ->limit(1)
            ->pluck('id')
            ->all();

        $problemIds = Problem::query()
            ->orderBy('display_order')
            ->orderBy('id')
            ->limit(2)
            ->pluck('id')
            ->all();

        $studentIds = User::where('role', User::ROLE_USER)
            ->where('college_id', $college->id)
            ->limit(10)
            ->pluck('id')
            ->all();

        if ($softSkillSetIds === [] || $problemIds === [] || $studentIds === []) {
            return;
        }

        $service = app(CollegeAssessmentService::class);
        $assessment = $service->save($actor, [
            'title' => 'Campus Tech Placement Starter',
            'description' => 'Sample multi-round college assessment template combining Soft Skills, Coding, and AI Interview.',
            'enforce_sequence' => true,
            'passing_score_percent' => 60,
            'publish_now' => false,
            'include_soft_skills' => true,
            'soft_skill_weight' => 30,
            'soft_skill_config' => [
                'question_set_ids' => $softSkillSetIds,
                'duration_minutes' => 30,
                'pass_percentage' => 60,
            ],
            'include_coding' => true,
            'coding_weight' => 40,
            'coding_config' => [
                'problems' => array_map(fn ($id) => ['problem_id' => $id, 'points' => 100], $problemIds),
            ],
            'include_interview' => true,
            'interview_weight' => 30,
            'interview_config' => [
                'custom_questions' => [
                    ['text' => 'Walk us through a technical project you built and the hardest bug you solved.', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ['text' => 'Explain the difference between a process and a thread, and when you would use concurrency.', 'category' => 'technical', 'difficulty' => 'medium', 'duration_seconds' => 120],
                    ['text' => 'Tell us about a time you disagreed with a teammate and how you resolved it.', 'category' => 'behavioral', 'difficulty' => 'easy', 'duration_seconds' => 90],
                ],
            ],
            'target_scope' => [
                'college_ids' => [$college->id],
                'department_codes' => [],
                'branch_codes' => [],
                'student_mode' => 'selected',
                'user_ids' => $studentIds,
            ],
        ]);

        $assessment->update(['slug' => 'campus-tech-placement-starter']);
    }
}
