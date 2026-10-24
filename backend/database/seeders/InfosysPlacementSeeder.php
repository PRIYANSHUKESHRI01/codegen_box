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

class InfosysPlacementSeeder extends Seeder
{
    public function run(): void
    {
        $apex = College::where('short_code', 'APEX')->first();
        $apexTpo = User::where('email', 'tpo@apex.edu.in')->first();

        $infosys = Company::updateOrCreate(
            ['slug' => 'infosys'],
            [
                'name' => 'Infosys',
                'logo' => '🔷',
                'website_url' => 'https://www.infosys.com',
                'industry' => 'IT Services & Digital Consulting',
                'overview' => 'Infosys Limited is a global leader in next-generation digital services and consulting with over 320,000 employees worldwide. Its campus recruitment and flagship INFYTQ initiatives hire engineering graduates across multiple merit tiers: Systems Engineer (SE: ₹3.6 - 4.0 LPA), Digital Specialist Engineer (DSE: ₹6.25 - 6.5 LPA), and Specialist Programmer (SP: ₹9.5 LPA) with foundational residential training at the world-renowned Infosys Mysore Global Education Center.',
                'hiring_process' => [
                    [
                        'name' => 'Online Assessment (Mathematical & Cryptarithmetic)',
                        'description' => 'Rigorous quantitative ability, alphametic cryptarithmetic puzzles, permutations, and modular arithmetic administered on Infosys proctored platform.',
                    ],
                    [
                        'name' => 'Logical Reasoning & Data Sufficiency',
                        'description' => 'Complex seating arrangements, multi-premise syllogisms, truth-tellers/liars deduction, and critical reasoning problems.',
                    ],
                    [
                        'name' => 'Hands-on Coding Assessment (SP / DSE / SE)',
                        'description' => 'Up to 3 algorithmic challenges (Dynamic Programming, Graph traversals, sliding windows, and bit manipulation) with strict time limits.',
                    ],
                    [
                        'name' => 'Technical & HR Interview',
                        'description' => 'In-depth panel interview evaluating Core Computer Science (OOPs, DBMS, OS, Networks), project architecture, and alignment with Infosys values.',
                    ],
                ],
                'is_active' => true,
            ]
        );

        $infosysDrive = PlacementDrive::updateOrCreate(
            [
                'company_id' => $infosys->id,
                'title' => 'Infosys — Campus Recruitment Drive (2026 Batch)',
            ],
            [
                'role_title' => 'Systems Engineer / Digital Specialist Engineer / Specialist Programmer',
                'ctc_range' => '₹3.6 - 9.5 LPA',
                'drive_date' => now()->addDays(18),
                'duration_minutes' => 100,
                'min_cgpa' => 6.0,
                'max_backlogs' => 1,
                'eligible_branches' => ['CSE', 'IT', 'ECE', 'EEE', 'MECH'],
                'status' => PlacementDrive::STATUS_PUBLISHED,
                'terms_and_conditions' => "Infosys Campus Guidelines:\n"
                    ."1. Minimum 60% or 6.0 CGPA throughout 10th, 12th, and B.Tech with at most 1 active backlog at the time of assessment.\n"
                    ."2. Candidate must clear the Online Assessment (Reasoning, Math/Cryptarithmetic, Verbal, and Coding) to qualify for the Technical & HR interview.\n"
                    ."3. Selected engineers must complete the residential training program at Infosys Mysore and be open to pan-India relocation across Infosys development centers.",
            ]
        );

        if ($apex && $apexTpo) {
            DriveCollegeMapping::updateOrCreate(
                [
                    'placement_drive_id' => $infosysDrive->id,
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

        $this->seedPrepQuestions($infosys);
        $this->seedRecommendedProblems($infosys);
    }

    private function seedPrepQuestions(Company $company): void
    {
        $path = database_path('data/infosys_prep_questions.json');
        if (! file_exists($path)) {
            $path = __DIR__.'/../data/infosys_prep_questions.json';
        }

        if (! file_exists($path)) {
            throw new RuntimeException("InfosysPlacementSeeder: missing data file at {$path}");
        }

        $questions = json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);

        // Delete any old incomplete questions before loading the verified 42-question bank
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
            ['problem_slug' => '3sum', 'topic_tag' => 'Two Pointers & Arrays', 'priority' => 1],
            ['problem_slug' => 'subarray-sum-equals-k', 'topic_tag' => 'Hash Map Prefix Sum', 'priority' => 2],
            ['problem_slug' => 'longest-consecutive-sequence', 'topic_tag' => 'Hash Set Boundary Scan', 'priority' => 3],
            ['problem_slug' => 'merge-intervals', 'topic_tag' => 'Interval Sorting', 'priority' => 4],
            ['problem_slug' => 'maximum-subarray', 'topic_tag' => 'Dynamic Programming (Kadane)', 'priority' => 5],
            ['problem_slug' => 'two-sum', 'topic_tag' => 'Hash Map Lookup', 'priority' => 6],
            ['problem_slug' => 'valid-parentheses', 'topic_tag' => 'Stack Matching', 'priority' => 7],
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

