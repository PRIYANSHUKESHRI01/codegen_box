<?php

namespace Database\Seeders;

use App\Models\SpeakingPrompt;
use Illuminate\Database\Seeder;

/**
 * Launch content for Speaking Practice — real, complete passages (not
 * placeholder text) across all three difficulty tiers, same "real content
 * from day one" posture as ArticleSeeder. Idempotent via updateOrCreate by
 * title. No admin CRUD in v1 (see the Learning Centre plan's scope
 * boundaries) — this is the only way this content gets authored for now.
 */
class SpeakingPromptSeeder extends Seeder
{
    /**
     * The launch passages predate the job-seeker categories. Folding them onto the four labels the
     * passage generator also uses (GeminiSpeakingPassageService::PURPOSES) keeps the category filter
     * to four chips instead of thirteen, and a generated passage sits in the same bucket as its library twin.
     */
    private const CATEGORY_MAP = [
        'Everyday Life' => 'Everyday English',
        'Professional Skills' => 'Workplace English',
        'Business' => 'Workplace English',
        'Career Readiness' => 'Interview Ready',
        'Technology' => 'Tech & Career',
    ];

    public static function categoryFor(string $category): string
    {
        return self::CATEGORY_MAP[$category] ?? $category;
    }

    public function run(): void
    {
        foreach ([...$this->prompts(), ...$this->jobSeekerPrompts()] as $order => $prompt) {
            SpeakingPrompt::updateOrCreate(
                ['title' => $prompt['title']],
                [
                    'passage_text' => $prompt['passage_text'],
                    'category' => self::categoryFor($prompt['category']),
                    'difficulty' => $prompt['difficulty'],
                    'target_wpm_min' => 110,
                    'target_wpm_max' => 160,
                    'is_active' => true,
                    'display_order' => $order,
                ]
            );
        }
    }

