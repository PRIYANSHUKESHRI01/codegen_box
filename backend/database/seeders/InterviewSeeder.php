<?php

namespace Database\Seeders;

use App\Models\College;
use App\Models\Company;
use App\Models\CompanyRecommendedInterviewQuestion;
use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewQuestionBank;
use App\Models\InterviewResponse;
use App\Models\InterviewSession;
use App\Models\PlacementDrive;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Demo Interview rows covering every state a fresh install should be able
 * to show without any manual clicking: a published `general` interview with
 * a completed session (transcripts filled), a `company` interview still in
 * draft (the pre-publish assembly state), and a published `tpo_mock`
 * interview with a mid-way `in_progress` session (the resume-where-you-left-
 * off state). Requires InterviewQuestionBankSeeder/CampusRosterSeeder/
 * PlacementSeeder to have already run.
 */
class InterviewSeeder extends Seeder
{
    public function run(): void
    {
        $priya = User::where('email', 'priya@mellow.ai')->first();
        $apex = College::where('short_code', 'APEX')->first();
        $apexTpo = User::where('email', 'tpo@apex.edu.in')->first();
        $alex = User::where('email', 'alex.chen@student.apex.edu')->first();

        if (! $priya || ! $apex || ! $apexTpo || ! $alex) {
            return;
        }

        $this->seedGeneralInterview($priya, $alex);
        $this->seedCompanyInterview($priya, $apex);
        $this->seedTpoMockInterview($apexTpo, $apex, $alex);
    }

    private function seedGeneralInterview(User $priya, User $alex): void
    {
        $interview = Interview::updateOrCreate(
            ['slug' => 'general-practice-interview-foundations'],
            [
                'title' => 'General Practice Interview — Engineering Foundations',
                'description' => 'A platform-wide practice interview mixing core CS fundamentals with behavioral questions — open to every student.',
                'status' => Interview::STATUS_PUBLISHED,
                'interview_type' => Interview::INTERVIEW_TYPE_GENERAL,
                'created_by' => $priya->id,
            ]
        );

        $questionTexts = [
            'What is the difference between SQL and NoSQL databases, and how would you decide which to use for a new project?',
            'How would you detect a cycle in a linked list? Explain your approach and why it works.',
            'Tell me about a project you are most proud of. What was your specific contribution?',
            'Why do you want to work at our company specifically?',
        ];

        $interviewQuestions = $this->attachQuestions($interview, $questionTexts);

        $session = InterviewSession::updateOrCreate(
            ['interview_id' => $interview->id, 'user_id' => $alex->id],
            [
                'status' => InterviewSession::STATUS_COMPLETED,
                'started_at' => now()->subDays(2)->subMinutes(20),
                'completed_at' => now()->subDays(2),
                'current_question_order' => count($interviewQuestions),
            ]
        );

        $sampleAnswers = [
            "I'd lean towards SQL for this kind of project since the data is highly relational and we need strong consistency guarantees — things like foreign keys and transactions matter a lot here. If we later needed to handle huge write volumes with a flexible schema, I'd reconsider a document store.",
            "I'd use the fast and slow pointer approach — two pointers starting at the head, one moving one step at a time and the other two steps. If there's a cycle, the fast pointer will eventually lap the slow one and they'll meet. If there's no cycle, the fast pointer reaches the end first.",
            "I'm most proud of a campus placement tracker I built for my department — I owned the entire backend, designed the schema, and built the REST API that the frontend team consumed. It's still being used by my seniors.",
            "I looked into your engineering blog and the way your team approaches on-call and incident response really stood out to me — it matches how I want to grow as an engineer, learning to own production systems end to end.",
        ];

        foreach ($interviewQuestions as $index => $interviewQuestion) {
            InterviewResponse::updateOrCreate(
                ['interview_session_id' => $session->id, 'interview_question_id' => $interviewQuestion->id],
                [
                    'transcript_text' => $sampleAnswers[$index] ?? 'Sample answer text.',
                    'answered_at' => now()->subDays(2)->addMinutes($index * 4),
                ]
            );
        }
    }

