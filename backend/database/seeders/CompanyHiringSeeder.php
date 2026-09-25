<?php

namespace Database\Seeders;

use App\Models\College;
use App\Models\Company;
use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\ContestProblem;
use App\Models\DriveApplication;
use App\Models\DriveCollegeMapping;
use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewQuestionBank;
use App\Models\InterviewResponse;
use App\Models\InterviewSession;
use App\Models\PlacementDrive;
use App\Models\Problem;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeds two realistic demo pipelines for the Nimbus Labs hiring tenant (see
 * DatabaseSeeder): a direct-hire opening (invited candidates at varied
 * stages, so the Hiring Reports funnel/recent-hires/time-to-hire cards have
 * real numbers from day one) and a campus-drive opening proposed to real
 * colleges via the company-proposes-to-college flow — one PENDING (Meridian,
 * so that college's TPO has a real proposal to approve/decline in their
 * Pending Approvals tab) and one already APPROVED-with-scored-assessment
 * (Apex, so the Results/"add to pipeline" flow has real participant scores
 * to filter and import without any manual setup). Mirrors PlacementSeeder's
 * role in the campus-drive system: realistic placeholder data on real
 * tables, swappable later with no code changes.
 */
class CompanyHiringSeeder extends Seeder
{
    public function run(): void
    {
        $nimbus = Company::where('slug', 'nimbus-labs')->first();
        $hiringAdmin = User::where('email', 'hiring@nimbuslabs.example.com')->first();

        if (! $nimbus || ! $hiringAdmin) {
            // DatabaseSeeder always seeds these first; bail quietly if run standalone.
            return;
        }

        $drive = PlacementDrive::updateOrCreate(
            ['company_id' => $nimbus->id, 'title' => 'Nimbus Labs — Backend Engineer Hiring (Winter 2026)'],
            [
                'role_title' => 'Backend Engineer',
                'ctc_range' => '₹15 - 22 LPA',
                'drive_date' => now()->addDays(14),
                'duration_minutes' => 90,
                'status' => PlacementDrive::STATUS_PUBLISHED,
                'source' => PlacementDrive::SOURCE_COMPANY_DIRECT,
                'created_by' => $hiringAdmin->id,
            ]
        );

        // Three net-new candidates, invited directly by Nimbus (no college —
        // exactly the "company_invited" bucket the source_breakdown report
        // metric tracks) plus the flagship demo student, reused here to
        // demonstrate the "existing platform student" bucket without
        // fabricating a redundant account.
        $registered = User::updateOrCreate(
            ['email' => 'priya.nair@example.com'],
            [
                'name' => 'Priya Nair',
                'handle' => 'priya_nair_candidate',
                'password' => Hash::make('nimbus_candidate_demo_26'),
                'role' => User::ROLE_USER,
                'invited_by_company_id' => $nimbus->id,
            ]
        );

        $interviewing = User::updateOrCreate(
            ['email' => 'rahul.mehta@example.com'],
            [
                'name' => 'Rahul Mehta',
                'handle' => 'rahul_mehta_candidate',
                'password' => Hash::make('nimbus_candidate_demo_26'),
                'role' => User::ROLE_USER,
                'invited_by_company_id' => $nimbus->id,
            ]
        );

        $offered = User::updateOrCreate(
            ['email' => 'sneha.kulkarni@example.com'],
            [
                'name' => 'Sneha Kulkarni',
                'handle' => 'sneha_kulkarni_candidate',
                'password' => Hash::make('nimbus_candidate_demo_26'),
                'role' => User::ROLE_USER,
                'invited_by_company_id' => $nimbus->id,
            ]
        );

        $hired = User::where('email', 'alex.chen@student.apex.edu')->first();

        // `created_at` isn't fillable (see DriveApplication's own
        // "college_id is a deliberate snapshot" convention — timestamps are
        // Eloquent-managed), so backdating it to realistically precede
        // stage_updated_at needs an explicit forceFill after create. Without
        // this, every row's created_at lands on "now" (seed time), which
        // would put it AFTER a backdated stage_updated_at and make
        // HiringReportService::timeToHireDays() compute a negative number —
        // impossible in real usage (a stage can only update after the row
        // exists) but easy to get backwards here.
        $applications = [
            [$registered, DriveApplication::STAGE_REGISTERED, null, 1, 1],
            [$interviewing, DriveApplication::STAGE_TECHNICAL_INTERVIEW, null, 6, 2],
            [$offered, DriveApplication::STAGE_OFFER_EXTENDED, 19.5, 9, 3],
        ];

        if ($hired !== null) {
            $applications[] = [$hired, DriveApplication::STAGE_OFFER_ACCEPTED, 21, 15, 5];
        }

        foreach ($applications as [$candidate, $stage, $ctc, $createdDaysAgo, $updatedDaysAgo]) {
            $application = DriveApplication::firstOrNew(['placement_drive_id' => $drive->id, 'user_id' => $candidate->id]);
            $application->fill([
                'college_id' => $candidate->college_id,
                'stage' => $stage,
                'ctc_offered' => $ctc,
            ]);
            $application->forceFill([
                'created_at' => now()->subDays($createdDaysAgo),
                'stage_updated_at' => now()->subDays($updatedDaysAgo),
            ])->save();
        }

        $contest = Contest::updateOrCreate(
            ['slug' => 'nimbus-labs-backend-engineer-online-assessment'],
            [
                'title' => 'Nimbus Labs — Backend Engineer Online Assessment',
                'description' => 'A 90-minute proctored coding round for the Winter 2026 Backend Engineer opening.',
                'start_at' => now()->subHours(2),
                'end_at' => now()->addDays(3),
                'is_rated' => false,
                'status' => Contest::STATUS_PUBLISHED,
                'contest_type' => Contest::CONTEST_TYPE_COMPANY_HIRING,
                'company_id' => $nimbus->id,
                'owning_company_id' => $nimbus->id,
                'placement_drive_id' => $drive->id,
                'created_by' => $hiringAdmin->id,
            ]
        );

        $twoSum = Problem::where('slug', 'two-sum')->first();
        if ($twoSum !== null) {
            ContestProblem::updateOrCreate(
                ['contest_id' => $contest->id, 'problem_id' => $twoSum->id],
                ['points' => 100, 'display_order' => 0]
            );
        }

        // Only candidates still active in the pipeline are invited — the
        // offer-extended/accepted candidates above are past the assessment
        // stage, matching how a real recruiter would use this.
        foreach ([$registered, $interviewing] as $candidate) {
            ContestParticipant::firstOrCreate(
                ['contest_id' => $contest->id, 'user_id' => $candidate->id],
                ['registered_at' => now()->subHours(1)]
            );
        }

        $this->seedCampusDriveDemo($nimbus, $hiringAdmin);
        $this->seedInterviewDemo($nimbus, $drive, $hiringAdmin, $interviewing);
    }

