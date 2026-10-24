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

class CognizantPlacementSeeder extends Seeder
{
    public function run(): void
    {
        $apex = College::where('short_code', 'APEX')->first();
        $apexTpo = User::where('email', 'tpo@apex.edu.in')->first();

        $cognizant = Company::updateOrCreate(
            ['slug' => 'cognizant'],
            [
                'name' => 'Cognizant',
                'logo' => '💠',
                'website_url' => 'https://www.cognizant.com',
                'industry' => 'IT Services & Digital Solutions',
                'overview' => 'Cognizant is an American multinational information technology services and consulting company, leading digital modernization and software engineering for Fortune 500 enterprises. Its premier campus recruitment tracks hire fresh engineering graduates into GenC (₹4.0 LPA), GenC Elevate (₹4.5 - 5.5 LPA), and GenC Next (₹6.75 - 9.0 LPA) roles through an intensive multi-tiered assessment model evaluating communication proficiency, quantitative & analytical aptitude, hands-on coding, and technical domain depth.',
                'hiring_process' => [
                    [
                        'name' => 'Communication Assessment (Versant)',
                        'description' => 'AI-proctored English test evaluating sentence reading, listening & repeating, jumbled sentence reconstruction, short conversational Q&A, and story retelling.',
                    ],
                    [
                        'name' => 'Quantitative & Logical Aptitude Assessment',
                        'description' => 'Timed aptitude evaluation covering time & work, speed & distance, profit & loss, ratio & proportion, syllogisms, blood relations, and seating arrangements.',
                    ],
                    [
                        'name' => 'Technical & Coding Assessment',
                        'description' => 'Hands-on coding and debugging round (Automata Fix + 2 algorithm challenges) with SQL query formulation for GenC Elevate and GenC Next tracks.',
                    ],
                    [
                        'name' => 'Technical & HR Interview',
                        'description' => 'Detailed discussion on project architecture, database normalization & complex queries, OOPs design patterns, and behavioral readiness for global project shifts.',
                    ],
                ],
                'is_active' => true,
            ]
        );

        $cognizantDrive = PlacementDrive::updateOrCreate(
            [
                'company_id' => $cognizant->id,
                'title' => 'Cognizant — GenC, GenC Elevate & Next Campus Drive (2026 Batch)',
            ],
            [
                'role_title' => 'Programmer Analyst Trainee (GenC / Elevate)',
                'ctc_range' => '₹4.0 - 9.0 LPA',
                'drive_date' => now()->addDays(20),
                'duration_minutes' => 100,
                'min_cgpa' => 6.0,
                'max_backlogs' => 1,
                'eligible_branches' => ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL'],
                'status' => PlacementDrive::STATUS_PUBLISHED,
                'terms_and_conditions' => "Cognizant GenC Campus Guidelines:\n"
                    ."1. B.E / B.Tech / M.E / M.Tech graduates with 60% or 6.0 CGPA throughout academics with maximum 1 standing backlog.\n"
                    ."2. Candidate profile tiering (GenC vs GenC Elevate vs GenC Next) is allocated strictly based on online technical assessment and coding scores.\n"
                    ."3. Must be flexible to relocate to any Cognizant facility (Chennai, Bangalore, Hyderabad, Pune, Kolkata, Coimbatore, Gurgaon) and support 24/7 project shifts.",
            ]
        );

        if ($apex && $apexTpo) {
            DriveCollegeMapping::updateOrCreate(
                [
                    'placement_drive_id' => $cognizantDrive->id,
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

        $this->seedPrepQuestions($cognizant);
        $this->seedRecommendedProblems($cognizant);
    }

    private function seedPrepQuestions(Company $company): void
    {
        $path = database_path('data/cognizant_prep_questions.json');
        if (! file_exists($path)) {
            $path = __DIR__.'/../data/cognizant_prep_questions.json';
        }

        if (! file_exists($path)) {
            throw new RuntimeException("CognizantPlacementSeeder: missing data file at {$path}");
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
            ['problem_slug' => 'best-time-to-buy-and-sell-stock', 'topic_tag' => 'Greedy & Arrays', 'priority' => 1],
            ['problem_slug' => 'subarray-sum-equals-k', 'topic_tag' => 'Prefix Sum & Hashing', 'priority' => 2],
            ['problem_slug' => 'longest-consecutive-sequence', 'topic_tag' => 'Hash Set Sequence', 'priority' => 3],
            ['problem_slug' => 'two-sum', 'topic_tag' => 'Two Pointers & Map', 'priority' => 4],
            ['problem_slug' => 'valid-parentheses', 'topic_tag' => 'Stack Validation', 'priority' => 5],
            ['problem_slug' => 'palindrome-number', 'topic_tag' => 'Math & Palindromes', 'priority' => 6],
            ['problem_slug' => 'reverse-words-in-a-string', 'topic_tag' => 'String Tokenization', 'priority' => 7],
            ['problem_slug' => 'maximum-subarray', 'topic_tag' => 'Kadane Optimization', 'priority' => 8],
        ];

        foreach ($problems as $p) {
            CompanyRecommendedProblem::updateOrCreate(
                ['company_id' => $company->id, 'problem_slug' => $p['problem_slug']],
                ['topic_tag' => $p['topic_tag'], 'priority' => $p['priority']]
            );
        }
    }
}

