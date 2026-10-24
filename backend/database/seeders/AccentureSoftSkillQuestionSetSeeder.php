<?php

namespace Database\Seeders;

use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillAssessmentQuestion;
use App\Models\SoftSkillQuestion;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AccentureSoftSkillQuestionSetSeeder extends Seeder
{
    public function run(): void
    {
        $priya = User::where('email', 'priya@mellow.ai')->first()
            ?? User::where('role', User::ROLE_SUPERADMIN)->first();

        $assessment = SoftSkillAssessment::updateOrCreate(
            ['slug' => 'accenture-campus-recruitment-cognitive-soft-skills-set-1'],
            [
                'title' => 'Accenture Campus Recruitment — Cognitive & Soft Skills Assessment (Set 1)',
                'description' => 'Official practice paper patterned after Accenture ASE / AASE campus drives. Covers 25 authentic questions spanning Quantitative Aptitude, Logical Reasoning, Verbal Ability, and Workplace Situational Judgment.',
                'status' => SoftSkillAssessment::STATUS_PUBLISHED,
                'assessment_type' => SoftSkillAssessment::TYPE_GENERAL,
                'is_question_set' => true,
                'question_set_number' => 101, // Dedicated company prep question set range
                'duration_minutes' => 45,
                'pass_percentage' => 65,
                'max_attempts' => null,
                'created_by' => $priya?->id,
            ]
        );

        $questions = $this->questions();

        DB::transaction(function () use ($assessment, $questions, $priya) {
            foreach ($questions as $order => $q) {
                $question = SoftSkillQuestion::updateOrCreate(
                    ['question_text' => $q['question_text']],
                    [
                        'category' => $q['category'],
                        'difficulty' => $q['difficulty'],
                        'options' => $q['options'],
                        'correct_index' => $q['correct_index'],
                        'explanation' => $q['explanation'],
                        'is_active' => true,
                        'created_by' => $priya?->id,
                    ]
                );

                SoftSkillAssessmentQuestion::updateOrCreate(
                    [
                        'soft_skill_assessment_id' => $assessment->id,
                        'soft_skill_question_id' => $question->id,
                    ],
                    [
                        'display_order' => $order,
                    ]
                );
            }
        });
    }

    /**
     * 25 Authentic Accenture fresher campus drive questions:
     * 8 Quantitative Aptitude, 7 Logical Reasoning, 6 Verbal Ability, 4 Situational Judgment.
     */
    private function questions(): array
    {
        return [
            // ── 1. Quantitative Aptitude (8 Questions) ──
            [
                'question_text' => 'A train 180 meters long is traveling at a constant speed of 72 km/h. How many seconds will it take to completely cross a railway platform that is 220 meters long?',
                'category' => 'quantitative',
                'difficulty' => 'easy',
                'options' => ['15 seconds', '20 seconds', '25 seconds', '30 seconds'],
                'correct_index' => 1,
                'explanation' => 'Speed = 72 * (5/18) = 20 m/s. Total distance = Length of train + Length of platform = 180 + 220 = 400 m. Time = Distance / Speed = 400 / 20 = 20 seconds.',
            ],
            [
                'question_text' => 'Pipe A can fill a reservoir in 12 hours, while Pipe B can fill it in 18 hours. If both pipes are opened simultaneously when the reservoir is completely empty, how many hours will they take to fill it?',
                'category' => 'quantitative',
                'difficulty' => 'easy',
                'options' => ['6.5 hours', '7.2 hours', '7.8 hours', '8.0 hours'],
                'correct_index' => 1,
                'explanation' => '1 hour rate = (1/12) + (1/18) = (3 + 2)/36 = 5/36 per hour. Total time = 36 / 5 = 7.2 hours (7 hours and 12 minutes).',
            ],
            [
                'question_text' => 'A retailer marks up a product by 40% above its cost price and subsequently offers a trade discount of 15% on the marked price. What is the retailer\'s actual net percentage profit?',
                'category' => 'quantitative',
                'difficulty' => 'medium',
                'options' => ['18%', '19%', '21%', '25%'],
                'correct_index' => 1,
                'explanation' => 'Let Cost Price = 100. Marked Price = 100 * 1.40 = 140. Selling Price = 140 * (1 - 0.15) = 140 * 0.85 = 119. Profit = 119 - 100 = 19%.',
            ],
            [
                'question_text' => 'In an engineering college batch, 60% of students passed Data Structures, 55% passed Computer Networks, and 30% passed both subjects. What percentage of students failed both subjects?',
                'category' => 'quantitative',
                'difficulty' => 'medium',
                'options' => ['10%', '15%', '20%', '25%'],
                'correct_index' => 1,
                'explanation' => 'Percentage of students passing at least one subject = P(DS) + P(CN) - P(Both) = 60% + 55% - 30% = 85%. Percentage failing both = 100% - 85% = 15%.',
            ],
            [
                'question_text' => 'A, B, and C invest in a technology consulting startup in the ratio 3 : 5 : 7. If the business generates a net annual profit of ₹45,000, what is the profit share of partner B?',
                'category' => 'quantitative',
                'difficulty' => 'easy',
                'options' => ['₹9,000', '₹15,000', '₹18,000', '₹21,000'],
                'correct_index' => 1,
                'explanation' => 'Total ratio parts = 3 + 5 + 7 = 15. B\'s share = (5 / 15) * 45,000 = 45,000 / 3 = ₹15,000.',
            ],
            [
                'question_text' => 'In how many distinct ways can the letters of the word "ACCENT" be arranged such that both letter \'C\'s are always adjacent to each other?',
                'category' => 'quantitative',
                'difficulty' => 'medium',
                'options' => ['60', '120', '240', '360'],
                'correct_index' => 1,
                'explanation' => 'Treat (CC) as a single unit. We have 5 units: (CC), A, E, N, T. Number of ways to arrange 5 distinct units = 5! = 120. Since the two \'C\'s are identical, (CC) has only 1 internal arrangement (2! / 2! = 1). Total ways = 120 * 1 = 120.',
            ],
            [
                'question_text' => 'What is the compound interest accrued on a principal of ₹16,000 for 2 years at an annual interest rate of 10% compounded annually?',
                'category' => 'quantitative',
                'difficulty' => 'medium',
                'options' => ['₹3,200', '₹3,360', '₹3,400', '₹3,520'],
                'correct_index' => 1,
                'explanation' => 'Amount = P * (1 + R/100)^T = 16,000 * (1.10)^2 = 16,000 * 1.21 = 19,360. Compound Interest = Amount - Principal = 19,360 - 16,000 = ₹3,360.',
            ],
            [
                'question_text' => 'Two dice are rolled simultaneously. What is the mathematical probability that the sum of the faces is equal to 8?',
                'category' => 'quantitative',
                'difficulty' => 'easy',
                'options' => ['1/9', '5/36', '1/6', '7/36'],
                'correct_index' => 1,
                'explanation' => 'Total outcomes = 6 * 6 = 36. Favorable outcomes with sum 8: (2,6), (3,5), (4,4), (5,3), (6,2) -> 5 outcomes. Probability = 5/36.',
            ],

            // ── 2. Logical & Abstract Reasoning (7 Questions) ──
            [
                'question_text' => 'In a certain code language, "SYSTEM" is coded as "SYSMET" and "NEARER" is coded as "AENRER". Following the exact same logic, how is "FRACTION" coded?',
                'category' => 'logical',
                'difficulty' => 'medium',
                'options' => ['ARFCITNO', 'CARFNOIT', 'CARFTION', 'ACRFNOIT'],
                'correct_index' => 1,
                'explanation' => 'Split the word into two equal halves. Reverse the first half and reverse the second half: "FRACTION" -> "FRAC" + "TION". Reversing "FRAC" yields "CARF"; reversing "TION" yields "NOIT". Combining them gives "CARFNOIT".',
            ],
            [
                'question_text' => 'Pointing to a photograph of a man, Sneha said, "His mother is the only daughter of my mother." How is Sneha related to the man in the photograph?',
                'category' => 'logical',
                'difficulty' => 'easy',
                'options' => ['Sister', 'Mother', 'Aunt', 'Grandmother'],
                'correct_index' => 1,
                'explanation' => '"The only daughter of my mother" is Sneha herself (assuming a female speaker). Therefore, Sneha is the mother of the man in the photograph.',
            ],
            [
                'question_text' => 'A developer walks 20 meters North from their workstation, turns right and walks 30 meters, turns right again and walks 20 meters, and finally turns left and walks 15 meters. How far and in which direction is the developer from their initial workstation?',
                'category' => 'logical',
                'difficulty' => 'medium',
                'options' => ['35 meters East', '45 meters East', '45 meters North', '50 meters East'],
                'correct_index' => 1,
                'explanation' => 'North-South: +20m North, then -20m South = 0m. East-West: +30m East, then +15m East = 45m East. Net position = 45 meters East.',
            ],
            [
                'question_text' => 'Statements:\n1. All microservices are distributed applications.\n2. Some distributed applications are containerized.\nConclusions:\nI. Some containerized applications are microservices.\nII. All microservices are containerized.\nWhich conclusion(s) logically follow?',
                'category' => 'logical',
                'difficulty' => 'medium',
                'options' => ['Only conclusion I follows', 'Only conclusion II follows', 'Either I or II follows', 'Neither conclusion I nor II follows'],
                'correct_index' => 3,
                'explanation' => 'Microservices are a subset of distributed applications. Containerized applications intersect with distributed applications, but may or may not overlap with the microservices subset. Thus, neither I nor II necessarily follows.',
            ],
            [
                'question_text' => 'Identify the missing number in the sequence: 4, 9, 19, 39, 79, ?',
                'category' => 'logical',
                'difficulty' => 'easy',
                'options' => ['119', '149', '159', '169'],
                'correct_index' => 2,
                'explanation' => 'Pattern: Each term is obtained by multiplying the previous term by 2 and adding 1: 4 * 2 + 1 = 9; 9 * 2 + 1 = 19; 19 * 2 + 1 = 39; 39 * 2 + 1 = 79; 79 * 2 + 1 = 159.',
            ],
            [
                'question_text' => 'Six team members (A, B, C, D, E, F) sit around a circular conference table facing the center. B is to the immediate right of E. C is between A and E. D is opposite E. Who is sitting to the immediate left of D?',
                'category' => 'logical',
                'difficulty' => 'hard',
                'options' => ['A', 'B', 'C', 'F'],
                'correct_index' => 1,
                'explanation' => 'Arranging in circular order clockwise facing center: E -> B -> F -> D -> A -> C -> (back to E). D is opposite E. The person to the immediate left of D (clockwise from D\'s perspective facing center) is B.',
            ],
            [
                'question_text' => 'Statement: "Employees must complete the cloud security training before requesting production database access credentials."\nAssumptions:\nI. Cloud security training provides knowledge necessary to handle production databases safely.\nII. Production database credentials were previously given without security checks.\nWhich assumption is implicit?',
                'category' => 'logical',
                'difficulty' => 'medium',
                'options' => ['Only assumption I is implicit', 'Only assumption II is implicit', 'Both I and II are implicit', 'Neither I nor II is implicit'],
                'correct_index' => 0,
                'explanation' => 'The statement links completing training with credential access, implying the training equips employees with the required safety knowledge (Assumption I). It gives no indication of historical credential practices (Assumption II is not implicit).',
            ],

            // ── 3. Verbal & English Ability (6 Questions) ──
            [
                'question_text' => 'Choose the option that correctly completes the sentence with appropriate subject-verb agreement: "The panel of enterprise architects, together with the project director, ________ decided to approve the cloud migration blueprint."',
                'category' => 'verbal',
                'difficulty' => 'medium',
                'options' => ['have', 'has', 'are', 'were'],
                'correct_index' => 1,
                'explanation' => 'When a subject is followed by phrases like "together with", "as well as", or "along with", the verb agrees strictly with the true singular head subject ("The panel"), which requires the singular auxiliary verb "has".',
            ],
            [
                'question_text' => 'Identify the segment containing a grammatical error in the following sentence:\n"Neither the database administrator (A) / nor the software developers (B) / was able to identify (C) / the root cause of the memory leak (D)."',
                'category' => 'verbal',
                'difficulty' => 'medium',
                'options' => ['Segment A', 'Segment B', 'Segment C', 'Segment D'],
                'correct_index' => 2,
                'explanation' => 'With the correlative conjunction "Neither... nor", the verb agrees with the closer subject. Here, the closer subject is "the software developers" (plural), so the verb should be "were able to identify" instead of "was able to identify". Error is in Segment C.',
            ],
            [
                'question_text' => 'Select the most appropriate synonym for the bolded word: "The lead consultant offered a PRAGMATIC solution to resolve the legacy system latency without rewriting the entire core engine."',
                'category' => 'verbal',
                'difficulty' => 'easy',
                'options' => ['Theoretical', 'Practical', 'Elaborate', 'Hesitant'],
                'correct_index' => 1,
                'explanation' => '"Pragmatic" means dealing with matters in a sensible, realistic, and practical way rather than relying on theoretical or idealized methods. Hence, "Practical" is the exact synonym.',
            ],
            [
                'question_text' => 'Select the word that is most opposite in meaning (antonym) to: "AMBIGUOUS"',
                'category' => 'verbal',
                'difficulty' => 'easy',
                'options' => ['Vague', 'Obscure', 'Lucid', 'Tentative'],
                'correct_index' => 2,
                'explanation' => '"Ambiguous" means open to more than one interpretation or unclear. "Lucid" means clear and easy to understand, making it the antonym.',
            ],
            [
                'question_text' => 'Complete the sentence: "The engineering team continued with the sprint release, ________ encountering unexpected integration test failures during the morning build."',
                'category' => 'verbal',
                'difficulty' => 'medium',
                'options' => ['despite', 'although', 'whereas', 'unless'],
                'correct_index' => 0,
                'explanation' => '"Despite" is a preposition that correctly takes a gerund or noun phrase ("encountering unexpected integration test failures"). "Although" requires a full clause with a subject and finite verb.',
            ],
            [
                'question_text' => 'What is the meaning of the idiom "to burn the candle at both ends"?',
                'category' => 'verbal',
                'difficulty' => 'easy',
                'options' => ['To waste electrical energy', 'To work exhaustively from early morning until late night', 'To ignite disputes between teams', 'To manage financial budgets conservatively'],
                'correct_index' => 1,
                'explanation' => '"To burn the candle at both ends" means to exhaust oneself by working excessively hard, typically rising early and sleeping late.',
            ],

            // ── 4. Situational Judgment / Behavioral (4 Questions) ──
            [
                'question_text' => 'During a critical milestone presentation to an external client, your teammate presents a performance benchmark chart containing an inaccurate calculation that exaggerates your system\'s speed. What is the most professional immediate course of action?',
                'category' => 'situational',
                'difficulty' => 'medium',
                'options' => [
                    'Interrupt your teammate loudly and point out the calculation error immediately in front of the client.',
                    'Remain silent during the meeting, but privately clarify the calculation with your teammate and send a polite, documented errata update to the client team after the call.',
                    'Ignore the discrepancy entirely since client presentations are meant for high-level marketing.',
                    'Send a private chat message to the client during the presentation blaming your teammate.'
                ],
                'correct_index' => 1,
                'explanation' => 'Accenture values integrity, client trust, and team respect. Contradicting a teammate aggressively mid-presentation damages professional credibility, while ignoring inaccuracies violates integrity. Clarifying promptly post-call with documented errata maintains both teamwork and transparency.',
            ],
            [
                'question_text' => 'You are assigned to an ongoing project where the technical documentation is fragmented and the senior developer who authored the module is currently on annual leave. How should you proceed with your assigned bug fix?',
                'category' => 'situational',
                'difficulty' => 'medium',
                'options' => [
                    'Wait until the senior developer returns before writing any code.',
                    'Analyze the existing unit test suite, trace code execution paths locally, and document your findings before consulting available peers or the team lead.',
                    'Rewrite the entire module from scratch according to your own preferred pattern.',
                    'Message the senior developer repeatedly on their personal phone during their vacation.'
                ],
                'correct_index' => 1,
                'explanation' => 'Self-reliance, diagnostic problem-solving, and respect for colleagues\' personal time reflect enterprise maturity. Tracing tests and documenting logic first ensures progress and makes peer consultations productive.',
            ],
            [
                'question_text' => 'Your project team is two days away from sprint delivery when the product owner requests a new sorting feature. Adding it would risk missing the scheduled regression testing window. What is the best response?',
                'category' => 'situational',
                'difficulty' => 'medium',
                'options' => [
                    'Agree immediately and skip regression testing to deliver both on time.',
                    'Refuse the request flatly and decline to speak with the product owner.',
                    'Explain the regression risk transparently and propose adding the feature to the very top of the next sprint backlog.',
                    'Quietly work all night without telling the team lead.'
                ],
                'correct_index' => 2,
                'explanation' => 'Agile consulting requires collaborative negotiation and risk management. Bypassing regression compromises quality; refusal harms stakeholder rapport. Transparently scheduling the feature for the next sprint preserves stability and alignment.',
            ],
            [
                'question_text' => 'You identify a subtle security flaw in an API endpoint written by another engineering squad that allows unauthorized read access to internal test tokens. What should you do?',
                'category' => 'situational',
                'difficulty' => 'medium',
                'options' => [
                    'Post about the vulnerability on a public developer forum or social media.',
                    'Document the reproducible exploit steps clearly and report it responsibly via internal security channels and the responsible squad lead.',
                    'Keep it to yourself since it is outside your immediate squad\'s domain.',
                    'Exploit the vulnerability repeatedly to test its boundaries without notifying anyone.'
                ],
                'correct_index' => 1,
                'explanation' => 'Responsible disclosure, security stewardship, and cross-team collaboration are core tenets of professional technology delivery. Clear documentation sent via internal security protocols protects the organization.',
            ],
        ];
    }
}