    /**
     * One seeder row that lets a fresh `migrate:fresh --seed` demonstrate
     * the hiring-partner's interview review screen with zero manual setup:
     * Rahul Mehta ($interviewing) already sits at STAGE_TECHNICAL_INTERVIEW
     * on the direct-hire drive above — the exact candidate a recruiter would
     * shortlist for an AI interview next, so this reuses him rather than
     * fabricating a fourth candidate.
     */
    private function seedInterviewDemo(Company $nimbus, PlacementDrive $drive, User $hiringAdmin, User $interviewing): void
    {
        $interview = Interview::updateOrCreate(
            ['slug' => 'nimbus-labs-backend-engineer-ai-interview'],
            [
                'title' => 'Nimbus Labs — Backend Engineer AI Interview',
                'description' => 'A voice interview for shortlisted Backend Engineer candidates on the Winter 2026 opening.',
                'status' => Interview::STATUS_PUBLISHED,
                'interview_type' => Interview::INTERVIEW_TYPE_COMPANY_HIRING,
                'company_id' => $nimbus->id,
                'owning_company_id' => $nimbus->id,
                'placement_drive_id' => $drive->id,
                'created_by' => $hiringAdmin->id,
            ]
        );

        $questionTexts = [
            'Walk me through how you would design a rate limiter for a public API. What data structure would you use and why?',
            'What are the ACID properties of a database transaction, and why do they matter?',
            'Tell me about a time you disagreed with a teammate on a technical decision. How did you handle it?',
        ];

        $interviewQuestions = [];
        foreach ($questionTexts as $order => $text) {
            $bankQuestion = InterviewQuestionBank::where('question_text', $text)->first();
            if ($bankQuestion === null) {
                continue;
            }

            $interviewQuestions[] = InterviewQuestion::updateOrCreate(
                ['interview_id' => $interview->id, 'interview_question_bank_id' => $bankQuestion->id],
                ['display_order' => $order]
            );
        }

        // The same firstOrCreate shape CompanyInterviewController::
        // inviteCandidates() uses — this candidate is already in the
        // drive's DriveApplication pipeline (seeded above), so the eligibility
        // check that method performs would pass for real.
        $session = InterviewSession::updateOrCreate(
            ['interview_id' => $interview->id, 'user_id' => $interviewing->id],
            [
                'status' => InterviewSession::STATUS_COMPLETED,
                'invited_at' => now()->subDays(4),
                'invited_by' => $hiringAdmin->id,
                'started_at' => now()->subDays(3),
                'completed_at' => now()->subDays(3),
                'current_question_order' => count($interviewQuestions),
            ]
        );

        $sampleAnswers = [
            "I'd use a token bucket algorithm backed by Redis — each client gets a bucket that refills at a fixed rate, and every request costs one token. Redis makes it easy to share the bucket state across multiple API servers, and the INCR/EXPIRE commands make it close to atomic without needing a full lock.",
            "Atomicity, consistency, isolation, and durability. They matter because without them a partial failure — like the server crashing halfway through a bank transfer — could leave the database in a corrupted state, like money leaving one account without arriving in the other.",
            "On my last team, a teammate wanted to use a third-party library for something I thought we could build more reliably ourselves. Instead of pushing back in the PR comments, I set up a quick call, we prototyped both approaches in about an hour, and the data made the decision for us rather than either of our opinions.",
        ];

        foreach ($interviewQuestions as $index => $interviewQuestion) {
            InterviewResponse::updateOrCreate(
                ['interview_session_id' => $session->id, 'interview_question_id' => $interviewQuestion->id],
                [
                    'transcript_text' => $sampleAnswers[$index] ?? 'Sample answer text.',
                    'answered_at' => now()->subDays(3)->addMinutes($index * 5),
                ]
            );
        }
    }

