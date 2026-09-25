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

/**
 * Seeds the placement-drive catalog with realistic placeholder content
 * (Infosys plus two lighter companies) so the student "prepare" flow, the
 * TPO map/unmap flow, and the Mellow staff catalog are all demoable against
 * real tables from day one. Swapping this for real company/drive/question
 * data later is a data change only — re-run this seeder with updated values,
 * or insert/edit rows directly (or via the /admin/placements UI); no schema
 * or code changes are needed.
 */
class PlacementSeeder extends Seeder
{
    public function run(): void
    {
        $apex = College::where('short_code', 'APEX')->first();
        $apexTpo = User::where('email', 'tpo@apex.edu.in')->first();

        if (! $apex || ! $apexTpo) {
            // DatabaseSeeder always seeds these first; bail quietly if run standalone
            // against a database that hasn't run the base seeder yet.
            return;
        }

        $infosys = Company::updateOrCreate(
            ['slug' => 'infosys'],
            [
                'name' => 'Infosys',
                'logo' => '🔷',
                'website_url' => 'https://www.infosys.com',
                'industry' => 'IT Services & Consulting',
                'overview' => 'Infosys is a global leader in next-generation digital services and consulting, '
                    .'helping enterprises across 50+ countries modernize their technology and business operations. '
                    .'Its campus hiring program brings in engineering graduates for software development, systems '
                    .'engineering, and digital specialist roles, with a strong emphasis on foundational programming, '
                    .'logical reasoning, and communication skills.',
                'hiring_process' => [
                    ['name' => 'Online Assessment', 'description' => 'A proctored online test covering quantitative aptitude, logical reasoning, verbal ability, and a basic coding round.'],
                    ['name' => 'Technical Interview', 'description' => 'A one-on-one round covering programming fundamentals, data structures, DBMS/OS basics, and a walkthrough of your projects/resume.'],
                    ['name' => 'HR Interview', 'description' => 'A conversational round assessing communication, flexibility for relocation/shifts, and overall culture fit.'],
                ],
                'is_active' => true,
            ]
        );

        $infosysDrive = PlacementDrive::updateOrCreate(
            [
                'company_id' => $infosys->id,
                'title' => 'Infosys — Systems Engineer Campus Drive (Sept 2026)',
            ],
            [
                'role_title' => 'Systems Engineer',
                'ctc_range' => '₹3.6 - 6.25 LPA',
                'drive_date' => now()->addDays(4),
                'duration_minutes' => 90,
                'min_cgpa' => 6.0,
                'max_backlogs' => 1,
                'eligible_branches' => null,
                'status' => PlacementDrive::STATUS_PUBLISHED,
            ]
        );

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

        $this->seedPrepQuestions($infosys);
        $this->seedRecommendedProblems($infosys);

        // A couple of lighter, unmapped companies so a TPO's "Available to
        // Map" list has more than one entry to demonstrate the map action on.
        $tcs = Company::updateOrCreate(
            ['slug' => 'tcs-digital'],
            [
                'name' => 'TCS Digital',
                'logo' => '🟦',
                'website_url' => 'https://www.tcs.com',
                'industry' => 'IT Services & Consulting',
                'overview' => 'TCS Digital is Tata Consultancy Services\' premium hiring track for graduates with '
                    .'strong programming fundamentals, targeting roles across full-stack development, cloud, and '
                    .'digital transformation projects.',
                'hiring_process' => [
                    ['name' => 'Online Assessment', 'description' => 'Aptitude, verbal, and a coding round on the NQT platform.'],
                    ['name' => 'Technical + HR Interview', 'description' => 'A combined round covering CS fundamentals, projects, and culture fit.'],
                ],
                'is_active' => true,
            ]
        );

        PlacementDrive::updateOrCreate(
            [
                'company_id' => $tcs->id,
                'title' => 'TCS Digital — Graduate Campus Drive (Oct 2026)',
            ],
            [
                'role_title' => 'Digital Trainee',
                'ctc_range' => '₹7 - 9 LPA',
                'drive_date' => now()->addDays(18),
                'duration_minutes' => 90,
                'min_cgpa' => 7.0,
                'max_backlogs' => 0,
                'eligible_branches' => ['CSE', 'IT', 'ECE'],
                'status' => PlacementDrive::STATUS_PUBLISHED,
            ]
        );

        $wipro = Company::updateOrCreate(
            ['slug' => 'wipro'],
            [
                'name' => 'Wipro',
                'logo' => '🟩',
                'website_url' => 'https://www.wipro.com',
                'industry' => 'IT Services & Consulting',
                'overview' => 'Wipro is a leading technology services and consulting company, hiring campus '
                    .'graduates into its Wipro Elite National Talent Hunt (WE-NTH) program for software engineering '
                    .'roles across its global delivery centers.',
                'hiring_process' => [
                    ['name' => 'Online Assessment', 'description' => 'Aptitude, English, and coding assessment.'],
                    ['name' => 'Technical Interview', 'description' => 'Programming fundamentals and project discussion.'],
                    ['name' => 'HR Interview', 'description' => 'Final culture-fit and offer discussion round.'],
                ],
                'is_active' => true,
            ]
        );

        PlacementDrive::updateOrCreate(
            [
                'company_id' => $wipro->id,
                'title' => 'Wipro Elite — National Talent Hunt (Oct 2026)',
            ],
            [
                'role_title' => 'Project Engineer',
                'ctc_range' => '₹3.5 - 6.5 LPA',
                'drive_date' => now()->addDays(25),
                'duration_minutes' => 75,
                'min_cgpa' => 6.0,
                'max_backlogs' => 2,
                'eligible_branches' => null,
                'status' => PlacementDrive::STATUS_PUBLISHED,
            ]
        );
    }