    private function seedCompanyInterview(User $priya, College $apex): void
    {
        $infosys = Company::where('slug', 'infosys')->first();
        $drive = $infosys ? PlacementDrive::where('company_id', $infosys->id)->first() : null;

        if (! $infosys || ! $drive) {
            return;
        }

        $interview = Interview::updateOrCreate(
            ['slug' => 'infosys-systems-engineer-technical-interview'],
            [
                'title' => 'Infosys — Systems Engineer Technical Interview',
                'description' => 'Draft — still being assembled. A technical + HR interview for the Infosys Systems Engineer campus drive.',
                'status' => Interview::STATUS_DRAFT,
                'interview_type' => Interview::INTERVIEW_TYPE_COMPANY,
                'company_id' => $infosys->id,
                'placement_drive_id' => $drive->id,
                'created_by' => $priya->id,
            ]
        );

        $bankQuestion = InterviewQuestionBank::where(
            'question_text',
            'What is object-oriented programming, and what are its four main principles?'
        )->first();

        if ($bankQuestion !== null) {
            CompanyRecommendedInterviewQuestion::firstOrCreate([
                'company_id' => $infosys->id,
                'interview_question_bank_id' => $bankQuestion->id,
            ]);

            InterviewQuestion::firstOrCreate(
                ['interview_id' => $interview->id, 'interview_question_bank_id' => $bankQuestion->id],
                ['display_order' => 0]
            );
        }

        $interview->colleges()->syncWithoutDetaching([$apex->id]);
    }

    private function seedTpoMockInterview(User $apexTpo, College $apex, User $alex): void
    {
        $interview = Interview::updateOrCreate(
            ['slug' => 'apex-tpo-mock-hr-round'],
            [
                'title' => 'Apex Mock Interview — HR & Behavioral Round',
                'description' => "Apex TPO's own private practice round for Apex students only.",
                'status' => Interview::STATUS_PUBLISHED,
                'interview_type' => Interview::INTERVIEW_TYPE_TPO_MOCK,
                'owning_college_id' => $apex->id,
                'created_by' => $apexTpo->id,
            ]
        );

        $questionTexts = [
            'Where do you see yourself in three years?',
            'Tell me about a time you disagreed with a teammate on a technical decision. How did you handle it?',
            'What is an area you are actively working to improve?',
        ];

        $interviewQuestions = $this->attachQuestions($interview, $questionTexts);

        $session = InterviewSession::updateOrCreate(
            ['interview_id' => $interview->id, 'user_id' => $alex->id],
            [
                'status' => InterviewSession::STATUS_IN_PROGRESS,
                'started_at' => now()->subHours(3),
                'current_question_order' => 1,
            ]
        );

        if (isset($interviewQuestions[0])) {
            InterviewResponse::updateOrCreate(
                ['interview_session_id' => $session->id, 'interview_question_id' => $interviewQuestions[0]->id],
                [
                    'transcript_text' => "In three years I'd like to be leading a small feature team, still hands-on with code but also mentoring newer engineers the way my seniors have mentored me.",
                    'answered_at' => now()->subHours(3)->addMinutes(3),
                ]
            );
        }
    }

    /** @return list<InterviewQuestion> in display order */
    private function attachQuestions(Interview $interview, array $questionTexts): array
    {
        $attached = [];

        foreach ($questionTexts as $order => $text) {
            $bankQuestion = InterviewQuestionBank::where('question_text', $text)->first();

            if ($bankQuestion === null) {
                continue;
            }

            $attached[] = InterviewQuestion::updateOrCreate(
                ['interview_id' => $interview->id, 'interview_question_bank_id' => $bankQuestion->id],
                ['display_order' => $order]
            );
        }

        return $attached;
    }
}