    /**
     * The company-proposes-to-college flow's own demo data — separate from
     * the direct-hire opening above, so both real paths through the company
     * dashboard have realistic data without requiring any manual clicks.
     */
    private function seedCampusDriveDemo(Company $nimbus, User $hiringAdmin): void
    {
        $apex = College::where('short_code', 'APEX')->first();
        $meridian = College::where('short_code', 'MERI')->first();
        $apexTpo = User::where('email', 'tpo@apex.edu.in')->first();

        if (! $apex || ! $meridian || ! $apexTpo) {
            return;
        }

        $campusDrive = PlacementDrive::updateOrCreate(
            ['company_id' => $nimbus->id, 'title' => 'Nimbus Labs — Frontend Engineer Campus Drive (Winter 2026)'],
            [
                'role_title' => 'Frontend Engineer',
                'ctc_range' => '₹12 - 16 LPA',
                'drive_date' => now()->addDays(20),
                'duration_minutes' => 90,
                'status' => PlacementDrive::STATUS_PUBLISHED,
                'source' => PlacementDrive::SOURCE_COMPANY_DIRECT,
                'created_by' => $hiringAdmin->id,
            ]
        );

        // Meridian: left PENDING deliberately — that college's TPO sees a
        // real, unresolved proposal from a company (not Mellow) the moment
        // they open their Pending Approvals tab.
        DriveCollegeMapping::updateOrCreate(
            ['placement_drive_id' => $campusDrive->id, 'college_id' => $meridian->id],
            [
                'mapped_by' => $hiringAdmin->id,
                'mapped_at' => now()->subDays(1),
                'is_active' => false,
                'status' => DriveCollegeMapping::STATUS_PENDING,
            ]
        );

        // Apex: pre-APPROVED (simulating the TPO having already said yes) so
        // the assessment/results/import flow has real data to demo without
        // needing to drive the approval UI first.
        DriveCollegeMapping::updateOrCreate(
            ['placement_drive_id' => $campusDrive->id, 'college_id' => $apex->id],
            [
                'mapped_by' => $hiringAdmin->id,
                'mapped_at' => now()->subDays(3),
                'is_active' => true,
                'status' => DriveCollegeMapping::STATUS_APPROVED,
                'approved_by' => $apexTpo->id,
                'approved_at' => now()->subDays(2),
            ]
        );

        $campusContest = Contest::updateOrCreate(
            ['slug' => 'nimbus-labs-frontend-engineer-campus-assessment'],
            [
                'title' => 'Nimbus Labs — Frontend Engineer Campus Assessment',
                'description' => 'A proctored coding round for Apex students, open to anyone from an approved campus.',
                'start_at' => now()->subDays(1),
                'end_at' => now()->subHours(6),
                'is_rated' => false,
                'status' => Contest::STATUS_PUBLISHED,
                'contest_type' => Contest::CONTEST_TYPE_COMPANY_HIRING,
                'company_id' => $nimbus->id,
                'owning_company_id' => $nimbus->id,
                'placement_drive_id' => $campusDrive->id,
                'created_by' => $hiringAdmin->id,
            ]
        );

        $twoSum = Problem::where('slug', 'two-sum')->first();
        if ($twoSum !== null) {
            ContestProblem::updateOrCreate(
                ['contest_id' => $campusContest->id, 'problem_id' => $twoSum->id],
                ['points' => 100, 'display_order' => 0]
            );
        }

        // Three Apex students who self-registered because their college
        // approved the drive — never invited, exercising Contest::
        // isVisibleToUser()'s college-approval branch, not the invite one.
        // Scores span the ≥90% threshold on purpose: the Results page's
        // "add to pipeline" filter has something real to demonstrate.
        $scoredCandidates = [
            ['email' => 'alex.chen@student.apex.edu', 'score' => 95],
            ['email' => 'priya.desai@student.apex.edu', 'score' => 62],
            ['email' => 'rohan.kapoor@student.apex.edu', 'score' => 78],
        ];

        foreach ($scoredCandidates as $c) {
            $student = User::where('email', $c['email'])->first();
            if ($student === null) {
                continue;
            }

            ContestParticipant::updateOrCreate(
                ['contest_id' => $campusContest->id, 'user_id' => $student->id],
                ['registered_at' => now()->subDays(1), 'score' => $c['score']]
            );
        }
    }
}
