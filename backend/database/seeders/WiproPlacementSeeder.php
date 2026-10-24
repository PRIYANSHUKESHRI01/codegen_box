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

class WiproPlacementSeeder extends Seeder
{
    public function run(): void
    {
        $apex = College::where('short_code', 'APEX')->first();
        $apexTpo = User::where('email', 'tpo@apex.edu.in')->first();

        $wipro = Company::updateOrCreate(
            ['slug' => 'wipro'],
            [
                'name' => 'Wipro',
                'logo' => '🟩',
                'website_url' => 'https://www.wipro.com',
                'industry' => 'IT Services & Digital Consulting',
                'overview' => 'Wipro Limited is a leading technology services and consulting company focused on building innovative solutions that address clients\' most complex digital transformation needs. Leveraging AI, cloud, robotics, and cognitive computing, Wipro operates across 65+ countries. Its flagship campus hiring initiatives include Wipro Elite National Talent Hunt (Elite NTH / NLTH) offering ₹3.5 - 4.0 LPA for Project Engineers and Wipro Turbo / Velocity offering ₹6.5 - 7.5 LPA for advanced digital engineering roles.',
                'hiring_process' => [
                    [
                        'name' => 'Online Assessment (Aptitude & Logical)',
                        'description' => 'Adaptive evaluation comprising Quantitative Aptitude, Logical Reasoning, and Verbal Ability administered via proctored assessment platforms.',
                    ],
                    [
                        'name' => 'Written Communication Test (WCT)',
                        'description' => 'Automated AI/NLP evaluated essay writing round testing grammar, vocabulary, paragraph structure, and topical coherence on contemporary socio-technological themes.',
                    ],
                    [
                        'name' => 'Hands-on Coding Assessment',
                        'description' => 'Two programming problems (Easy-to-Medium and Medium) covering arrays, strings, matrix manipulations, stack structures, and dynamic programming.',
                    ],
                    [
                        'name' => 'Technical & HR Interview',
                        'description' => 'Comprehensive panel interview evaluating core Computer Science fundamentals (OOPs, DBMS, OS, Networks), final-year engineering projects, and alignment with the Spirit of Wipro.',
                    ],
                ],
                'is_active' => true,
            ]
        );

        $wiproDrive = PlacementDrive::updateOrCreate(
            [
                'company_id' => $wipro->id,
                'title' => 'Wipro — Elite National Talent Hunt (2026 Batch)',
            ],
            [
                'role_title' => 'Project Engineer / Turbo Engineer',
                'ctc_range' => '₹3.5 - 7.5 LPA',
                'drive_date' => now()->addDays(20),
                'duration_minutes' => 120,
                'min_cgpa' => 6.0,
                'max_backlogs' => 1,
                'eligible_branches' => ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL'],
                'status' => PlacementDrive::STATUS_PUBLISHED,
                'terms_and_conditions' => "Wipro Elite NTH Guidelines:\n"
                    ."1. Minimum 60% or 6.0 CGPA throughout 10th, 12th, and B.Tech with at most 1 active backlog at the time of assessment.\n"
                    ."2. Candidate must clear the Online Assessment (Aptitude + WCT + Coding) to qualify for the Technical & HR interview.\n"
                    ."3. Selected engineers must be open to pan-India relocation across Wipro development centers and support rotational client shifts.",
            ]
        );

        if ($apex && $apexTpo) {
            DriveCollegeMapping::updateOrCreate(
                [
                    'placement_drive_id' => $wiproDrive->id,
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

        $this->seedPrepQuestions($wipro);
        $this->seedRecommendedProblems($wipro);
    }

    private function seedPrepQuestions(Company $company): void
    {
        $path = database_path('data/wipro_prep_questions.json');
        if (! file_exists($path)) {
            $path = __DIR__.'/../data/wipro_prep_questions.json';
        }

        if (! file_exists($path)) {
            throw new RuntimeException("WiproPlacementSeeder: missing data file at {$path}");
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
            ['problem_slug' => 'two-sum', 'topic_tag' => 'Hash Map Lookup', 'priority' => 1],
            ['problem_slug' => 'valid-parentheses', 'topic_tag' => 'Stack Matching', 'priority' => 2],
            ['problem_slug' => 'maximum-subarray', 'topic_tag' => 'Dynamic Programming (Kadane)', 'priority' => 3],
            ['problem_slug' => 'valid-palindrome', 'topic_tag' => 'Two Pointers', 'priority' => 4],
            ['problem_slug' => 'reverse-words-in-a-string', 'topic_tag' => 'String Manipulation', 'priority' => 5],
            ['problem_slug' => 'move-zeroes', 'topic_tag' => 'Two Pointers In-Place', 'priority' => 6],
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

