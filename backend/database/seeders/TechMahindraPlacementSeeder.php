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

class TechMahindraPlacementSeeder extends Seeder
{
    public function run(): void
    {
        $apex = College::where('short_code', 'APEX')->first();
        $apexTpo = User::where('email', 'tpo@apex.edu.in')->first();

        $techM = Company::updateOrCreate(
            ['slug' => 'tech-mahindra'],
            [
                'name' => 'Tech Mahindra',
                'logo' => '🟥',
                'website_url' => 'https://www.techmahindra.com',
                'industry' => 'IT Services & Telecom Consulting',
                'overview' => 'Tech Mahindra is a $6.5+ billion enterprise belonging to the Mahindra Group, employing over 145,000 professionals across 90 countries. A pioneer in telecommunications engineering, 5G architectures, and enterprise AI consulting, Tech Mahindra hires thousands of engineering freshers annually through its national campus drives for Associate Software Engineer (ASE) roles offering ₹3.5 - 5.5 LPA.',
                'hiring_process' => [
                    [
                        'name' => 'Round 1: Cognitive & English Assessment',
                        'description' => 'Quantitative Ability, Logical Reasoning, and English Language evaluation covering arithmetic, data analysis, and vocabulary on the Wheebox/HirePro proctored platform.',
                    ],
                    [
                        'name' => 'Round 2: Technical Assessment (Automata / Pseudocode)',
                        'description' => 'Pseudocode tracing, code debugging, and core Computer Science MCQs testing algorithm analysis and data structures.',
                    ],
                    [
                        'name' => 'Round 3: Hands-on Coding Assessment',
                        'description' => 'Two programming problems focusing on string algorithms, array manipulation, bitwise logic, and numerical algorithms.',
                    ],
                    [
                        'name' => 'Round 4: Conversational English & Technical Interview',
                        'description' => 'SpeechX automated oral evaluation followed by a panel interview covering technical fundamentals, final-year projects, and alignment with Mahindra Rise values.',
                    ],
                ],
                'is_active' => true,
            ]
        );

        $techMDrive = PlacementDrive::updateOrCreate(
            [
                'company_id' => $techM->id,
                'title' => 'Tech Mahindra — Campus Engineering Drive (2026 Batch)',
            ],
            [
                'role_title' => 'Associate Software Engineer (ASE)',
                'ctc_range' => '₹3.5 - 5.5 LPA',
                'drive_date' => now()->addDays(25),
                'duration_minutes' => 90,
                'min_cgpa' => 6.0,
                'max_backlogs' => 1,
                'eligible_branches' => ['CSE', 'IT', 'ECE', 'EEE', 'MECH'],
                'status' => PlacementDrive::STATUS_PUBLISHED,
                'terms_and_conditions' => "Tech Mahindra Campus Guidelines:\n"
                    ."1. Minimum 60% or 6.0 CGPA throughout 10th, 12th, and B.Tech with at most 1 active backlog at the time of assessment.\n"
                    ."2. Candidate must clear the Cognitive, Automata, Coding, and Conversational rounds to qualify for the final interview.\n"
                    ."3. Selected engineers must be willing to relocate to any Tech Mahindra delivery center (Pune, Bengaluru, Hyderabad, Chennai, Noida, Kolkata, Chandigarh) and support 24/7 rotational client shifts.",
            ]
        );

        if ($apex && $apexTpo) {
            DriveCollegeMapping::updateOrCreate(
                [
                    'placement_drive_id' => $techMDrive->id,
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

        $this->seedPrepQuestions($techM);
        $this->seedRecommendedProblems($techM);
    }

    private function seedPrepQuestions(Company $company): void
    {
        $path = database_path('data/tech_mahindra_prep_questions.json');
        if (! file_exists($path)) {
            $path = __DIR__.'/../data/tech_mahindra_prep_questions.json';
        }

        if (! file_exists($path)) {
            throw new RuntimeException("TechMahindraPlacementSeeder: missing data file at {$path}");
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
            ['problem_slug' => 'valid-palindrome', 'topic_tag' => 'Two Pointers String', 'priority' => 1],
            ['problem_slug' => 'reverse-words-in-a-string', 'topic_tag' => 'String Manipulation', 'priority' => 2],
            ['problem_slug' => 'two-sum', 'topic_tag' => 'Hash Map Lookup', 'priority' => 3],
            ['problem_slug' => 'valid-parentheses', 'topic_tag' => 'Stack Matching', 'priority' => 4],
            ['problem_slug' => 'maximum-subarray', 'topic_tag' => 'Dynamic Programming (Kadane)', 'priority' => 5],
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