    private function prompts(): array
    {
        return [
            // Beginner
            [
                'title' => 'My Daily Routine',
                'category' => 'Everyday Life',
                'difficulty' => SpeakingPrompt::DIFFICULTY_BEGINNER,
                'passage_text' => 'Every morning, I wake up at seven o\'clock and get ready for the day. I brush my teeth, take a quick shower, and eat a simple breakfast. After that, I check my messages and plan what I need to do. I usually leave home by eight thirty so I can reach my classes on time. In the evening, I like to relax by listening to music or going for a short walk.',
            ],
            [
                'title' => 'A Walk in the Park',
                'category' => 'Everyday Life',
                'difficulty' => SpeakingPrompt::DIFFICULTY_BEGINNER,
                'passage_text' => 'Last weekend, I visited a park near my house with two of my friends. The weather was cool and sunny, so many families were sitting on the grass. We walked around the lake, took some photographs, and bought ice cream from a small stall near the gate. It was a simple afternoon, but it helped me feel calm and refreshed before a busy week.',
            ],
            [
                'title' => 'My Favorite Hobby',
                'category' => 'Everyday Life',
                'difficulty' => SpeakingPrompt::DIFFICULTY_BEGINNER,
                'passage_text' => 'My favorite hobby is reading short stories before I go to sleep. I enjoy stories because they let me imagine new places and characters without leaving my room. On weekends, I sometimes visit a small bookstore near my college and spend an hour looking through the shelves. Reading also helps me learn new words, which is useful when I am speaking English with my friends.',
            ],
            [
                'title' => 'Ordering Food at a Restaurant',
                'category' => 'Everyday Life',
                'difficulty' => SpeakingPrompt::DIFFICULTY_BEGINNER,
                'passage_text' => 'When I go to a restaurant with my friends, I usually look at the menu carefully before deciding what to order. I like to ask the waiter for recommendations if I am not sure what to choose. Once the food arrives, we talk, laugh, and enjoy the meal together. At the end, we ask for the bill and decide whether to split the cost equally among everyone.',
            ],

            // Intermediate
            [
                'title' => 'The Importance of Time Management',
                'category' => 'Professional Skills',
                'difficulty' => SpeakingPrompt::DIFFICULTY_INTERMEDIATE,
                'passage_text' => 'Time management is one of the most valuable skills a student can develop before entering the workplace. When you plan your day in advance, you spend less time deciding what to do next and more time actually getting things done. Breaking large tasks into smaller, manageable steps makes even difficult projects feel achievable. People who manage their time well are not necessarily busier than others; they simply make more deliberate choices about where their attention goes.',
            ],
            [
                'title' => 'Technology in Modern Education',
                'category' => 'Technology',
                'difficulty' => SpeakingPrompt::DIFFICULTY_INTERMEDIATE,
                'passage_text' => 'Technology has changed the way students learn in classrooms around the world. Interactive tools, recorded lectures, and online practice platforms allow learners to study at their own pace instead of following a fixed schedule. At the same time, teachers can track a student\'s progress more accurately than ever before, identifying exactly where extra support is needed. However, technology works best when it supports genuine understanding, not when it simply replaces the effort of thinking things through.',
            ],
            [
                'title' => 'Preparing for a Job Interview',
                'category' => 'Career Readiness',
                'difficulty' => SpeakingPrompt::DIFFICULTY_INTERMEDIATE,
                'passage_text' => 'Preparing well for a job interview can make the difference between a nervous performance and a confident one. It helps to research the company beforehand, understand the role you are applying for, and think of real examples from your own experience that show your strengths. Practicing your answers out loud, rather than just in your head, trains you to speak clearly under pressure. Remember that an interview is also your chance to ask thoughtful questions about the team and the work itself.',
            ],
            [
                'title' => 'The Benefits of Teamwork',
                'category' => 'Professional Skills',
                'difficulty' => SpeakingPrompt::DIFFICULTY_INTERMEDIATE,
                'passage_text' => 'Working in a team teaches skills that are difficult to develop when you always work alone. You learn to listen to different points of view, negotiate when opinions disagree, and combine individual strengths into something stronger than any one person could build alone. Good teamwork does not mean everyone thinks the same way; it means people with different strengths trust each other enough to divide the work sensibly and support one another when something goes wrong.',
            ],

            // Advanced
            [
                'title' => 'The Impact of Artificial Intelligence on the Job Market',
                'category' => 'Technology',
                'difficulty' => SpeakingPrompt::DIFFICULTY_ADVANCED,
                'passage_text' => 'Artificial intelligence is reshaping industries at a pace few predicted even a decade ago, automating tasks that once required years of specialized training while simultaneously creating entirely new categories of work. This dual effect means the conversation should move beyond a simple question of job losses versus job gains, toward a more nuanced discussion of which human skills remain irreplaceable. Creativity, ethical judgment, and the ability to navigate ambiguous, unprecedented situations continue to distinguish human contribution from automated efficiency, and these are precisely the capabilities that future education must prioritize.',
            ],
            [
                'title' => 'Effective Communication in the Workplace',
                'category' => 'Professional Skills',
                'difficulty' => SpeakingPrompt::DIFFICULTY_ADVANCED,
                'passage_text' => 'Effective workplace communication extends far beyond simply exchanging information; it requires the deliberate practice of ensuring that a message is understood exactly as intended, regardless of the listener\'s background or assumptions. Ambiguity, left unaddressed, tends to compound over time, turning small misunderstandings into significant operational failures. Professionals who communicate well are typically those who tailor their language to their audience, actively solicit feedback to confirm comprehension, and remain genuinely receptive to being misunderstood themselves rather than assuming clarity was automatically achieved.',
            ],
            [
                'title' => 'Overcoming Challenges in a Competitive Industry',
                'category' => 'Career Readiness',
                'difficulty' => SpeakingPrompt::DIFFICULTY_ADVANCED,
                'passage_text' => 'Entering a highly competitive industry demands more than raw talent; it requires a sustained willingness to adapt in the face of repeated setbacks that would discourage a less determined candidate. Rejection, in this context, is rarely a verdict on one\'s ultimate potential but rather a reflection of timing, fit, or circumstances entirely outside one\'s control. Professionals who eventually thrive are frequently distinguished not by an absence of failure, but by their capacity to extract a specific, actionable lesson from each setback and apply it deliberately to their next attempt.',
            ],
            [
                'title' => 'The Role of Innovation in Business Growth',
                'category' => 'Business',
                'difficulty' => SpeakingPrompt::DIFFICULTY_ADVANCED,
                'passage_text' => 'Sustainable business growth rarely emerges from a single breakthrough idea; it is far more often the cumulative result of a culture that consistently rewards thoughtful experimentation over blind adherence to existing methods. Organizations that institutionalize innovation treat failure not as something to be avoided at all costs, but as an anticipated and informative byproduct of genuine progress. This mindset requires leadership to tolerate short-term inefficiency in exchange for long-term adaptability, a trade-off that becomes increasingly difficult to justify as an organization scales and risk aversion naturally sets in.',
            ],
        ];
    }

