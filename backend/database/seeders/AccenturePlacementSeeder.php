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

class AccenturePlacementSeeder extends Seeder
{
    public function run(): void
    {
        $apex = College::where('short_code', 'APEX')->first();
        $apexTpo = User::where('email', 'tpo@apex.edu.in')->first();

        $accenture = Company::updateOrCreate(
            ['slug' => 'accenture'],
            [
                'name' => 'Accenture',
                'logo' => '🟣',
                'website_url' => 'https://www.accenture.com',
                'industry' => 'Technology Consulting & Services',
                'overview' => 'Accenture is a leading global professional services company that helps the world\'s leading businesses, '
                    .'governments, and other organizations build their digital core, optimize their operations, accelerate revenue '
                    .'growth, and enhance citizen services across more than 120 countries. Its flagship campus recruitment drives hire '
                    .'engineering freshers for Associate Software Engineer (ASE) and Advanced Application Engineering Associate (AASE) '
                    .'roles, evaluating candidates through a comprehensive multi-stage hiring model spanning cognitive ability, technical '
                    .'pseudocode, hands-on coding, automated spoken English communication assessments, and structured STAR-methodology interviews.',
                'hiring_process' => [
                    [
                        'name' => 'Cognitive & Technical Assessment',
                        'description' => 'Online proctored test covering English ability, critical reasoning, abstract problem solving, pseudocode tracing with bitwise operations, common applications & MS Office, and cloud/network security basics.',
                    ],
                    [
                        'name' => 'Coding Assessment',
                        'description' => 'Mandatory hands-on programming round with 2 coding problems to be solved in 45 minutes using C, C++, Java, or Python, emphasizing array/string manipulation, bitwise logic, and mathematical optimization.',
                    ],
                    [
                        'name' => 'Communication Assessment',
                        'description' => 'AI-proctored spoken English test (Versant / SVAr pattern) evaluating reading clarity, listening & repeating, sentence builds, short Q&A, story retelling, and open-ended extempore speaking.',
                    ],
                    [
                        'name' => 'Technical & Soft Skills Interview',
                        'description' => 'Final one-on-one panel interview conducting a deep dive into your resume projects, CS fundamentals (OOP, DBMS, OS, Data Structures), and behavioral questions evaluated via the STAR methodology.',
                    ],
                ],
                'is_active' => true,
            ]
        );

        $accentureDrive = PlacementDrive::updateOrCreate(
            [
                'company_id' => $accenture->id,
                'title' => 'Accenture — Associate Software Engineer & AASE Campus Drive (2026 Batch)',
            ],
            [
                'role_title' => 'Associate Software Engineer / AASE',
                'ctc_range' => '₹4.5 - 6.5 LPA',
                'drive_date' => now()->addDays(12),
                'duration_minutes' => 90,
                'min_cgpa' => 6.5,
                'max_backlogs' => 1,
                'eligible_branches' => ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL'],
                'status' => PlacementDrive::STATUS_PUBLISHED,
                'terms_and_conditions' => "Accenture Campus Recruitment Guidelines:\n"
                    ."1. Candidates must maintain a minimum of 65% or 6.5 CGPA with no more than 1 active backlog at the time of evaluation.\n"
                    ."2. Assessment rounds are sequential and elimination-based: passing the Cognitive & Technical round is required to unlock Coding.\n"
                    ."3. The Communication Assessment requires a quiet room, stable broadband, and a working headset with microphone.\n"
                    ."4. Selected candidates must be willing to work across any Accenture India delivery center and support rotational project shifts.",
            ]
        );

        if ($apex && $apexTpo) {
            DriveCollegeMapping::updateOrCreate(
                [
                    'placement_drive_id' => $accentureDrive->id,
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

        $this->seedPrepQuestions($accenture);
        $this->seedRecommendedProblems($accenture);
    }

    private function seedPrepQuestions(Company $company): void
    {
        $path = database_path('data/accenture_prep_questions.json');
        if (! file_exists($path)) {
            $path = __DIR__.'/../data/accenture_prep_questions.json';
        }

        if (! file_exists($path)) {
            throw new RuntimeException("AccenturePlacementSeeder: missing data file at {$path}");
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
            ['problem_slug' => 'two-sum', 'topic_tag' => 'Arrays & Hash Maps', 'priority' => 1],
            ['problem_slug' => 'valid-palindrome', 'topic_tag' => 'Strings & Two Pointers', 'priority' => 2],
            ['problem_slug' => 'reverse-string', 'topic_tag' => 'In-Place Manipulation', 'priority' => 3],
            ['problem_slug' => 'single-number', 'topic_tag' => 'Bitwise Logic', 'priority' => 4],
            ['problem_slug' => 'implement-strstr', 'topic_tag' => 'String Pattern Search', 'priority' => 5],
            ['problem_slug' => 'merge-two-sorted-arrays', 'topic_tag' => 'Two Pointers', 'priority' => 6],
            ['problem_slug' => 'maximum-subarray', 'topic_tag' => 'Kadane Algorithm', 'priority' => 7],
            ['problem_slug' => 'valid-parentheses', 'topic_tag' => 'Stack Fundamentals', 'priority' => 8],
        ];

        foreach ($problems as $p) {
            CompanyRecommendedProblem::updateOrCreate(
                ['company_id' => $company->id, 'problem_slug' => $p['problem_slug']],
                ['topic_tag' => $p['topic_tag'], 'priority' => $p['priority']]
            );
        }
    }
}

