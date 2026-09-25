<?php

namespace Database\Seeders;

use App\Models\InterviewQuestionBank;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * The real, permanent interview question bank's starter content — realistic
 * placeholder questions across all 5 categories, phrased for *spoken*
 * answers (never code), so every downstream Interview (general/company/
 * tpo_mock/company_hiring) has real rows to attach from day one. Real bulk
 * content gets fed into this same table later via the admin CRUD — nothing
 * here is LLM-generated, and the schema never assumes it will be.
 */
class InterviewQuestionBankSeeder extends Seeder
{
    public function run(): void
    {
        $priya = User::where('email', 'priya@mellow.ai')->first();

        $questions = [
            // Technical — spoken system-design/CS-fundamentals prompts, not code.
            ['q' => 'Walk me through how you would design a rate limiter for a public API. What data structure would you use and why?', 'cat' => 'technical', 'diff' => 'hard', 'dur' => 300, 'tags' => ['system-design', 'apis'], 'note' => 'Listen for a concrete algorithm (token bucket/sliding window), not just "I would use Redis."'],
            ['q' => 'Explain the difference between a process and a thread, and give an example of when you would choose one over the other.', 'cat' => 'technical', 'diff' => 'medium', 'dur' => 240, 'tags' => ['operating-systems'], 'note' => 'Look for memory-isolation vs shared-memory reasoning.'],
            ['q' => 'How would you detect a cycle in a linked list? Explain your approach and why it works.', 'cat' => 'technical', 'diff' => 'medium', 'dur' => 240, 'tags' => ['data-structures', 'linked-lists'], 'note' => "Fast/slow pointer (Floyd's) is the expected answer — listen for why it must eventually meet."],
            ['q' => 'What is the difference between SQL and NoSQL databases, and how would you decide which to use for a new project?', 'cat' => 'technical', 'diff' => 'easy', 'dur' => 210, 'tags' => ['databases'], 'note' => 'Should mention schema flexibility, consistency guarantees, and scale patterns.'],
            ['q' => 'Explain what happens, step by step, when you type a URL into a browser and press Enter.', 'cat' => 'technical', 'diff' => 'medium', 'dur' => 300, 'tags' => ['networking', 'web'], 'note' => 'DNS, TCP handshake, TLS, HTTP request/response, render — depth over breadth.'],
            ['q' => 'What is Big-O notation, and how would you analyze the time complexity of a nested loop?', 'cat' => 'technical', 'diff' => 'easy', 'dur' => 180, 'tags' => ['algorithms', 'complexity'], 'note' => 'Should get to O(n^2) with reasoning, not just state it.'],
            ['q' => 'Describe how a hash table works internally, and what happens when two keys collide.', 'cat' => 'technical', 'diff' => 'medium', 'dur' => 240, 'tags' => ['data-structures'], 'note' => 'Chaining vs open addressing — either is fine if explained correctly.'],
            ['q' => 'What are the ACID properties of a database transaction, and why do they matter?', 'cat' => 'technical', 'diff' => 'medium', 'dur' => 240, 'tags' => ['databases', 'transactions'], 'note' => 'Real-world example (e.g. a bank transfer) is a good sign.'],
            ['q' => 'How would you design a URL shortener like bit.ly? Talk through the key components.', 'cat' => 'technical', 'diff' => 'hard', 'dur' => 300, 'tags' => ['system-design'], 'note' => 'Encoding scheme, storage, redirect path, collision handling.'],
            ['q' => 'What is the difference between synchronous and asynchronous programming? Give a real example from something you have built.', 'cat' => 'technical', 'diff' => 'medium', 'dur' => 240, 'tags' => ['concurrency'], 'note' => 'A concrete personal example is worth more than textbook phrasing.'],
            ['q' => 'Explain what REST means and what makes an API RESTful.', 'cat' => 'technical', 'diff' => 'easy', 'dur' => 210, 'tags' => ['apis', 'web'], 'note' => 'Statelessness and resource-based URLs are the core ideas to listen for.'],
            ['q' => 'How would you find the kth largest element in an unsorted array? Explain at least two approaches and their trade-offs.', 'cat' => 'technical', 'diff' => 'hard', 'dur' => 300, 'tags' => ['algorithms', 'arrays'], 'note' => 'Sort vs heap vs quickselect — trade-off reasoning matters more than naming all three.'],
            ['q' => 'What is object-oriented programming, and what are its four main principles?', 'cat' => 'technical', 'diff' => 'easy', 'dur' => 210, 'tags' => ['oop'], 'note' => 'Encapsulation, abstraction, inheritance, polymorphism — with an example of each.'],
            ['q' => 'Describe a caching strategy you would use to speed up a slow, frequently-read database query.', 'cat' => 'technical', 'diff' => 'medium', 'dur' => 240, 'tags' => ['performance', 'caching'], 'note' => 'Should touch on invalidation, not just "add a cache."'],
            ['q' => 'What is the difference between depth-first and breadth-first search, and when would you use each?', 'cat' => 'technical', 'diff' => 'medium', 'dur' => 240, 'tags' => ['algorithms', 'graphs'], 'note' => 'Use-case reasoning (shortest path vs exhaustive search) over rote definitions.'],

            // Behavioral
            ['q' => 'Tell me about a time you disagreed with a teammate on a technical decision. How did you handle it?', 'cat' => 'behavioral', 'diff' => 'medium', 'dur' => 180, 'tags' => ['teamwork', 'conflict'], 'note' => 'Look for a real resolution, not just "we talked it out."'],
            ['q' => 'Describe a project you are most proud of. What was your specific contribution?', 'cat' => 'behavioral', 'diff' => 'easy', 'dur' => 180, 'tags' => ['ownership'], 'note' => 'Should be able to go deep on their own part, not just the team\'s.'],
            ['q' => 'Tell me about a time you missed a deadline or made a mistake at work or in a project. What did you learn?', 'cat' => 'behavioral', 'diff' => 'medium', 'dur' => 180, 'tags' => ['accountability'], 'note' => 'Honesty and a concrete lesson matter more than a "perfect" story.'],
            ['q' => 'Describe a time you had to learn a new technology quickly to finish something. How did you approach it?', 'cat' => 'behavioral', 'diff' => 'easy', 'dur' => 150, 'tags' => ['adaptability'], 'note' => null],
            ['q' => 'Tell me about a time you received difficult feedback. How did you respond?', 'cat' => 'behavioral', 'diff' => 'medium', 'dur' => 180, 'tags' => ['growth'], 'note' => null],
            ['q' => 'Describe a situation where you had to work with someone whose working style was very different from yours.', 'cat' => 'behavioral', 'diff' => 'medium', 'dur' => 180, 'tags' => ['teamwork'], 'note' => null],
            ['q' => 'Tell me about a time you went above and beyond what was expected of you.', 'cat' => 'behavioral', 'diff' => 'easy', 'dur' => 150, 'tags' => ['initiative'], 'note' => null],
            ['q' => 'Describe how you prioritize your work when you have multiple deadlines at once.', 'cat' => 'behavioral', 'diff' => 'medium', 'dur' => 180, 'tags' => ['time-management'], 'note' => null],

            // HR
            ['q' => 'Why do you want to work at our company specifically?', 'cat' => 'hr', 'diff' => 'easy', 'dur' => 120, 'tags' => ['motivation'], 'note' => 'Should reference something specific, not a generic answer.'],
            ['q' => 'Where do you see yourself in three years?', 'cat' => 'hr', 'diff' => 'easy', 'dur' => 120, 'tags' => ['career-goals'], 'note' => null],
            ['q' => 'What are your greatest strengths, and how have they helped you in your work?', 'cat' => 'hr', 'diff' => 'easy', 'dur' => 120, 'tags' => ['self-assessment'], 'note' => null],
            ['q' => 'What is an area you are actively working to improve?', 'cat' => 'hr', 'diff' => 'easy', 'dur' => 120, 'tags' => ['self-assessment'], 'note' => 'A genuine, specific weakness is a better sign than a disguised strength.'],
            ['q' => 'Why are you looking to leave your current role, or why are you interested in this opportunity right now?', 'cat' => 'hr', 'diff' => 'medium', 'dur' => 150, 'tags' => ['motivation'], 'note' => null],

            // Situational
            ['q' => 'A production deployment just broke checkout on your company\'s website. Walk me through what you would do in the first ten minutes.', 'cat' => 'situational', 'diff' => 'hard', 'dur' => 210, 'tags' => ['incident-response'], 'note' => 'Rollback-first instinct and calm triage are good signs.'],
            ['q' => 'You discover a critical bug in code a teammate wrote and shipped last week. How do you handle raising it?', 'cat' => 'situational', 'diff' => 'medium', 'dur' => 180, 'tags' => ['communication'], 'note' => null],
            ['q' => 'Your manager asks you to finish a feature in half the time you estimated. What do you do?', 'cat' => 'situational', 'diff' => 'medium', 'dur' => 180, 'tags' => ['negotiation'], 'note' => null],
            ['q' => 'You are the only person available and a client is asking for an update on an issue you do not fully understand yet. How do you respond?', 'cat' => 'situational', 'diff' => 'medium', 'dur' => 180, 'tags' => ['communication'], 'note' => null],

            // Aptitude
            ['q' => 'If a train travels 60 km in 45 minutes, what is its speed in km/h? Walk me through your reasoning out loud.', 'cat' => 'aptitude', 'diff' => 'easy', 'dur' => 120, 'tags' => ['quantitative'], 'note' => null],
            ['q' => 'You have three boxes, one correctly labeled and two incorrectly labeled. How would you figure out the correct labels by opening the fewest boxes possible?', 'cat' => 'aptitude', 'diff' => 'medium', 'dur' => 150, 'tags' => ['logical-reasoning'], 'note' => null],
            ['q' => 'Complete the pattern and explain your reasoning: 2, 6, 12, 20, 30, ...?', 'cat' => 'aptitude', 'diff' => 'easy', 'dur' => 120, 'tags' => ['pattern-recognition'], 'note' => null],
        ];

        foreach ($questions as $q) {
            InterviewQuestionBank::updateOrCreate(
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
        }
    }
}
