<?php

namespace Database\Seeders;

use App\Models\College;
use App\Models\Company;
use App\Models\CompanyRecommendedInterviewQuestion;
use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewQuestionBank;
use App\Models\PlacementDrive;
use App\Models\User;
use Illuminate\Database\Seeder;

class AccentureInterviewQuestionSetSeeder extends Seeder
{
    public function run(): void
    {
        $priya = User::where('email', 'priya@mellow.ai')->first()
            ?? User::where('role', User::ROLE_SUPERADMIN)->first();

        $accenture = Company::where('slug', 'accenture')->first();
        $drive = $accenture ? PlacementDrive::where('company_id', $accenture->id)->first() : null;
        $apex = College::where('short_code', 'APEX')->first();

        $questions = $this->questions();

        $savedBankQuestions = [];
        foreach ($questions as $q) {
            $bankQuestion = InterviewQuestionBank::updateOrCreate(
                ['question_text' => $q['q']],
                [
                    'category' => $q['cat'],
                    'difficulty' => $q['diff'],
                    'expected_duration_seconds' => $q['dur'],
                    'tags' => $q['tags'],
                    'notes_for_reviewer' => $q['note'],
                    'is_active' => true,
                    'created_by' => $priya?->id,
                ]
            );

            if ($accenture) {
                CompanyRecommendedInterviewQuestion::firstOrCreate([
                    'company_id' => $accenture->id,
                    'interview_question_bank_id' => $bankQuestion->id,
                ]);
            }

            $savedBankQuestions[] = $bankQuestion;
        }

        if ($accenture && $drive && $priya) {
            $interview = Interview::updateOrCreate(
                ['slug' => 'accenture-ase-technical-hr-mock-interview'],
                [
                    'title' => 'Accenture — Associate Software Engineer Mock Interview',
                    'description' => 'Comprehensive spoken AI mock interview patterned after Accenture ASE / AASE campus drives. Evaluates core CS subjects (OOPs, DBMS, OS, Networks) and STAR-format behavioral adaptability.',
                    'status' => Interview::STATUS_PUBLISHED,
                    'interview_type' => Interview::INTERVIEW_TYPE_COMPANY,
                    'company_id' => $accenture->id,
                    'placement_drive_id' => $drive->id,
                    'created_by' => $priya->id,
                ]
            );

            foreach ($savedBankQuestions as $order => $bankQ) {
                InterviewQuestion::updateOrCreate(
                    [
                        'interview_id' => $interview->id,
                        'interview_question_bank_id' => $bankQ->id,
                    ],
                    [
                        'display_order' => $order,
                    ]
                );
            }

            if ($apex) {
                $interview->colleges()->syncWithoutDetaching([$apex->id]);
            }
        }
    }

    /**
     * Authentic Accenture campus drive interview questions:
     * Spanning Technical, Behavioral (STAR), and HR categories.
     */
    private function questions(): array
    {
        return [
            [
                'q' => 'Explain the four core pillars of Object-Oriented Programming (OOP) and give a practical example of polymorphism in enterprise software.',
                'cat' => 'technical',
                'diff' => 'easy',
                'dur' => 210,
                'tags' => ['accenture', 'oops', 'polymorphism'],
                'note' => 'Listen for encapsulation, abstraction, inheritance, and polymorphism with runtime vs compile-time distinction (method overriding vs overloading).',
            ],
            [
                'q' => 'What is the difference between SQL and NoSQL databases, and how would you decide which to use when architecting a new application for an Accenture enterprise client?',
                'cat' => 'technical',
                'diff' => 'medium',
                'dur' => 240,
                'tags' => ['accenture', 'databases', 'sql', 'nosql'],
                'note' => 'Candidate should weigh ACID transactions, schema rigidity, vertical vs horizontal scaling, and read/write load patterns.',
            ],
            [
                'q' => 'Explain database normalization up to 3NF and why it is essential for preventing update anomalies in transactional tables.',
                'cat' => 'technical',
                'diff' => 'medium',
                'dur' => 210,
                'tags' => ['accenture', 'dbms', 'normalization'],
                'note' => 'Look for atomic attributes (1NF), elimination of partial dependencies (2NF), and removal of transitive dependencies (3NF).',
            ],
            [
                'q' => 'Explain the fundamental differences between a process and a thread, and how multi-threading impacts operating system memory allocation.',
                'cat' => 'technical',
                'diff' => 'medium',
                'dur' => 240,
                'tags' => ['accenture', 'operating-systems', 'concurrency'],
                'note' => 'Expect explanation of isolated virtual address space for processes versus shared heap and separate call stacks for threads.',
            ],
            [
                'q' => 'What are the key differences between TCP and UDP protocols, and in what scenarios would you choose UDP over TCP?',
                'cat' => 'technical',
                'diff' => 'easy',
                'dur' => 180,
                'tags' => ['accenture', 'networking', 'tcp-udp'],
                'note' => 'Reliable connection-oriented vs connectionless low-latency streaming (DNS, VoIP, online video).',
            ],
            [
                'q' => 'Tell me about a time when you experienced a difficult disagreement with a teammate on a technical decision. How did you resolve it using the STAR framework?',
                'cat' => 'behavioral',
                'diff' => 'medium',
                'dur' => 210,
                'tags' => ['accenture', 'star-method', 'conflict-resolution', 'teamwork'],
                'note' => 'Candidate must use clear STAR structure (Situation, Task, Action, Result) showing empathy, objective evaluation, and team-first alignment.',
            ],
            [
                'q' => 'Describe a situation where you made a mistake or faced a failure in code or project planning. How did you handle accountability?',
                'cat' => 'behavioral',
                'diff' => 'medium',
                'dur' => 210,
                'tags' => ['accenture', 'star-method', 'accountability', 'resilience'],
                'note' => 'Look for honest ownership, immediate root cause analysis, transparent communication with team leads, and systemic preventive measures.',
            ],
            [
                'q' => 'Describe a time when you had to learn an unfamiliar programming language or framework within a few days to deliver a project milestone.',
                'cat' => 'behavioral',
                'diff' => 'easy',
                'dur' => 180,
                'tags' => ['accenture', 'star-method', 'adaptability', 'learning-agility'],
                'note' => 'Assess self-directed learning ability, reading documentation, hands-on experimentation, and delivering under tight timelines.',
            ],
            [
                'q' => 'Why do you want to join Accenture specifically, and how do you envision your career progressing within our Technology Consulting practice over the next three years?',
                'cat' => 'hr',
                'diff' => 'easy',
                'dur' => 180,
                'tags' => ['accenture', 'motivation', 'career-vision'],
                'note' => 'Should mention Accenture scale, continuous upskilling culture, digital core transformation, and realistic 3-year growth goals.',
            ],
            [
                'q' => 'Accenture serves global clients across diverse time zones. Are you open to relocating to any of our delivery centers across India and supporting flexible rotational shifts?',
                'cat' => 'hr',
                'diff' => 'easy',
                'dur' => 120,
                'tags' => ['accenture', 'flexibility', 'relocation'],
                'note' => 'Decisive affirmation, understanding of global enterprise delivery, and positive attitude toward relocation.',
            ],
        ];
    }
}

