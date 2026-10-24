<?php

namespace Database\Seeders;

use App\Models\College;
use App\Models\Company;
use App\Models\CompanyPrepQuestion;
use App\Models\CompanyRecommendedProblem;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class LtiMindtreePlacementSeeder extends Seeder
{
    public function run(): void
    {
        $apex = College::where('short_code', 'APEX')->first();
        $apexTpo = User::where('email', 'tpo@apex.edu.in')->first();

        $lti = Company::updateOrCreate(
            ['slug' => 'ltimindtree'],
            [
                'name' => 'LTIMindtree',
                'logo' => '🟨',
                'website_url' => 'https://www.ltimindtree.com',
                'industry' => 'IT Services & Digital Engineering',
                'overview' => 'LTIMindtree is a global technology consulting and digital solutions company with over 80,000 professionals serving 700+ enterprise clients across 30+ countries. Formed by the integration of L&T Infotech (LTI) and Mindtree, it hires thousands of engineering freshers annually through its Spark (Graduate Engineer Trainee: ₹4.0 - 4.5 LPA) and Ignite / Velocity (Specialist Software Engineer: ₹5.5 - 6.5 LPA) national campus programs.',
                'hiring_process' => [
                    [
                        'name' => 'Round 1: Online Assessment (Aptitude & Technical)',
                        'description' => 'Comprehensive evaluation comprising Quantitative Aptitude, Logical Reasoning, Verbal Ability, and Technical CS fundamentals (C/C++, OOPs, Data Structures, Pseudocode) on CoCubes/Wheebox.',
                    ],
                    [
                        'name' => 'Round 2: Hands-on Coding Assessment',
                        'description' => 'Two programming problems (1 Easy-Medium and 1 Medium) covering arrays, strings, matrix manipulations, and dynamic programming.',
                    ],
                    [
                        'name' => 'Round 3: Technical Interview',
                        'description' => 'In-depth one-on-one panel interview probing data structures, algorithms, database normalization, system architecture, and final-year engineering projects.',
                    ],
                    [
                        'name' => 'Round 4: HR & Behavioral Interview',
                        'description' => 'Conversational evaluation testing cultural adaptability, communication, teamwork under pressure, relocation readiness, and alignment with LTIMindtree values.',
                    ],
                ],
                'is_active' => true,
            ]
        );

        $ltiDrive = PlacementDrive::updateOrCreate(
            [
                'company_id' => $lti->id,
                'title' => 'LTIMindtree — Spark & Ignite Campus Drive (2026 Batch)',
            ],
            [
                'role_title' => 'Software Engineer / Specialist Software Engineer',
                'ctc_range' => '₹4.0 - 6.5 LPA',
                'drive_date' => now()->addDays(28),
                'duration_minutes' => 90,
                'min_cgpa' => 6.0,
                'max_backlogs' => 1,
                'eligible_branches' => ['CSE', 'IT', 'ECE', 'EEE', 'MECH'],
                'status' => PlacementDrive::STATUS_PUBLISHED,
                'terms_and_conditions' => "LTIMindtree Campus Guidelines:\n"
                    ."1. Minimum 60% or 6.0 CGPA throughout 10th, 12th, and B.Tech with at most 1 active backlog at the time of assessment.\n"
                    ."2. Candidate must clear the Online Assessment and Coding Assessment to qualify for the Technical and HR interviews.\n"
                    ."3. Selected engineers must be open to pan-India relocation across LTIMindtree delivery centers (Bengaluru, Pune, Mumbai, Chennai, Hyderabad, Kolkata, Coimbatore).",
            ]
        );

        if ($apex && $apexTpo) {
            DriveCollegeMapping::updateOrCreate(
                [
                    'placement_drive_id' => $ltiDrive->id,
                    'college_id' => $apex->id,
                ],
                [
                    'mapped_by' => $apexTpo->id,
                    'mapped_at' => now(),
                    'unmapped_at' => null,
                    'is_active' => true,
                ]
            );
        }

        $this->seedPrepQuestions($lti);
        $this->seedRecommendedProblems($lti);
    }

    private function seedPrepQuestions(Company $company): void
    {
        $path = database_path('data/ltimindtree_prep_questions.json');
        if (! file_exists($path)) {
            $path = __DIR__.'/../data/ltimindtree_prep_questions.json';
        }

        if (! file_exists($path)) {
            throw new RuntimeException("LtiMindtreePlacementSeeder: missing data file at {$path}");
        }

        $questions = json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);

        CompanyPrepQuestion::where('company_id', $company->id)->delete();

        foreach ($questions as $q) {
            CompanyPrepQuestion::create([
                'company_id' => $company->id,
                'asked_year' => $q['asked_year'],
                'question' => $q['question'],
                'category' => $q['category'],
                'round_name' => $q['round_name'],
                'answer_notes' => $q['answer_notes'] ?? null,
                'display_order' => $q['display_order'] ?? 0,
            ]);
        }
    }

    private function seedRecommendedProblems(Company $company): void
    {
        $problems = [
            ['problem_slug' => 'merge-intervals', 'topic_tag' => 'Interval Sorting', 'priority' => 1],
            ['problem_slug' => 'longest-substring-without-repeating-characters', 'topic_tag' => 'Sliding Window', 'priority' => 2],
            ['problem_slug' => 'maximum-subarray', 'topic_tag' => 'Dynamic Programming (Kadane)', 'priority' => 3],
            ['problem_slug' => 'two-sum', 'topic_tag' => 'Hash Map Lookup', 'priority' => 4],
            ['problem_slug' => 'valid-palindrome', 'topic_tag' => 'Two Pointers String', 'priority' => 5],
            ['problem_slug' => 'valid-parentheses', 'topic_tag' => 'Stack Matching', 'priority' => 6],
            ['problem_slug' => 'valid-anagram', 'topic_tag' => 'Frequency Hashing', 'priority' => 7],
            ['problem_slug' => 'best-time-to-buy-and-sell-stock', 'topic_tag' => 'Greedy Single-Pass', 'priority' => 8],
        ];

        foreach ($problems as $p) {
            CompanyRecommendedProblem::updateOrCreate(
                ['company_id' => $company->id, 'problem_slug' => $p['problem_slug']],
                ['topic_tag' => $p['topic_tag'], 'priority' => $p['priority']]
            );
        }
    }
}
