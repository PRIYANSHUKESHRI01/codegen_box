<?php

namespace Database\Seeders;

use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillAssessmentQuestion;
use App\Models\SoftSkillQuestion;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * The default, immediately-usable general Soft Skills test — "Standard
 * Placement Readiness Test", the same 20 Aptitude + 15 Reasoning +
 * 15 English composition recommended as the default in the authoring UI
 * (see AdminSoftSkillController's auto-fill action, which this mirrors
 * directly against the models rather than over HTTP). Published
 * immediately so the feature is testable end-to-end with zero manual
 * setup, same posture as ArticleSeeder/SpeakingPromptSeeder. Requires
 * SoftSkillQuestionSeeder to have already run.
 */
class SoftSkillAssessmentSeeder extends Seeder
{
    private const COMPOSITION = [
        SoftSkillQuestion::CATEGORY_APTITUDE => 20,
        SoftSkillQuestion::CATEGORY_REASONING => 15,
        SoftSkillQuestion::CATEGORY_ENGLISH => 15,
    ];

    public function run(): void
    {
        $priya = User::where('email', 'priya@mellow.ai')->first();

        $assessment = SoftSkillAssessment::updateOrCreate(
            ['slug' => 'standard-placement-readiness-test'],
            [
                'title' => 'Standard Placement Readiness Test',
                'description' => 'A well-rounded readiness check covering quantitative aptitude, logical reasoning, and English ability — the same three pillars most campus placement drives screen on before the technical rounds.',
                'status' => SoftSkillAssessment::STATUS_PUBLISHED,
                'assessment_type' => SoftSkillAssessment::TYPE_GENERAL,
                'duration_minutes' => 50,
                'pass_percentage' => 60,
                'max_attempts' => null,
                'created_by' => $priya?->id,
            ]
        );

        if ($assessment->assessmentQuestions()->exists()) {
            return;
        }

        $displayOrder = 0;
        foreach (self::COMPOSITION as $category => $count) {
            $picked = SoftSkillQuestion::where('category', $category)
                ->where('is_active', true)
                ->inRandomOrder()
                ->limit($count)
                ->get();

            foreach ($picked as $question) {
                SoftSkillAssessmentQuestion::create([
                    'soft_skill_assessment_id' => $assessment->id,
                    'soft_skill_question_id' => $question->id,
                    'display_order' => $displayOrder++,
                ]);
            }
        }
    }
}
