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

class TcsPlacementSeeder extends Seeder
{
    public function run(): void
    {
        $apex = College::where('short_code', 'APEX')->first();
        $apexTpo = User::where('email', 'tpo@apex.edu.in')->first();

        $tcs = Company::updateOrCreate(
            ['slug' => 'tcs-digital'],
            [
                'name' => 'TCS (Tata Consultancy Services)',
                'logo' => '🟦',
                'website_url' => 'https://www.tcs.com',
                'industry' => 'IT Services & Digital Transformation',
                'overview' => 'Tata Consultancy Services (TCS) is the flagship IT enterprise of the Tata Group and the largest technology employer in India with over 600,000 professionals across 55 countries. Its flagship campus hiring vehicle is the TCS National Qualifier Test (TCS NQT), which channels graduates into three differentiated merit tiers: TCS Ninja (₹3.36 - 3.6 LPA), TCS Digital (₹7.0 - 7.5 LPA), and TCS Prime (₹9.0 - 11.5 LPA) for advanced cloud, full-stack, and AI engineering roles.',
                'hiring_process' => [
                    [
                        'name' => 'TCS NQT — Foundation Section',
                        'description' => 'Numerical Ability, Reasoning Ability, and Verbal Ability evaluating fundamental quantitative fluency and logical agility on the TCS iON proctored platform.',
                    ],
                    [
                        'name' => 'TCS NQT — Advanced Section (Digital & Prime)',
                        'description' => 'Advanced Quantitative and Reasoning Ability alongside 2 algorithmic coding challenges (Easy-Medium and Medium-Hard) to qualify for Digital and Prime upgrade tracks.',
                    ],
                    [
                        'name' => 'Technical Interview (TR)',
                        'description' => 'Comprehensive technical evaluation covering Data Structures, Algorithms, DBMS, Operating Systems, Computer Networks, and final-year capstone engineering projects.',
                    ],
                    [
                        'name' => 'Managerial & HR Interview (MR/HR)',
                        'description' => 'Panel evaluation testing communication, problem-solving under pressure, adaptability to rotational shifts, relocation readiness, and alignment with the Tata Code of Conduct (TCoC).',
                    ],
                ],
                'is_active' => true,
            ]
        );

        $tcsDrive = PlacementDrive::updateOrCreate(
            [
                'company_id' => $tcs->id,
                'title' => 'TCS NQT — National Qualifier Campus Drive (2026 Batch)',
            ],
            [
                'role_title' => 'Ninja / Digital / Prime Software Engineer',
                'ctc_range' => '₹3.36 - 11.5 LPA',
                'drive_date' => now()->addDays(12),
                'duration_minutes' => 120,
                'min_cgpa' => 6.0,
                'max_backlogs' => 1,
                'eligible_branches' => ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL'],
                'status' => PlacementDrive::STATUS_PUBLISHED,
                'terms_and_conditions' => "TCS NQT Campus Guidelines:\n"
                    ."1. Minimum 60% or 6.0 CGPA throughout 10th, 12th, Diploma (if applicable), and B.Tech with at most 1 active backlog at the time of test.\n"
                    ."2. Foundation Section score determines Ninja eligibility; Advanced Section score determines Digital (₹7 LPA) or Prime (₹9-11.5 LPA) interview shortlisting.\n"
                    ."3. Selected graduates must adhere to the Tata Code of Conduct and be willing to relocate to any TCS delivery center across India.",
            ]
        );

        if ($apex && $apexTpo) {
            DriveCollegeMapping::updateOrCreate(
                [
                    'placement_drive_id' => $tcsDrive->id,
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

        $this->seedPrepQuestions($tcs);
        $this->seedRecommendedProblems($tcs);
    }

    private function seedPrepQuestions(Company $company): void
    {
        $path = database_path('data/tcs_prep_questions.json');
        if (! file_exists($path)) {
            $path = __DIR__.'/../data/tcs_prep_questions.json';
        }

        if (! file_exists($path)) {
            throw new RuntimeException("TcsPlacementSeeder: missing data file at {$path}");
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
            ['problem_slug' => 'trapping-rain-water', 'topic_tag' => 'Two Pointers & Arrays', 'priority' => 1],
            ['problem_slug' => 'longest-substring-without-repeating-characters', 'topic_tag' => 'Sliding Window', 'priority' => 2],
            ['problem_slug' => 'maximum-subarray', 'topic_tag' => 'Dynamic Programming (Kadane)', 'priority' => 3],
            ['problem_slug' => '3sum', 'topic_tag' => 'Two Pointers Sorting', 'priority' => 4],
            ['problem_slug' => 'two-sum', 'topic_tag' => 'Hash Map Lookup', 'priority' => 5],
            ['problem_slug' => 'valid-parentheses', 'topic_tag' => 'Stack Validation', 'priority' => 6],
            ['problem_slug' => 'merge-intervals', 'topic_tag' => 'Interval Sorting', 'priority' => 7],
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