    private function seedPrepQuestions(Company $company): void
    {
        $questions = [
            // 2025
            ['asked_year' => 2025, 'category' => 'Aptitude', 'round_name' => 'Online Assessment', 'question' => 'A train 150m long crosses a platform of length 250m in 20 seconds. What is the speed of the train in km/hr?', 'answer_notes' => 'Total distance = 150 + 250 = 400m in 20s → speed = 20 m/s = 72 km/hr.'],
            ['asked_year' => 2025, 'category' => 'Coding', 'round_name' => 'Online Assessment', 'question' => 'Reverse a singly linked list in groups of size k.', 'answer_notes' => 'Iteratively reverse each k-sized group, tracking the previous group\'s tail to reconnect the list.'],
            ['asked_year' => 2025, 'category' => 'Technical', 'round_name' => 'Technical Interview', 'question' => 'Explain the ACID properties in DBMS with a real-world example.', 'answer_notes' => 'Atomicity, Consistency, Isolation, Durability — e.g. a bank transfer must debit and credit together (atomicity) or not at all.'],
            ['asked_year' => 2025, 'category' => 'HR', 'round_name' => 'HR Interview', 'question' => 'Why do you want to join Infosys?', 'answer_notes' => 'Anchor your answer in Infosys\' scale, learning culture, and how it fits your career goals — avoid generic answers.'],
            // 2024
            ['asked_year' => 2024, 'category' => 'Aptitude', 'round_name' => 'Online Assessment', 'question' => 'The ratio of ages of A and B is 3:5. After 6 years, the ratio becomes 2:3. Find their current ages.', 'answer_notes' => 'Let ages be 3x and 5x. (3x+6)/(5x+6) = 2/3 → x = 6, so ages are 18 and 30.'],
            ['asked_year' => 2024, 'category' => 'Coding', 'round_name' => 'Online Assessment', 'question' => 'Find the longest palindromic substring in a given string.', 'answer_notes' => 'Expand around each center (2n-1 centers) in O(n²), or use Manacher\'s algorithm for O(n).'],
            ['asked_year' => 2024, 'category' => 'Technical', 'round_name' => 'Technical Interview', 'question' => 'What is the difference between a process and a thread?', 'answer_notes' => 'A process has its own memory space; threads within a process share memory but have separate stacks/registers.'],
            ['asked_year' => 2024, 'category' => 'HR', 'round_name' => 'HR Interview', 'question' => 'Tell us about a time you worked in a team to solve a difficult problem.', 'answer_notes' => 'Use a STAR (Situation, Task, Action, Result) structure with a concrete, specific example.'],
            // 2023
            ['asked_year' => 2023, 'category' => 'Aptitude', 'round_name' => 'Online Assessment', 'question' => 'A can complete a work in 12 days and B in 18 days. Working together, how many days will they take?', 'answer_notes' => 'Combined rate = 1/12 + 1/18 = 5/36 per day → 36/5 = 7.2 days.'],
            ['asked_year' => 2023, 'category' => 'Coding', 'round_name' => 'Online Assessment', 'question' => 'Given an array of integers, find two numbers such that they add up to a specific target (Two Sum).', 'answer_notes' => 'Use a hash map of value → index while scanning once, checking for target - current at each step, for O(n).'],
            ['asked_year' => 2023, 'category' => 'Technical', 'round_name' => 'Technical Interview', 'question' => 'Explain normalization in DBMS and its normal forms (1NF, 2NF, 3NF).', 'answer_notes' => 'Normalization reduces redundancy: 1NF (atomic columns), 2NF (no partial dependency), 3NF (no transitive dependency).'],
            ['asked_year' => 2023, 'category' => 'HR', 'round_name' => 'HR Interview', 'question' => 'Where do you see yourself in 5 years?', 'answer_notes' => 'Focus on realistic growth within the company/industry rather than an unrelated career pivot.'],
        ];

        foreach ($questions as $index => $q) {
            CompanyPrepQuestion::updateOrCreate(
                [
                    'company_id' => $company->id,
                    'asked_year' => $q['asked_year'],
                    'question' => $q['question'],
                ],
                [
                    'category' => $q['category'],
                    'round_name' => $q['round_name'],
                    'answer_notes' => $q['answer_notes'],
                    'display_order' => $index,
                ]
            );
        }
    }

    private function seedRecommendedProblems(Company $company): void
    {
        $problems = [
            ['problem_slug' => 'two-sum', 'topic_tag' => 'Arrays', 'priority' => 1],
            ['problem_slug' => 'valid-parentheses', 'topic_tag' => 'Stack', 'priority' => 2],
            ['problem_slug' => 'binary-search', 'topic_tag' => 'Binary Search', 'priority' => 3],
            ['problem_slug' => 'merge-intervals', 'topic_tag' => 'Sorting', 'priority' => 4],
            ['problem_slug' => 'coin-change', 'topic_tag' => 'Dynamic Programming', 'priority' => 5],
        ];

        foreach ($problems as $p) {
            CompanyRecommendedProblem::updateOrCreate(
                ['company_id' => $company->id, 'problem_slug' => $p['problem_slug']],
                ['topic_tag' => $p['topic_tag'], 'priority' => $p['priority']]
            );
        }
    }
}
