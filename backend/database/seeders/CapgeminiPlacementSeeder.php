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

class CapgeminiPlacementSeeder extends Seeder
{
    public function run(): void
    {
        $apex = College::where('short_code', 'APEX')->first();
        $apexTpo = User::where('email', 'tpo@apex.edu.in')->first();

        $capgemini = Company::updateOrCreate(
            ['slug' => 'capgemini'],
            [
                'name' => 'Capgemini',
                'logo' => '🔷',
                'website_url' => 'https://www.capgemini.com',
                'industry' => 'IT Services & Digital Engineering',
                'overview' => 'Capgemini is a global leader in partnering with companies to transform and manage their business by harnessing the power of technology. Headquartered in Paris, France, with major development and consulting hubs across India, Capgemini hires thousands of engineering freshers annually through its flagship Capgemini Exceller campus program for roles including Analyst (₹4.0 - 4.25 LPA) and Senior Analyst / Differential Engineering roles (₹5.75 - 7.5 LPA).',
                'hiring_process' => [
                    [
                        'name' => 'Technical Assessment (Pseudocode & Data Structures)',
                        'description' => 'Proctored test evaluating algorithmic tracing, C/C++ bitwise logic, data structures (arrays, trees, queues), recursion trees, and loop boundary checks.',
                    ],
                    [
                        'name' => 'English Communication Assessment',
                        'description' => 'Automated language assessment testing reading comprehension, grammar correction, sentence completion, active/passive voice, and vocabulary.',
                    ],
                    [
                        'name' => 'Coding Assessment',
                        'description' => 'Hands-on programming round with 2 coding challenges to be solved in 45 minutes, emphasizing strings, arrays, matrix traversal, and numerical algorithms.',
                    ],
                    [
                        'name' => 'Technical & HR Interview',
                        'description' => 'Comprehensive one-on-one panel interview probing final-year projects, OOPs fundamentals, DBMS/SQL queries, problem-solving, and cultural adaptability.',
                    ],
                ],
                'is_active' => true,
            ]
        );

        $capgeminiDrive = PlacementDrive::updateOrCreate(
            [
                'company_id' => $capgemini->id,
                'title' => 'Capgemini — Exceller Engineering Campus Drive (2026 Batch)',
            ],
            [
                'role_title' => 'Analyst / Senior Analyst',
                'ctc_range' => '₹4.25 - 7.5 LPA',
                'drive_date' => now()->addDays(15),
                'duration_minutes' => 90,
                'min_cgpa' => 6.0,
                'max_backlogs' => 1,
                'eligible_branches' => ['CSE', 'IT', 'ECE', 'EEE', 'MECH'],
                'status' => PlacementDrive::STATUS_PUBLISHED,
                'terms_and_conditions' => "Capgemini Exceller Campus Guidelines:\n"
                    ."1. Minimum 60% or 6.0 CGPA throughout 10th, 12th, and B.Tech with at most 1 active backlog.\n"
                    ."2. Elimination Rounds: Technical Assessment (Pseudocode) and English Communication must be cleared to qualify for Coding.\n"
                    ."3. Selected graduates must be willing to relocate to Capgemini delivery centers (Mumbai, Pune, Bangalore, Hyderabad, Chennai, Kolkata, Noida) and support rotational shifts.",
            ]
        );

        if ($apex && $apexTpo) {
            DriveCollegeMapping::updateOrCreate(
                [
                    'placement_drive_id' => $capgeminiDrive->id,
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

        $this->seedPrepQuestions($capgemini);
        $this->seedRecommendedProblems($capgemini);
    }

    private function seedPrepQuestions(Company $company): void
    {
        $path = database_path('data/capgemini_prep_questions.json');
        if (! file_exists($path)) {
            $path = __DIR__.'/../data/capgemini_prep_questions.json';
        }

        if (! file_exists($path)) {
            throw new RuntimeException("CapgeminiPlacementSeeder: missing data file at {$path}");
        }

        $questions = json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);

        foreach ($questions as $q) {
            CompanyPrepQuestion::updateOrCreate(
                [
                    'company_id' => $company->id,
                    'asked_year' => $q['asked_year'],
                    'question' => $q['question'],
                ],
                [
                    'category' => $q['category'],
                    'round_name' => $q['round_name'],
                    'answer_notes' => $q['answer_notes'] ?? null,
                    'display_order' => $q['display_order'] ?? 0,
                ]
            );
        }
    }

    private function seedRecommendedProblems(Company $company): void
    {
        $problems = [
            ['problem_slug' => 'spiral-matrix', 'topic_tag' => '2D Arrays & Traversal', 'priority' => 1],
            ['problem_slug' => 'valid-anagram', 'topic_tag' => 'String Hashing', 'priority' => 2],
            ['problem_slug' => 'move-zeroes', 'topic_tag' => 'Two Pointers In-Place', 'priority' => 3],
            ['problem_slug' => 'two-sum', 'topic_tag' => 'Hash Map Lookup', 'priority' => 4],
            ['problem_slug' => 'reverse-integer', 'topic_tag' => 'Math & Overflow Limits', 'priority' => 5],
            ['problem_slug' => 'valid-palindrome', 'topic_tag' => 'Two Pointers', 'priority' => 6],
            ['problem_slug' => 'maximum-subarray', 'topic_tag' => 'Dynamic Programming (Kadane)', 'priority' => 7],
            ['problem_slug' => 'longest-substring-without-repeating-characters', 'topic_tag' => 'Sliding Window', 'priority' => 8],
        ];

        foreach ($problems as $p) {
            CompanyRecommendedProblem::updateOrCreate(
                ['company_id' => $company->id, 'problem_slug' => $p['problem_slug']],
                ['topic_tag' => $p['topic_tag'], 'priority' => $p['priority']]
            );
        }
    }
}

