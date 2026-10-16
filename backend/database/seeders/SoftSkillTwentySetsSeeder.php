<?php

namespace Database\Seeders;

use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillAssessmentQuestion;
use App\Models\SoftSkillQuestion;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Seeds 20 comprehensive Soft Skill Assessment Question Sets (Sets 1 to 20),
 * containing 500 unique, hand-crafted placement-readiness questions
 * (25 questions per set: 8 Quantitative Aptitude, 7 Logical Reasoning,
 * 6 Verbal/English Ability, 4 Workplace Situational Judgment).
 *
 * Each set is published, general-type, timed at 45 minutes with a 60% pass threshold.
 * The legacy 'standard-placement-readiness-test' is set to draft so students see
 * cleanly numbered Sets 1 through 20 on their dashboard while preserving historical session integrity.
 */
class SoftSkillTwentySetsSeeder extends Seeder
{
    public function run(): void
    {
        $seventySetsPath = __DIR__ . '/data/soft_skills_all_70_sets.json';
        $fortyFiveSetsPath = __DIR__ . '/data/soft_skills_all_45_sets.json';
        $legacyPath = __DIR__ . '/data/soft_skills_20_sets.json';

        $path = file_exists($seventySetsPath)
            ? $seventySetsPath
            : (file_exists($fortyFiveSetsPath) ? $fortyFiveSetsPath : $legacyPath);

        if (! file_exists($path)) {
            throw new RuntimeException("SoftSkillTwentySetsSeeder: missing data file at {$path}");
        }

        $sets = json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);

        $priya = User::where('email', 'priya@mellow.ai')->first()
            ?? User::where('role', User::ROLE_SUPERADMIN)->first();

        // Demote the single legacy unnumbered benchmark test to draft so the
        // student dashboard cleanly displays the 20 numbered sets (1, 2, 3... 20)
        SoftSkillAssessment::where('slug', 'standard-placement-readiness-test')
            ->update(['status' => SoftSkillAssessment::STATUS_DRAFT]);

        DB::transaction(function () use ($sets, $priya) {
            foreach ($sets as $setData) {
                $assessment = SoftSkillAssessment::updateOrCreate(
                    ['slug' => $setData['slug']],
                    [
                        'title' => $setData['title'],
                        'description' => $setData['description'],
                        'status' => SoftSkillAssessment::STATUS_PUBLISHED,
                        'assessment_type' => SoftSkillAssessment::TYPE_GENERAL,
                        // These are the AptRun question-set library (see the add_question_sets_to_soft_skills migration).
                        'is_question_set' => true,
                        'question_set_number' => $setData['set_number'] ?? ($setData['question_set_number'] ?? null),
                        'duration_minutes' => $setData['duration_minutes'] ?? 45,
                        'pass_percentage' => $setData['pass_percentage'] ?? 60,
                        'max_attempts' => null,
                        'created_by' => $priya?->id,
                    ]
                );

                foreach ($setData['questions'] as $order => $q) {
                    $question = SoftSkillQuestion::updateOrCreate(
                        ['question_text' => $q['question_text']],
                        [
                            'category' => $q['category'],
                            'difficulty' => $q['difficulty'],
                            'options' => $q['options'],
                            'correct_index' => $q['correct_index'],
                            'explanation' => $q['explanation'],
                            'is_active' => true,
                            'created_by' => $priya?->id,
                        ]
                    );

                    SoftSkillAssessmentQuestion::updateOrCreate(
                        [
                            'soft_skill_assessment_id' => $assessment->id,
                            'soft_skill_question_id' => $question->id,
                        ],
                        [
                            'display_order' => $order,
                        ]
                    );
                }
            }
        });

        $totalSets = count($sets);
        $totalQuestions = $totalSets * 25;
        $this->command?->info("Successfully seeded {$totalSets} Soft Skill Assessment sets with {$totalQuestions} questions.");
    }
}