    /**
     * Passages for the thing these students are actually preparing for: job
     * interviews and everyday workplace English. Every number is spelled out
     * (no digits) so the read-aloud text is unambiguous, and word counts sit
     * inside the band for their level — SpeakingPromptContentTest enforces both.
     */
    private function jobSeekerPrompts(): array
    {
        $b = SpeakingPrompt::DIFFICULTY_BEGINNER;
        $i = SpeakingPrompt::DIFFICULTY_INTERMEDIATE;
        $a = SpeakingPrompt::DIFFICULTY_ADVANCED;

        return [
            // Beginner
            [
                'title' => 'Introducing Myself',
                'category' => 'Interview Ready',
                'difficulty' => $b,
                'passage_text' => 'Good morning, and thank you for meeting me today. I am a final-year engineering student, and I enjoy solving problems and learning new tools. During my studies, I built a small website for my college library, and it taught me how to work with a team. I am hardworking, I learn quickly, and I am excited to start my career with a company like yours.',
            ],
            [
                'title' => 'My Strengths',
                'category' => 'Interview Ready',
                'difficulty' => $b,
                'passage_text' => 'My biggest strength is that I stay calm when work becomes difficult. When I face a problem, I break it into small steps and solve one step at a time. I also ask questions when I am not sure, because I would rather learn early than make a mistake later. My friends say I am a good listener, and I try to bring that habit to every team I join.',
            ],
            [
                'title' => 'Asking for Help Politely',
                'category' => 'Workplace English',
                'difficulty' => $b,
                'passage_text' => 'Excuse me, do you have a few minutes to help me? I am working on a report, and I am not sure how to arrange the data. I have tried two ways, but neither looks clear. Could you please look at it and give me some advice? I will make the changes quickly. Thank you so much for your time. I really appreciate your support.',
            ],
            [
                'title' => 'Meeting My New Team',
                'category' => 'Workplace English',
                'difficulty' => $b,
                'passage_text' => 'Hello everyone, it is nice to meet you all. I joined the company this week as a junior developer. Before this, I studied computer science and worked on a few small projects. I am still learning how things work here, so please tell me if I can do something better. I am happy to help with anything, and I am looking forward to working with you.',
            ],

            // Intermediate
            [
                'title' => 'Why Should We Hire You?',
                'category' => 'Interview Ready',
                'difficulty' => $i,
                'passage_text' => 'You should hire me because I combine strong fundamentals with a genuine willingness to learn. In my final year, I led a small team to build a booking application, and we delivered it two weeks before the deadline. That experience taught me how to plan, communicate clearly, and take responsibility for results. I may not know everything yet, but I adapt quickly, I accept feedback well, and I will work hard to become a dependable member of your team.',
            ],
            [
                'title' => 'Describing My Final-Year Project',
                'category' => 'Interview Ready',
                'difficulty' => $i,
                'passage_text' => 'For my final-year project, I built a web application that helps students track their attendance and assignments in one place. I chose this problem because many of my classmates missed deadlines simply because information was scattered across different apps. I designed the database, created the user interface, and tested the system with fifty students. The biggest challenge was making it fast on slow networks, and solving it taught me a great deal about optimization.',
            ],
            [
                'title' => 'A Time I Worked in a Team',
                'category' => 'Interview Ready',
                'difficulty' => $i,
                'passage_text' => 'During my third year, I worked with four classmates on a robotics competition. At first, we struggled because everyone wanted to follow a different plan. I suggested that we hold a short meeting, list our ideas, and vote on the best approach. After that, each person took one responsibility, and we checked our progress every evening. We did not win first place, but we finished the project on time and learned how important communication is.',
            ],
            [
                'title' => 'Where I See Myself in Five Years',
                'category' => 'Interview Ready',
                'difficulty' => $i,
                'passage_text' => 'In five years, I hope to be a confident professional who is trusted with important responsibilities. In the first year, my goal is to learn the tools and processes of the company as quickly as possible. After that, I would like to take ownership of small projects and eventually guide new team members. I am also planning to keep improving my technical and communication skills, because I believe steady learning is the best way to grow.',
            ],
            [
                'title' => 'Questions I Ask at the End',
                'category' => 'Interview Ready',
                'difficulty' => $i,
                'passage_text' => 'Thank you for explaining the role so clearly. Before we finish, I would like to ask a few questions. What does success look like in this position during the first six months? How does the team handle feedback and professional development? And what are the biggest challenges that someone in this role might face? Your answers will help me understand how I can contribute from the very first day, and I am genuinely excited about this opportunity.',
            ],
            [
                'title' => 'Giving a Status Update',
                'category' => 'Workplace English',
                'difficulty' => $i,
                'passage_text' => 'Here is a quick update on the project. We have completed the login module and the dashboard, and both are working well in testing. The payment feature is taking longer than expected because the provider changed their requirements. I expect to finish it by Thursday if there are no further changes. If the schedule moves, I will let you know immediately so that we can adjust our plan together.',
            ],

            // Advanced
            [
                'title' => 'Handling a Tight Deadline',
                'category' => 'Interview Ready',
                'difficulty' => $a,
                'passage_text' => 'There was a time when our team received an unexpected request to deliver a major feature three days earlier than planned. Instead of panicking, I reviewed the remaining tasks with my teammates and identified which ones were essential for the launch. We postponed the minor improvements, divided the critical work according to everyone\'s strengths, and held a short check-in every morning to remove obstacles quickly. As a result, we released the feature on time without compromising quality, and the experience taught me that clear priorities matter far more than working longer hours.',
            ],
            [
                'title' => 'Owning a Mistake',
                'category' => 'Interview Ready',
                'difficulty' => $a,
                'passage_text' => 'Last semester, I submitted a project report without double-checking one important calculation, and the error affected our final result. When I realized it, I told my professor immediately instead of hoping that nobody would notice. I explained what had gone wrong, corrected the calculation, and prepared a checklist to review every report before submission. My professor appreciated the honesty, and the checklist has prevented similar mistakes ever since. I believe that accepting responsibility openly is the quickest way to earn the trust of a team.',
            ],
            [
                'title' => 'Explaining Technology Simply',
                'category' => 'Tech & Career',
                'difficulty' => $a,
                'passage_text' => 'When I explain a technical idea to someone outside the field, I begin with a familiar comparison. For example, an application programming interface works like a waiter in a restaurant: it takes your request to the kitchen and brings the response back to your table. You do not need to know how the kitchen operates; you only need to know what you can order. This approach keeps the explanation simple, and it helps the listener remember the idea long after the conversation has ended.',
            ],
            [
                'title' => 'Disagreeing Respectfully',
                'category' => 'Workplace English',
                'difficulty' => $a,
                'passage_text' => 'I understand the reasoning behind this proposal, and I appreciate the effort that went into it. However, I would like to share a concern about the timeline. Based on my experience with similar projects, the testing phase usually takes longer than we expect, which could affect the quality of the release. Would it be possible to extend the schedule by one week, or to reduce the scope of the first version? I am happy to work out the details with you.',
            ],
        ];
    }
}
