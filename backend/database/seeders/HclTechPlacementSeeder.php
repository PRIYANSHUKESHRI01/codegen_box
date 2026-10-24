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

class HclTechPlacementSeeder extends Seeder
{
    public function run(): void
    {
        $apex = College::where('short_code', 'APEX')->first();
        $apexTpo = User::where('email', 'tpo@apex.edu.in')->first();

        $hcl = Company::updateOrCreate(
            ['slug' => 'hcltech'],
            [
                'name' => 'HCLTech',
                'logo' => '🔷',
                'website_url' => 'https://www.hcltech.com',
                'industry' => 'IT Services & Digital Engineering',
                'overview' => 'HCLTech is a global technology enterprise employing over 220,000 professionals across 60 countries, delivering industry-leading capabilities centered around digital, engineering, and cloud. Powered by a culture of Ideapreneurship, HCLTech hires thousands of fresh graduates annually for Graduate Engineer Trainee (GET) and Software Developer roles offering ₹4.25 - 5.5 LPA.',
                'hiring_process' => [
                    [
                        'name' => 'Online Assessment (Aptitude & Logical)',
                        'description' => 'Quantitative Aptitude, Logical Reasoning, and English Language evaluation covering arithmetic, data interpretation, and verbal comprehension.',
                    ],
                    [
                        'name' => 'Technical Assessment & Domain MCQs',
                        'description' => 'Core Computer Science fundamentals evaluating C/C++ output tracing, OOPs principles, SQL queries, memory management, and network protocols.',
                    ],
                    [
                        'name' => 'Hands-on Coding Assessment',
                        'description' => 'Two programming challenges focusing on strings, array manipulations, matrix traversals, and mathematical algorithms.',
                    ],
                    [
                        'name' => 'Technical & HR Interview',
                        'description' => 'Comprehensive panel evaluation testing technical depth, final-year engineering projects, cultural adaptability, shift readiness, and Ideapreneurship alignment.',
                    ],
                ],
                'is_active' => true,
            ]
        );

        $hclDrive = PlacementDrive::updateOrCreate(
            [
                'company_id' => $hcl->id,
                'title' => 'HCLTech — Graduate Engineer Campus Drive (2026 Batch)',
            ],
            [
                'role_title' => 'Graduate Engineer Trainee (GET)',
                'ctc_range' => '₹4.25 - 5.5 LPA',
                'drive_date' => now()->addDays(22),
                'duration_minutes' => 90,
                'min_cgpa' => 6.0,
                'max_backlogs' => 1,
                'eligible_branches' => ['CSE', 'IT', 'ECE', 'EEE', 'MECH'],
                'status' => PlacementDrive::STATUS_PUBLISHED,
                'terms_and_conditions' => "HCLTech Campus Guidelines:\n"
                    ."1. Minimum 60% or 6.0 CGPA throughout 10th, 12th, and B.Tech with at most 1 active backlog at the time of assessment.\n"
                    ."2. Candidate must clear the Online Assessment (Aptitude + Technical + Coding) to qualify for the Technical & HR interview.\n"
                    ."3. Selected engineers must be open to pan-India relocation across HCLTech development centers (Noida, Bengaluru, Chennai, Hyderabad, Pune, Madurai, Lucknow).",
            ]
        );

        if ($apex && $apexTpo) {
            DriveCollegeMapping::updateOrCreate(
                [
                    'placement_drive_id' => $hclDrive->id,
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

        $this->seedPrepQuestions($hcl);
        $this->seedRecommendedProblems($hcl);
    }

    private function seedPrepQuestions(Company $company): void
    {
        $path = database_path('data/hcltech_prep_questions.json');
        if (! file_exists($path)) {
            $path = __DIR__.'/../data/hcltech_prep_questions.json';
        }

        if (! file_exists($path)) {
            throw new RuntimeException("HclTechPlacementSeeder: missing data file at {$path}");
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
            ['problem_slug' => 'maximum-subarray', 'topic_tag' => 'Dynamic Programming (Kadane)', 'priority' => 1],
            ['problem_slug' => 'spiral-matrix', 'topic_tag' => '2D Matrix Traversal', 'priority' => 2],
            ['problem_slug' => 'valid-palindrome', 'topic_tag' => 'Two Pointers String', 'priority' => 3],
            ['problem_slug' => 'move-zeroes', 'topic_tag' => 'Two Pointers In-Place', 'priority' => 4],
            ['problem_slug' => 'two-sum', 'topic_tag' => 'Hash Map Lookup', 'priority' => 5],
            ['problem_slug' => 'valid-anagram', 'topic_tag' => 'Frequency Hashing', 'priority' => 6],
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
